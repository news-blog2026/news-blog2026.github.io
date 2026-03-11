#!/usr/bin/env node

/**
 * Generate sitemap.xml (and optionally robots.txt) for the project.
 *
 * Usage:
 *   node generate-sitemap.js
 *   node generate-sitemap.js --watch
 *   BASE_URL=https://example.com node generate-sitemap.js
 *
 * The script:
 * 1) Scans the project root for .html pages (excluding sitemap.xml and robots.txt)
 * 2) Scans the `news/` folder for .html pages
 * 3) Writes sitemap.xml with a sensible <changefreq>/<priority> scheme
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const NEWS_DIR = path.join(ROOT, 'news');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const ROBOTS_PATH = path.join(ROOT, 'robots.txt');
const PKG_PATH = path.join(ROOT, 'package.json');

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

function getBaseUrl() {
  // Priority: env BASE_URL > package.json "homepage" > localhost
  const envUrl = process.env.BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    if (pkg.homepage && typeof pkg.homepage === 'string') {
      return pkg.homepage.replace(/\/+$/, '');
    }
  } catch {
    // ignore if missing or invalid
  }

  return 'http://localhost';
}

const baseUrl = getBaseUrl();

const htmlExt = '.html';

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getPriorityAndFreq(relativePath) {
  if (relativePath === 'index.html') {
    return { priority: '1.0', changefreq: 'daily' };
  }
  if (relativePath.startsWith('news/')) {
    return { priority: '0.6', changefreq: 'weekly' };
  }
  return { priority: '0.8', changefreq: 'daily' };
}

async function listHtmlFiles(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(htmlExt)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function buildSitemap() {
  const htmlFiles = [];

  // Root-level HTML pages (ignore sitemap and robots)
  const rootEntries = await fs.promises.readdir(ROOT, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(htmlExt)) continue;
    if (entry.name === 'sitemap.html' || entry.name === 'robots.txt') continue;
    htmlFiles.push(path.join(ROOT, entry.name));
  }

  // news/ folder pages (if it exists)
  if (fs.existsSync(NEWS_DIR)) {
    const newsFiles = await listHtmlFiles(NEWS_DIR);
    htmlFiles.push(...newsFiles);
  }

  const urlEntries = [];
  for (const absPath of htmlFiles) {
    const relPath = path.relative(ROOT, absPath).replace(/\\/g, '/');

    const stats = await fs.promises.stat(absPath);
    const lastmod = formatIsoDate(stats.mtime);

    const { priority, changefreq } = getPriorityAndFreq(relPath);

    urlEntries.push({ loc: `${baseUrl}/${relPath}`, lastmod, changefreq, priority });
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of urlEntries) {
    lines.push('  <url>');
    lines.push(`    <loc>${entry.loc}</loc>`);
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');

  const sitemapXml = lines.join('\n') + '\n';

  await fs.promises.writeFile(SITEMAP_PATH, sitemapXml, 'utf8');

  // Update robots.txt with a sitemap pointer (keep existing content if it already has one)
  const robotsContent = `User-agent: *\nDisallow:\n\nSitemap: /sitemap.xml\n`;
  await fs.promises.writeFile(ROBOTS_PATH, robotsContent, 'utf8');

  console.log(`✅ Updated sitemap.xml (${urlEntries.length} URLs)`);
}

async function main() {
  await buildSitemap();

  if (isWatch) {
    console.log('👀 Watching for new/changed HTML files in the news folder...');
    const watcher = fs.watch(NEWS_DIR, { persistent: true }, async () => {
      try {
        await buildSitemap();
      } catch (err) {
        console.error('Failed to regenerate sitemap:', err);
      }
    });

    // Keep process running
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
