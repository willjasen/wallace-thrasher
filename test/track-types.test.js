const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const data = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'jekyll', 'assets', 'json', 'data.json'),
  'utf8'
));

test('only classified tracks have a valid type', () => {
  const tracks = data.Albums.flatMap((album) => album.Tracks);
  const classifiedTracks = tracks.filter((track) => Object.hasOwn(track, 'Track_Type'));

  assert.ok(classifiedTracks.length > 0);
  classifiedTracks.forEach((track) => {
    assert.ok(['call', 'music'].includes(track.Track_Type), `${track.Track_Title} has an invalid Track_Type`);
  });
});

test('LPC medleys are calls and LPC interludes are music', () => {
  const tracks = data.Albums.flatMap((album) => album.Tracks);
  const lpcMedleys = tracks.filter((track) => track.Track_Title.includes('LPC') && track.Track_Title.includes('Medley'));
  const lpcInterludes = tracks.filter((track) => track.Track_Title.includes('LPC') && track.Track_Title.includes('Interlude'));

  lpcMedleys.forEach((track) => {
    assert.equal(track.Track_Type, 'call', `${track.Track_Title} should be call`);
  });

  lpcInterludes.forEach((track) => {
    assert.equal(track.Track_Type, 'music', `${track.Track_Title} should be music`);
  });

  tracks
    .filter((track) => track.Track_Title.includes('Medley') && !track.Track_Title.includes('LPC'))
    .forEach((track) => assert.equal(Object.hasOwn(track, 'Track_Type'), false, `${track.Track_Title} should be unclassified`));
});

test('LPC 7 medley examples have the expected types', () => {
  const album = data.Albums.find((item) => item.Album === 'Longmont Potion Castle 7');
  const trackType = (title) => album.Tracks.find((track) => track.Track_Title === title).Track_Type;

  assert.equal(trackType('LPC 7 Medley 1'), 'call');
  assert.equal(trackType('LPC 7 Medley 2'), 'call');
});
