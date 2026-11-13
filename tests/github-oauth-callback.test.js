'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { handler } = require('../netlify/functions/github-oauth-callback');

const OAUTH_SECRET = 'test-oauth-secret';

function configureOAuth(t) {
  const originalEnv = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_OAUTH_SECRET: process.env.GITHUB_OAUTH_SECRET,
  };
  const originalFetch = global.fetch;
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
  });
  process.env.GITHUB_CLIENT_ID = 'test-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
  process.env.GITHUB_OAUTH_SECRET = OAUTH_SECRET;
}

function callbackEvent({ code = 'oauth-code', returnUrl = '/track/test' } = {}) {
  return {
    queryStringParameters: {
      code,
      state: encodeURIComponent(JSON.stringify({ returnUrl })),
    },
  };
}

function deriveKey(purpose) {
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(OAUTH_SECRET, 'utf8'),
    Buffer.from('wt-oauth-v1', 'utf8'),
    Buffer.from(purpose, 'utf8'),
    32
  ));
}

test('redirects with a signed identity token after successful OAuth', async (t) => {
  configureOAuth(t);
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === 'https://github.com/login/oauth/access_token') {
      return { json: async () => ({ access_token: 'contributor-token' }) };
    }
    if (url === 'https://api.github.com/user') {
      return { json: async () => ({
        login: 'contributor',
        name: 'Contributor',
        avatar_url: 'https://avatars.example/contributor.png',
      }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const before = Date.now();
  const response = await handler(callbackEvent());
  const after = Date.now();
  const location = response.headers.Location;

  assert.equal(response.statusCode, 302);
  assert.ok(location.startsWith('/track/test#wt-identity='));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    code: 'oauth-code',
  });
  assert.equal(requests[1].options.headers.Authorization, 'Bearer contributor-token');

  const identity = JSON.parse(decodeURIComponent(location.split('#wt-identity=')[1]));
  assert.equal(identity.login, 'contributor');
  assert.equal(identity.name, 'Contributor');
  assert.equal(identity.avatar_url, 'https://avatars.example/contributor.png');
  assert.ok(identity.exp >= before + 4 * 60 * 60 * 1000);
  assert.ok(identity.exp <= after + 4 * 60 * 60 * 1000);
  assert.match(identity.jti, /^[a-f0-9]{32}$/);

  const expectedSig = crypto.createHmac('sha256', deriveKey('sign'))
    .update(`${identity.login}|${identity.exp}|${identity.jti}|${identity.token_enc}`)
    .digest('hex');
  assert.equal(identity.sig, expectedSig);

  const [ivHex, encryptedHex, tagHex] = identity.token_enc.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('encrypt'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decryptedToken = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
  assert.equal(decryptedToken, 'contributor-token');
});

test('does not redirect to an external URL when OAuth state has an unsafe return URL', async (t) => {
  configureOAuth(t);
  let fetchCount = 0;
  global.fetch = async () => { fetchCount += 1; };

  const response = await handler(callbackEvent({ code: null, returnUrl: '//evil.example/path' }));

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.Location, '/#wt-auth-error=no_code');
  assert.equal(fetchCount, 0);
});

test('reports configuration and token exchange failures through safe redirects', async (t) => {
  configureOAuth(t);
  delete process.env.GITHUB_CLIENT_SECRET;
  let fetchCount = 0;
  global.fetch = async () => { fetchCount += 1; };

  const configResponse = await handler(callbackEvent());
  assert.equal(configResponse.headers.Location, '/#wt-auth-error=config_error');
  assert.equal(fetchCount, 0);

  process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
  global.fetch = async () => ({
    json: async () => ({ error: 'bad_verification_code' }),
  });
  const exchangeResponse = await handler(callbackEvent({ returnUrl: '/suggestions' }));
  assert.equal(exchangeResponse.headers.Location, '/suggestions#wt-auth-error=token_exchange_failed');
});

test('reports profile lookup failures without issuing an identity token', async (t) => {
  configureOAuth(t);
  global.fetch = async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') {
      return { json: async () => ({ access_token: 'contributor-token' }) };
    }
    return { json: async () => ({}) };
  };

  const response = await handler(callbackEvent());

  assert.equal(response.headers.Location, '/track/test#wt-auth-error=user_fetch_failed');
});
