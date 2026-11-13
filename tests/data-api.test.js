const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const apiSource = fs.readFileSync(
  path.join(__dirname, '..', 'jekyll', 'assets', 'js', 'data-api.js'),
  'utf8'
);

const fixture = {
  Albums: [{
    Album: 'Test Album',
    Album_Slug: 'test-album',
    Year: 2001,
    Tracks: [{
      Track_Title: 'Test Track',
      Track_Slug: 'test-track',
      Aliases: ['Stretchie'],
      Establishments: ['UPS'],
      Subtitles: [
        { Index: 1, Speaker: 'Alex Trebek', Text: 'Hello there.' },
        { Index: 2, Speaker: 'LPC', Text: 'A parcel for you.' }
      ]
    }]
  }]
};

function makeApi() {
  let fetchCount = 0;
  const context = {
    document: {
      currentScript: {
        dataset: {
          source: '/base/assets/json/data.combined.json',
          cacheVersion: '123'
        }
      }
    },
    fetch: async (url) => {
      fetchCount += 1;
      assert.equal(url, '/base/assets/json/data.combined.json');
      return {
        ok: true,
        status: 200,
        json: async () => fixture
      };
    }
  };
  vm.runInNewContext(apiSource, context);
  return { api: context.WallaceThrasherAPI, fetchCount: () => fetchCount };
}

test('uses data.combined.json once for concurrent and subsequent queries', async () => {
  const { api, fetchCount } = makeApi();
  const [albums, track, stats] = await Promise.all([
    api.getAlbums(),
    api.getTrack('test-album', 'test-track'),
    api.getStats()
  ]);

  assert.equal(fetchCount(), 1);
  assert.equal(albums[0].Album, 'Test Album');
  assert.equal(track.track.Track_Title, 'Test Track');
  assert.deepEqual({ ...stats }, { albums: 1, tracks: 1, subtitles: 2 });
});

test('queries every public resource from the combined dataset', async () => {
  const { api } = makeApi();

  assert.equal((await api.getTracks({ query: 'track' })).length, 1);
  assert.equal((await api.getSubtitles({ query: 'parcel' }))[0].subtitle.Index, 2);
  assert.deepEqual(Array.from(await api.getSpeakers({ query: 'alex' })), ['Alex Trebek']);
  assert.deepEqual(Array.from(await api.getAliases()), ['Stretchie']);
  assert.deepEqual(Array.from(await api.getEstablishments()), ['UPS']);
  assert.equal(await api.getAlbum('missing'), null);
  assert.equal(await api.getTrack('test-album', 'missing'), null);
});

