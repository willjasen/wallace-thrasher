'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSuggestionSuccess } = require('../jekyll/assets/js/pull-request-link');

function createDocumentStub() {
  return {
    createElement(tagName) {
      return { tagName, style: {} };
    },
  };
}

function createResultStub() {
  return {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
}

test('renders untrusted suggestion response values as text, never executable markup', () => {
  const result = createResultStub();
  const renderedLink = renderSuggestionSuccess(
    createDocumentStub(),
    result,
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>'
  );

  assert.equal(renderedLink, false);
  assert.equal(
    result.textContent,
    'Thank you! Suggestion submitted: The pull request link could not be verified.'
  );
  assert.deepEqual(result.children, []);
});

test('renders a verified suggestion response with a safely constructed link', () => {
  const result = createResultStub();
  const renderedLink = renderSuggestionSuccess(
    createDocumentStub(),
    result,
    'https://github.com/willjasen/wallace-thrasher/pull/42',
    42
  );

  assert.equal(renderedLink, true);
  assert.equal(result.textContent, 'Thank you! Suggestion submitted: ');
  assert.equal(result.children.length, 1);
  assert.equal(result.children[0].href, 'https://github.com/willjasen/wallace-thrasher/pull/42');
  assert.equal(result.children[0].textContent, 'PR #42 🔗');
  assert.equal(result.children[0].rel, 'noopener noreferrer');
});
