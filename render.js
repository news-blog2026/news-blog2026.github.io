(function () {
  const container = document.querySelector('.stories');
  if (!container) return;

  const pageTopic = document.body.dataset.topic || 'all';
  const stories = (window.STORIES || []).filter(story => {
    if (pageTopic === 'all') return true;
    return story.topic === pageTopic;
  });

  const createCard = (story) => {
    const article = document.createElement('article');
    article.className = 'story-card';

    const label = document.createElement('span');
    label.className = `label ${story.topic}`;
    label.textContent = story.label;

    const content = document.createElement('div');
    const headline = document.createElement('h3');
    const link = document.createElement('a');
    link.href = story.url;
    link.textContent = story.title;
    headline.appendChild(link);

    const summary = document.createElement('p');
    summary.textContent = story.summary;

    content.appendChild(headline);
    content.appendChild(summary);

    const meta = document.createElement('div');
    meta.className = 'meta';
    if (story.author) {
      meta.innerHTML = `<span>${story.author}</span><span>${story.date}</span>`;
    } else {
      meta.innerHTML = `<span>${story.date}</span>`;
    }

    article.appendChild(label);
    article.appendChild(content);
    article.appendChild(meta);

    return article;
  };

  container.innerHTML = '';
  stories.forEach(story => container.appendChild(createCard(story)));

  // Add JSON-LD structured data for SEO
  const existingLd = document.getElementById('jsonld-stories');
  if (existingLd) existingLd.remove();

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": stories.map((story, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "NewsArticle",
        headline: story.title,
        url: new URL(story.url, location.href).href,
        datePublished: story.date,
        ...(story.author ? {
          author: {
            "@type": "Person",
            name: story.author,
          },
        } : {}),
        description: story.summary,
      },
    })),
  };

  const script = document.createElement('script');
  script.id = 'jsonld-stories';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ld, null, 2);
  document.head.appendChild(script);
})();
