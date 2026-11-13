const test = require('node:test');
const assert = require('node:assert/strict');
const resolver = require('../jekyll/assets/js/lpc-file-resolver.js');

test('resolves the exact catalog path', () => {
  const files = { 'LPC USB/1988 - Longmont Potion Castle/Brian.mp3': 'blob:exact' };
  assert.equal(resolver.resolve(files, '1988 - Longmont Potion Castle', 'Brian.mp3'), 'blob:exact');
});

test('resolves case and Unicode punctuation differences', () => {
  const files = { "My USB/2024 – Best Before ‘24/TRACK ONE.MP3": 'blob:normalized' };
  assert.equal(resolver.resolve(files, "2024 - Best Before '24", 'Track One.mp3'), 'blob:normalized');
});

test('resolves harmless punctuation differences without guessing ambiguous files', () => {
  const files = { 'LPC USB/2001 - LPC 4/I Dont Know, Brother.mp3': 'blob:loose' };
  assert.equal(resolver.resolve(files, '2001 - LPC 4', "I Don't Know Brother.mp3"), 'blob:loose');

  files['Backup/2001 - LPC 4/I-Dont Know Brother.mp3'] = 'blob:duplicate';
  assert.equal(resolver.resolve(files, '2001 - LPC 4', "I Don't Know Brother.mp3"), null);
});

test('does not match a track from a different album', () => {
  const files = { 'LPC USB/Other Album/Brian.mp3': 'blob:wrong' };
  assert.equal(resolver.resolve(files, '1988 - Longmont Potion Castle', 'Brian.mp3'), null);
});
