/* Resolve catalog USB paths against the files selected by the visitor. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LpcFileResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u2010-\u2015]/g, '-')
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ');
  }

  function loose(value) {
    return normalize(value).replace(/[^a-z0-9]/g, '');
  }

  function uniqueMatch(entries, albumDirectory, filename, normalizer) {
    var wantedAlbum = normalizer(albumDirectory);
    var wantedFile = normalizer(filename);
    var matches = entries.filter(function (entry) {
      var parts = entry[0].split('/');
      if (parts.length < 2) return false;
      return normalizer(parts[parts.length - 2]) === wantedAlbum &&
        normalizer(parts[parts.length - 1]) === wantedFile;
    });
    return matches.length === 1 ? matches[0][1] : null;
  }

  function resolve(fileMap, albumDirectory, filename) {
    if (!fileMap || !albumDirectory || !filename) return null;

    var expected = 'LPC USB/' + albumDirectory + '/' + filename;
    if (fileMap[expected]) return fileMap[expected];

    var entries = Object.entries(fileMap);
    return uniqueMatch(entries, albumDirectory, filename, normalize) ||
      uniqueMatch(entries, albumDirectory, filename, loose);
  }

  return { resolve: resolve, normalize: normalize };
});
