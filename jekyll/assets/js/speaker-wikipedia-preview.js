(() => {
  if (window._wtSpeakerWikipediaPreviewLoaded) return;
  window._wtSpeakerWikipediaPreviewLoaded = true;

  const summaryCache = new Map();
  let activeLink = null;

  const preview = document.createElement('div');
  preview.id = 'speaker-wikipedia-preview';
  preview.className = 'speaker-wikipedia-preview';
  preview.setAttribute('role', 'tooltip');
  preview.hidden = true;

  const image = document.createElement('img');
  image.alt = '';
  const caption = document.createElement('span');
  preview.append(image, caption);
  document.body.appendChild(preview);

  function articleTitle(link) {
    try {
      const url = new URL(link.href);
      return decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''));
    } catch (_) {
      return '';
    }
  }

  function loadSummary(title) {
    if (!summaryCache.has(title)) {
      const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      summaryCache.set(title, fetch(endpoint).then(response => {
        if (!response.ok) throw new Error('Wikipedia preview unavailable');
        return response.json();
      }).catch(() => null));
    }
    return summaryCache.get(title);
  }

  function positionPreview(link) {
    const rect = link.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    preview.style.width = `${width}px`;
    preview.style.left = `${left}px`;
    preview.style.top = `${rect.bottom + 8}px`;

    const previewRect = preview.getBoundingClientRect();
    if (previewRect.bottom > window.innerHeight - 12 && rect.top > previewRect.height + 8) {
      preview.style.top = `${rect.top - previewRect.height - 8}px`;
    }
  }

  async function showPreview(link) {
    activeLink = link;
    const title = articleTitle(link);
    if (!title) return;
    const summary = await loadSummary(title);
    if (activeLink !== link || !summary || !summary.thumbnail || !summary.thumbnail.source) return;

    image.src = summary.thumbnail.source;
    image.alt = summary.title ? `Wikipedia image for ${summary.title}` : 'Wikipedia article image';
    caption.textContent = `${summary.title || link.textContent} · Wikipedia`;
    preview.hidden = false;
    link.setAttribute('aria-describedby', preview.id);
    positionPreview(link);
  }

  function hidePreview(link) {
    if (link && activeLink !== link) return;
    if (activeLink) activeLink.removeAttribute('aria-describedby');
    activeLink = null;
    preview.hidden = true;
  }

  document.addEventListener('pointerover', event => {
    const link = event.target.closest('.speaker-wikipedia-link');
    if (link) showPreview(link);
  });
  document.addEventListener('pointerout', event => {
    const link = event.target.closest('.speaker-wikipedia-link');
    if (link && !link.contains(event.relatedTarget)) hidePreview(link);
  });
  document.addEventListener('focusin', event => {
    const link = event.target.closest('.speaker-wikipedia-link');
    if (link) showPreview(link);
  });
  document.addEventListener('focusout', event => {
    const link = event.target.closest('.speaker-wikipedia-link');
    if (link) hidePreview(link);
  });
  window.addEventListener('scroll', () => hidePreview(), { passive: true });
  window.addEventListener('resize', () => hidePreview());
})();
