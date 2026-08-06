# Twilio workspace instructions

- Treat `welcome-function.js` and `audio/` as the local source of truth for the
  deployed Twilio service.
- Always deploy Twilio Function or Asset changes and verify the latest Twilio
  build is deployed before reporting completion.
- Deployment authorization is standing: after creating a build, check its
  progress until it completes, activate it when necessary, and verify that the
  live Twilio environment points to the activated build without asking for
  separate confirmation each time.
- Keep `audio/`, `audio/SOURCES.md`, the `ambientSounds` array in
  `welcome-function.js`, and deployed Twilio Assets synchronized.
- For every audio addition, replacement, rename, or removal, update
  `audio/SOURCES.md` in the same task. Each audio file must have exactly one
  accurate source entry, and no source entry may refer to a missing file.
- Record the source, creator when available, recording or catalog identifier,
  license, and required attribution for each audio asset. Do not use audio with
  unknown usage rights.
- Before using an audio asset, verify at its original source that its license
  permits this project and commercial use. CC0, correctly attributed CC BY, and
  the Mixkit Sound Effects Free License are acceptable. Exclude CC BY-NC,
  editorial-only, personal-use-only, unidentified, or incompatible material.
- Preserve a lossless master at its native sample rate when available. Derive
  call assets from that master, never label upsampled low-resolution audio as
  high quality, and do not replace the only master with a narrowband copy.
- Use the highest-quality Twilio-supported format justified by the verified
  codec and call path. Prefer lossless WAV for wideband or higher-quality paths
  when appropriate, while retaining separate narrowband renditions only where
  required. Test over the real call path because Twilio may transcode playback.
- Keep ambient call cues between 2 and 3 seconds when practical. Prefer a
  representative 2.5-second excerpt; retain a shorter duration only for a
  natural one-shot that would sound artificial if extended. Record the deployed
  duration and technical format in `audio/SOURCES.md`.
- After audio changes, verify the filenames listed in `audio/SOURCES.md` and
  `welcome-function.js` against the files in `audio/` and the deployed Assets.
- Keep `audio/` limited to files referenced by the active `ambientSounds` list. After
  every Function or audio change, remove unreferenced local audio, delete stale
  `audio/SOURCES.md` entries, and remove corresponding unreferenced Twilio
  Assets. Keep archival masters outside the deployed `audio/` directory and
  document why they are retained.
