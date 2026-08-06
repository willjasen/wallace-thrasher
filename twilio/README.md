# Stretchie Twilio hotline

This folder is the local source of truth for the Twilio configuration behind
the Stretchie hotline. Its Function source, documentation, and deployed audio
assets are tracked by Git. Local credentials belong only in `.env`, which is
ignored by Git and must never be committed.

## Contents

- `welcome-function.js` mirrors the deployed Twilio `/welcome` Function.
- `token-function.js` mirrors the public `/token` Function used by the website's
  browser caller. It issues short-lived Voice SDK tokens and never exposes the
  API secret to the browser.
- `audio/` contains the ambient sound assets deployed with the Function.
- [`audio/SOURCES.md`](audio/SOURCES.md) records the origin, creator, license,
  and relevant attribution for every ambient sound file.
- `package.json` records dependencies used by the Twilio service.

## Keeping audio synchronized

Treat `audio/` and `audio/SOURCES.md` as one unit. Whenever an audio file is
added, replaced, renamed, or removed:

1. Make the corresponding change in `audio/`.
2. Update `audio/SOURCES.md` in the same change. Every deployed file must have
   a source entry, and the source list must not describe files that are absent.
3. Update the `ambientSounds` array in `welcome-function.js` if the set of selectable
   ambient cues changed.
4. Upload or remove the matching Twilio Asset and deploy the service.
5. Verify that the local file names, source records, Function references, and
   deployed Twilio Assets agree exactly.

Keep `audio/` clean: files not referenced by the active `ambientSounds` list should
not remain in the local audio directory. After every audio or Function change,
compare the directory with `ambientSounds`, remove unused local audio, remove its
obsolete source entry, and remove the corresponding deployed Twilio Asset when
it is no longer referenced. Preserve a recoverable or archival master outside
the deployed `audio/` directory only when it still has a documented purpose.

Do not add audio whose usage rights are unknown. Preserve creator attribution,
the source page or recording identifier, and the license in `SOURCES.md`.

## Audio quality and licensing

Preserve the highest-quality lawful source available. Keep a lossless master at
its native sample rate when one is available, and derive the deployed call
asset from that master. Do not permanently reduce the only local copy to a
narrowband telephone rendition, and do not upsample a low-resolution recording
and describe it as higher quality.

Choose the deployed format for the best codec and call path the service is
verified to support. Prefer a lossless Twilio-supported format such as WAV when
it materially preserves wideband or higher-quality playback; create a separate
narrowband rendition only when the destination requires it. Twilio may still
transcode playback to the format negotiated by the telephone network, so test
quality over the actual supported call paths rather than assuming every PSTN
call is high definition.

Ambient cues should normally be 2–3 seconds long. Keep a shorter natural
one-shot only when extending it would make the sound artificial; otherwise trim
long recordings to a representative 2–3 second excerpt. The current HQ call
assets are 2.5-second, 16 kHz mono PCM WAV files.

Only use recordings with rights that permit this project, including commercial
use. Approved examples are CC0, CC BY with complete attribution, and the Mixkit
Sound Effects Free License. Do not use CC BY-NC, editorial-only, personal-use-
only, unidentified, or otherwise incompatible material. Verify the license at
the original source before adding or deploying a recording; if its rights
cannot be confirmed, exclude it.

## Deployment

Changes to `welcome-function.js` or the audio assets are incomplete until they
are saved and deployed to the Twilio service. After deployment, verify that the
Twilio editor matches `welcome-function.js`, the latest version is deployed,
and every file referenced by the `ambientSounds` array exists as a Twilio Asset.

The browser caller also requires a TwiML App whose Voice URL is the deployed
`/welcome` Function. Its SID is stored as `TWIML_APP_SID` in the Twilio
environment, alongside `TWILIO_API_KEY` and `TWILIO_API_SECRET`. Deploy
`token-function.js` as the public `/token` route whenever it changes.
Set `WEB_CALL_IDENTITY_SECRET` to a stable, randomly generated secret of at
least 32 bytes. The token Function uses it to create an HMAC-SHA256 identity
from the browser's anonymous caller ID. The original ID is not placed in the
Voice token or saved in Sync. Rotating this secret resets all web caller
identities and their associated cooldown history.

The same randomly generated `WEB_CALL_PROXY_SECRET` must be configured for the
Netlify Functions runtime and the Twilio environment. The website requests its
token from the same-origin `web-call-token` Netlify Edge Function, which applies
Netlify's IP-based request limit and authenticates its request to Twilio with
this secret. The public Twilio `/token` route rejects direct, unauthenticated
calls.

Twilio's supported playback formats and transcoding guidance are documented in
the [TwiML `Play` reference](https://www.twilio.com/docs/voice/twiml/play).
