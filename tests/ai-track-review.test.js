'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { handler, extractOutputText } = require('../netlify/functions/ai-track-review');

const OAUTH_SECRET = 'test-oauth-secret';
const transcript = [
  { index: 1, speaker: 'LPC', text: 'Hello' },
  { index: 2, speaker: 'Caller', text: 'Goodbye' },
];

function signedAuth() {
  const login = 'editor';
  const exp = Date.now() + 60_000;
  const jti = 'test-token-id';
  const token_enc = 'test-encrypted-token';
  const sigKey = Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(OAUTH_SECRET, 'utf8'),
    Buffer.from('wt-oauth-v1', 'utf8'),
    Buffer.from('sign', 'utf8'),
    32
  ));
  const sig = crypto.createHmac('sha256', sigKey)
    .update(`${login}|${exp}|${jti}|${token_enc}`)
    .digest('hex');
  return { login, exp, jti, token_enc, sig };
}

function configureAi(t) {
  const originalEnv = {
    GITHUB_OAUTH_SECRET: process.env.GITHUB_OAUTH_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
  const originalFetch = global.fetch;
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
  });
  process.env.GITHUB_OAUTH_SECRET = OAUTH_SECRET;
  process.env.OPENAI_API_KEY = 'test-api-key';
  delete process.env.OPENAI_MODEL;
}

function reviewEvent(overrides = {}) {
  return {
    httpMethod: 'POST',
    body: JSON.stringify({ auth: signedAuth(), lines: transcript, ...overrides }),
  };
}

function outputResponse(text, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }),
    text: async () => 'upstream error detail',
  };
}

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

test('validates AI edits against the transcript and returns only meaningful safe changes', async (t) => {
  configureAi(t);
  const result = {
    summary: 'Corrected a speaker label.',
    edits: [
      { index: 1, speaker: 'Caller', text: null, reason: 'The speaker changes.' },
      { index: 2, speaker: null, text: 'Goodbye', reason: 'Unchanged text.' },
      { index: 3, speaker: 'Unknown', text: null, reason: 'Index is absent.' },
      { index: 2, speaker: '   ', text: null, reason: 'Blank labels are invalid.' },
      { index: 2, speaker: null, text: 'x'.repeat(1001), reason: 'Text is too long.' },
      { index: 2, speaker: null, text: 'Farewell', reason: 'A supported text correction.' },
    ],
  };
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return outputResponse(JSON.stringify(result));
  };

  const response = await handler(reviewEvent({ instruction: '  Check speaker labels.  ' }));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    summary: result.summary,
    edits: [
      { index: 1, speaker: 'Caller', text: null, reason: 'The speaker changes.' },
      { index: 2, speaker: null, text: 'Farewell', reason: 'A supported text correction.' },
    ],
  });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer test-api-key');
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.model, 'gpt-5-mini');
  assert.equal(payload.store, false);
  assert.match(payload.input, /Editor request: Check speaker labels\./);
});

test('returns a controlled error for malformed AI output', async (t) => {
  configureAi(t);
  global.fetch = async () => outputResponse('not JSON');

  const response = await handler(reviewEvent());

  assert.equal(response.statusCode, 502);
  assert.match(response.body, /invalid result/i);
});

test('returns a controlled error when the AI provider rejects the request', async (t) => {
  configureAi(t);
  global.fetch = async () => outputResponse('', { ok: false, status: 429 });

  const response = await handler(reviewEvent());

  assert.equal(response.statusCode, 502);
  assert.match(response.body, /could not be completed/i);
  assert.doesNotMatch(response.body, /upstream error detail/);
});

test('returns a temporary-unavailable error when the AI request cannot be sent', async (t) => {
  configureAi(t);
  global.fetch = async () => { throw new Error('network unavailable'); };

  const response = await handler(reviewEvent());

  assert.equal(response.statusCode, 502);
  assert.match(response.body, /temporarily unavailable/i);
});
