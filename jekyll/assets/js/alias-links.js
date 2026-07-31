---
---
// These front-matter lines let Jekyll substitute site.baseurl below.

;(function () {
  if (window.WallaceThrasherAliasLinks) return;

  const BASE_URL = '{{ site.baseurl }}';
  const WORD_CHARACTER = /[\p{L}\p{N}]/u;

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizedEntries(aliases, establishments) {
    const seen = new Set();
    const entries = [];

    [
      { values: aliases, type: 'alias', page: 'aliases', pageLabel: 'Aliases' },
      { values: establishments, type: 'establishment', page: 'establishments', pageLabel: 'Establishments' }
    ].forEach(function (group) {
      (Array.isArray(group.values) ? group.values : []).forEach(function (value) {
        const label = String(value || '').trim();
        const key = label.toLocaleLowerCase();
        if (!label || seen.has(key)) return;
        seen.add(key);
        entries.push({
          label: label,
          type: group.type,
          page: group.page,
          pageLabel: group.pageLabel
        });
      });
    });

    return entries.sort(function (a, b) { return b.label.length - a.label.length; });
  }

  function hasWordBoundary(text, start, end, alias) {
    const firstCharacter = alias.charAt(0);
    const lastCharacter = alias.charAt(alias.length - 1);
    const characterBefore = start > 0 ? text.charAt(start - 1) : '';
    const characterAfter = end < text.length ? text.charAt(end) : '';

    if (WORD_CHARACTER.test(firstCharacter) && WORD_CHARACTER.test(characterBefore)) return false;
    if (WORD_CHARACTER.test(lastCharacter) && WORD_CHARACTER.test(characterAfter)) return false;
    return true;
  }

  function taxonomyUrl(entry) {
    return `${BASE_URL}/${entry.page}/?search=${encodeURIComponent(entry.label)}`;
  }

  function appendLinkedText(container, text, aliases, establishments) {
    const sourceText = String(text || '');
    const entries = normalizedEntries(aliases, establishments);
    if (!sourceText || !entries.length) {
      container.appendChild(document.createTextNode(sourceText));
      return;
    }

    const entriesByLabel = new Map(entries.map(function (entry) {
      return [entry.label.toLocaleLowerCase(), entry];
    }));
    const matcher = new RegExp(entries.map(function (entry) {
      return escapeRegExp(entry.label);
    }).join('|'), 'giu');
    let cursor = 0;
    let match;

    while ((match = matcher.exec(sourceText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const entry = entriesByLabel.get(match[0].toLocaleLowerCase());
      if (!entry || !hasWordBoundary(sourceText, start, end, entry.label)) continue;

      if (start > cursor) {
        container.appendChild(document.createTextNode(sourceText.slice(cursor, start)));
      }

      const link = document.createElement('a');
      link.className = `subtitle-taxonomy-link subtitle-${entry.type}-link`;
      link.href = taxonomyUrl(entry);
      link.dataset[entry.type] = entry.label;
      link.title = `View “${entry.label}” on the ${entry.pageLabel} page`;
      link.textContent = match[0];
      container.appendChild(link);
      cursor = end;
    }

    if (cursor < sourceText.length) {
      container.appendChild(document.createTextNode(sourceText.slice(cursor)));
    }
  }

  function linkSubtitleElements(root, aliases, establishments) {
    if (!root) return;
    root.querySelectorAll('.subtitle-text:not([data-taxonomies-linked])').forEach(function (element) {
      const text = element.textContent;
      element.replaceChildren();
      appendLinkedText(element, text, aliases, establishments);
      element.dataset.taxonomiesLinked = 'true';
    });
  }

  window.WallaceThrasherAliasLinks = {
    appendLinkedText: appendLinkedText,
    linkSubtitleElements: linkSubtitleElements
  };
})();
