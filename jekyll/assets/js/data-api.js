/*
 * Wallace Thrasher browser data API.
 *
 * This is intentionally a read-only client for data.combined.json. Every query
 * below is derived from that one document; no method makes a secondary request.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WallaceThrasherAPI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var script = root.document && root.document.currentScript;
  var source = script && script.dataset.source
    ? script.dataset.source
    : '/assets/json/data.combined.json';
  var cacheVersion = script && script.dataset.cacheVersion
    ? script.dataset.cacheVersion
    : 'unversioned';
  var dataPromise = null;

  function assertResponse(response) {
    if (!response || !response.ok) {
      var status = response && response.status ? ' (' + response.status + ')' : '';
      throw new Error('Unable to load Wallace Thrasher data' + status);
    }
    return response;
  }

  async function fetchDataset() {
    if (!root.fetch) throw new Error('The Fetch API is not available in this browser');

    if (!root.caches) {
      return assertResponse(await root.fetch(source)).json();
    }

    var cacheName = 'wallace-thrasher-' + cacheVersion;
    var cache = await root.caches.open(cacheName);
    var cached = await cache.match(source);
    if (cached) return cached.json();

    var response = assertResponse(await root.fetch(source));
    await cache.put(source, response.clone());

    var keys = await root.caches.keys();
    await Promise.all(keys.map(function (key) {
      if (key !== cacheName && key.indexOf('wallace-thrasher-') === 0) {
        return root.caches.delete(key);
      }
    }));
    return response.json();
  }

  function validate(data) {
    if (!data || !Array.isArray(data.Albums)) {
      throw new Error('Invalid data.combined.json: expected an Albums array');
    }
    return data;
  }

  function load() {
    if (!dataPromise) {
      dataPromise = fetchDataset().then(validate).catch(function (error) {
        dataPromise = null; // A temporary network failure may be retried.
        throw error;
      });
    }
    return dataPromise;
  }

  function norm(value) {
    return String(value == null ? '' : value).trim().toLocaleLowerCase();
  }

  function includes(value, query) {
    return !query || norm(value).indexOf(norm(query)) !== -1;
  }

  function page(items, options) {
    options = options || {};
    var offset = Math.max(0, Number(options.offset) || 0);
    var requestedLimit = options.limit == null ? items.length : Number(options.limit);
    var limit = Math.max(0, Number.isFinite(requestedLimit) ? requestedLimit : items.length);
    return items.slice(offset, offset + limit);
  }

  async function getAlbums(options) {
    options = options || {};
    var data = await load();
    var albums = data.Albums.filter(function (album) {
      return includes(album.Album, options.query) &&
        (options.year == null || String(album.Year) === String(options.year));
    });
    return page(albums, options);
  }

  async function getAlbum(albumSlug) {
    var data = await load();
    return data.Albums.find(function (album) { return album.Album_Slug === albumSlug; }) || null;
  }

  async function getTracks(options) {
    options = options || {};
    var albums = await getAlbums();
    var tracks = [];
    albums.forEach(function (album) {
      if (options.album && album.Album_Slug !== options.album) return;
      (album.Tracks || []).forEach(function (track) {
        if (includes(track.Track_Title, options.query)) {
          tracks.push({ album: album, track: track });
        }
      });
    });
    return page(tracks, options);
  }

  async function getTrack(albumSlug, trackSlug) {
    var album = await getAlbum(albumSlug);
    if (!album) return null;
    var track = (album.Tracks || []).find(function (item) {
      return item.Track_Slug === trackSlug;
    });
    return track ? { album: album, track: track } : null;
  }

  async function getSubtitles(options) {
    options = options || {};
    var tracks = await getTracks({ album: options.album });
    var subtitles = [];
    tracks.forEach(function (entry) {
      if (options.track && entry.track.Track_Slug !== options.track) return;
      (entry.track.Subtitles || []).forEach(function (subtitle) {
        if (includes(subtitle.Speaker, options.speaker) && includes(subtitle.Text, options.query)) {
          subtitles.push({ album: entry.album, track: entry.track, subtitle: subtitle });
        }
      });
    });
    return page(subtitles, options);
  }

  async function getDistinctTrackValues(field, options) {
    options = options || {};
    var tracks = await getTracks({ album: options.album });
    var values = new Set();
    tracks.forEach(function (entry) {
      var list = entry.track[field];
      if (!Array.isArray(list)) list = list ? [list] : [];
      list.forEach(function (value) {
        if (includes(value, options.query)) values.add(value);
      });
    });
    return page(Array.from(values).sort(function (a, b) { return a.localeCompare(b); }), options);
  }

  async function getSpeakers(options) {
    options = options || {};
    var rows = await getSubtitles({ album: options.album, track: options.track });
    var values = new Set();
    rows.forEach(function (row) {
      if (includes(row.subtitle.Speaker, options.query)) values.add(row.subtitle.Speaker);
    });
    return page(Array.from(values).sort(function (a, b) { return a.localeCompare(b); }), options);
  }

  async function getStats() {
    var data = await load();
    var tracks = 0;
    var subtitles = 0;
    data.Albums.forEach(function (album) {
      tracks += (album.Tracks || []).length;
      (album.Tracks || []).forEach(function (track) {
        subtitles += (track.Subtitles || []).length;
      });
    });
    return { albums: data.Albums.length, tracks: tracks, subtitles: subtitles };
  }

  return Object.freeze({
    source: source,
    ready: load,
    getData: load,
    getAlbums: getAlbums,
    getAlbum: getAlbum,
    getTracks: getTracks,
    getTrack: getTrack,
    getSubtitles: getSubtitles,
    getSpeakers: getSpeakers,
    getAliases: function (options) { return getDistinctTrackValues('Aliases', options); },
    getEstablishments: function (options) { return getDistinctTrackValues('Establishments', options); },
    getStats: getStats
  });
});
