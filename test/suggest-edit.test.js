'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, createBranchOnFork } = require('../netlify/functions/suggest-edit');

function submit(body) {
  return handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      album_slug: 'test-album',
      track_slug: 'test-track',
      _hp: '',
      ...body,
    }),
  });
}

test('accepts the Track payload sent by the subtitle page', async () => {
  const response = await submit({
    edit_type: 'Track',
    edits: [{ index: 1, speaker: 'Woman #1', text: 'Updated subtitle' }],
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /Please sign in with GitHub/);
});

test('accepts punctuation used by existing speaker labels', async () => {
  for (const speaker of ["Joe's Records, STL", 'LPC/Arthur', 'Rod (UPS)', '?']) {
    const response = await submit({
      edit_type: 'Speaker',
      edits: [{ index: 1, new_value: speaker }],
    });

    assert.equal(response.statusCode, 401, speaker);
  }
});

test('rejects blank and control-character speaker labels', async () => {
  for (const speaker of ['   ', 'speaker\nname']) {
    const response = await submit({
      edit_type: 'Track',
      edits: [{ index: 1, speaker }],
    });

    assert.equal(response.statusCode, 400, JSON.stringify(speaker));
    assert.match(response.body, /Invalid speaker value/);
  }
});

test('rejects the obsolete TrackLine edit type', async () => {
  const response = await submit({
    edit_type: 'TrackLine',
    edits: [{ index: 1, text: 'Updated subtitle' }],
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /Invalid edit_type/);
});

test('creates and updates a suggestion branch without modifying the fork main branch', async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  t.after(() => { global.fetch = originalFetch; });

  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/git/ref/heads/main')) {
      return { ok: true, json: async () => ({ object: { sha: 'fork-base-sha' } }) };
    }
    if (url.endsWith('/git/refs')) {
      return { ok: true, json: async () => ({ ref: 'refs/heads/suggest/test' }) };
    }
    if (url.endsWith('/merges')) {
      // GitHub returns an empty 204 response when the branch is already current.
      return { ok: true, status: 204 };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await createBranchOnFork('token', 'contributor', 'wallace-thrasher', 'suggest/test');

  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /contributor\/wallace-thrasher\/git\/ref\/heads\/main$/);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    ref: 'refs/heads/suggest/test',
    sha: 'fork-base-sha',
  });
  assert.match(requests[2].url, /contributor\/wallace-thrasher\/merges$/);
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    base: 'suggest/test',
    head: 'willjasen:main',
  });
});
