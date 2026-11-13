(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WallaceThrasherPullRequestLink = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPullRequestLink(doc, url, number) {
    if (typeof url !== 'string' || !Number.isSafeInteger(number) || number < 1) return null;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return null;
    }

    const match = parsedUrl.pathname.match(/^\/willjasen\/wallace-thrasher\/pull\/([1-9]\d*)\/?$/);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'github.com' ||
      parsedUrl.port ||
      parsedUrl.username ||
      parsedUrl.password ||
      !match ||
      match[1] !== String(number)
    ) {
      return null;
    }

    const link = doc.createElement('a');
    link.href = `https://github.com/willjasen/wallace-thrasher/pull/${number}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `PR #${number} 🔗`;
    return link;
  }

  function renderSuggestionSuccess(doc, target, url, number) {
    target.textContent = 'Thank you! Suggestion submitted: ';
    const link = createPullRequestLink(doc, url, number);
    if (!link) {
      target.textContent += 'The pull request link could not be verified.';
      return false;
    }

    link.style.color = 'greenyellow';
    link.style.textDecoration = 'underline';
    link.style.fontWeight = 'bold';
    target.appendChild(link);
    return true;
  }

  return { renderSuggestionSuccess };
});
