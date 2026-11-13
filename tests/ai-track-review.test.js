'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, extractOutputText } = require('../netlify/functions/ai-track-review');

test('extracts structured response text', () => {
  assert.equal(extractOutputText({ output: [{ type: 'message', content: [
    { type: 'output_text', text: '{"edits":[]}' },
  ] }] }), '{"edits":[]}');
});

test('requires a signed-in editor before invoking AI', async () => {
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error('must not call API'); };
  try {
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ lines: [{ index: 1, speaker: 'LPC', text: 'Hello' }] }),
    });
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /sign in with GitHub/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('does not trust an auth-shaped but unsigned request', async () => {
  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ auth: {}, lines: new Array(501).fill({ index: 1, speaker: 'LPC', text: 'Hi' }) }),
  });
  assert.equal(response.statusCode, 401);
});
