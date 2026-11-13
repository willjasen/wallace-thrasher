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

function makeApi({ data = fixture, fetchImpl } = {}) {
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
      if (fetchImpl) return fetchImpl(url, fetchCount);
      return {
        ok: true,
        status: 200,
        json: async () => data
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

test('applies album, track, subtitle, and pagination filters before slicing results', async () => {
  const data = {
    Albums: [
      {
        Album: 'First Album',
        Album_Slug: 'first-album',
        Year: 2001,
        Tracks: [
          {
            Track_Title: 'First Track',
            Track_Slug: 'first-track',
            Subtitles: [
              { Index: 1, Speaker: 'Alex', Text: 'First line.' },
              { Index: 2, Speaker: 'Bea', Text: 'Second line.' }
            ]
          },
          {
            Track_Title: 'Second Track',
            Track_Slug: 'second-track',
            Subtitles: [
              { Index: 3, Speaker: 'Alex', Text: 'Parcel arrived.' }
            ]
          }
        ]
      },
      {
        Album: 'Second Album',
        Album_Slug: 'second-album',
        Year: 2002,
        Tracks: [{
          Track_Title: 'Third Track',
          Track_Slug: 'third-track',
          Subtitles: [{ Index: 4, Speaker: 'Alex', Text: 'Other album.' }]
        }]
      }
    ]
  };
  const { api } = makeApi({ data });

  assert.deepEqual(
    Array.from(await api.getAlbums({ query: 'album', limit: 1, offset: 1 }), album => album.Album_Slug),
    ['second-album']
  );
  assert.deepEqual(
    Array.from(
      await api.getTracks({ album: 'first-album', query: 'track', limit: 1, offset: 1 }),
      entry => entry.track.Track_Slug
    ),
    ['second-track']
  );
  assert.deepEqual(
    Array.from(await api.getSubtitles({
        album: 'first-album',
        track: 'second-track',
        speaker: 'alex',
        query: 'parcel'
      }),
      entry => entry.subtitle.Index
    ),
    [3]
  );
});

test('returns sorted unique metadata values after applying a case-insensitive query', async () => {
  const data = {
    Albums: [{
      Album: 'Metadata Album',
      Album_Slug: 'metadata-album',
      Tracks: [
        { Track_Title: 'One', Aliases: ['Zed', 'Shared'], Establishments: ['UPS'] },
        { Track_Title: 'Two', Aliases: ['Able', 'Shared'], Establishments: ['Cafe', 'UPS'] }
      ]
    }]
  };
  const { api } = makeApi({ data });

  assert.deepEqual(Array.from(await api.getAliases()), ['Able', 'Shared', 'Zed']);
  assert.deepEqual(Array.from(await api.getEstablishments({ query: 'up' })), ['UPS']);
});

test('retries a transient dataset fetch failure', async () => {
  const { api, fetchCount } = makeApi({
    fetchImpl: async (_url, attempt) => {
      if (attempt === 1) throw new Error('temporary network failure');
      return { ok: true, status: 200, json: async () => fixture };
    }
  });

  await assert.rejects(api.ready(), /temporary network failure/);
  assert.deepEqual({ ...await api.getStats() }, { albums: 1, tracks: 1, subtitles: 2 });
  assert.equal(fetchCount(), 2);
});

test('rejects a dataset with an invalid shape', async () => {
  const { api } = makeApi({ data: { albums: [] } });

  await assert.rejects(api.ready(), /expected an Albums array/);
});
