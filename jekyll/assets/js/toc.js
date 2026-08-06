(function () {
  var script = document.currentScript;
  var config = script && script.dataset;
  if (!config || !config.tocId) return;

  var tocId = config.tocId;
  var bodyClass = config.tocClass || tocId + '-page';
  var title = config.tocTitle || 'Contents';

  // Unicode property escapes cover pictographs, symbols, flags, modifiers,
  // and variation selectors without leaving emoji behind in the TOC.
  function tocText(text) {
    return text
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\uFE0E\uFE0F\u200D]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function slugify(text) {
    return tocText(text).toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  function removeTOC() {
    var existing = document.getElementById(tocId);
    if (existing) {
      if (existing.cleanup) existing.cleanup();
      existing.remove();
    }
    document.body.classList.remove(bodyClass);
  }

  function buildTOC() {
    removeTOC();
    var content = document.querySelector('.post-content') || document.querySelector('.page-content .wrapper');
    if (!content) return;

    var headings = Array.from(content.querySelectorAll('h3'));
    if (!headings.length) return;

    var nav = document.createElement('nav');
    nav.id = tocId;
    nav.setAttribute('aria-label', 'Page sections');
    var label = document.createElement('div');
    label.id = tocId + '-label';
    label.textContent = title;
    nav.appendChild(label);
    var list = document.createElement('ul');

    headings.forEach(function (heading, index) {
      if (!heading.id) heading.id = slugify(heading.textContent) || tocId + '-section-' + index;
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + heading.id;
      link.dataset.targetId = heading.id;
      link.textContent = tocText(heading.textContent);
      link.addEventListener('click', function (event) {
        event.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth' });
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    nav.appendChild(list);
    document.body.appendChild(nav);
    document.body.classList.add(bodyClass);

    function updateActiveLink() {
      var active = headings[0];
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        active = headings[headings.length - 1];
      } else {
        headings.forEach(function (heading) {
          if (heading.getBoundingClientRect().top <= window.innerHeight * 0.2) active = heading;
        });
      }
      list.querySelectorAll('a').forEach(function (link) {
        link.classList.toggle('active', link.dataset.targetId === active.id);
      });
    }

    var queued = false;
    function queueActiveLinkUpdate() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        updateActiveLink();
      });
    }
    window.addEventListener('scroll', queueActiveLinkUpdate, { passive: true });
    window.addEventListener('resize', queueActiveLinkUpdate);
    updateActiveLink();
    nav.cleanup = function () {
      window.removeEventListener('scroll', queueActiveLinkUpdate);
      window.removeEventListener('resize', queueActiveLinkUpdate);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildTOC);
  else buildTOC();

  document.addEventListener('soft-nav', function onSoftNav(event) {
    var url = (event.detail && event.detail.url) || '';
    var path = new URL(url || location.href, location.href).pathname;
    if (!path.match(new RegExp('/' + tocId.replace(/-toc$/, '') + '/?$'))) {
      removeTOC();
      document.removeEventListener('soft-nav', onSoftNav);
    }
  });
})();
