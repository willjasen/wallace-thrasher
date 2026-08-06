# wallace-thrasher

a website project involving the works of [longmont potion castle](https://en.wikipedia.org/wiki/Longmont_Potion_Castle)

*you can call me stretchie*

### 🧭 Overview 🧭

this website allows for searching through data like subtitles within the longmont potion castle discography.

for help on how to use the web app, refer to the [instructions](https://stretchie.net/instructions) page.

this website can currently be viewed at:

- primary domain --> [stretchie.net](https://stretchie.net)

### 🎮 Features 🎮

there are four main features of various interests implemented:

- its basic feature is that albums and tracks have pages with the track pages containing the subtitles for the track
- its smart feature is that all of this aforementioned data is indexed so that search becomes possible
- its neat feature is that the lpc usb collection can be uploaded into the site and then tracks can be easily played, as well as one can jump into a track at the point of when a certain subtitle line is spoken.
- its thoughtful feature is that the website runs locally within the browser (there is no remote backend database that executes the searches)

### 📘 Backstory 📘

some time ago, i wanted to know one question - how many calls does [alex trebek](https://stretchie.net/alex-trebek/) show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that have detailed info about albums, tracks, their subtitles, and other info, however its data isn't structured in a formal way and therefore is not indexedable in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### 🫡 A Pledge 🫡

when i began the venture of creating this magnificent package, i pledged that i would not monetize the website, and i still have no intentions of doing so. i created this as an effort of love for the works involved here and as a challenge to myself. it is the best homage that i can contribute to this little weird corner of the universe.

### 🤖 Disclosure 🤖

this project uses both local and cloud-based ai tools.

[whisper-webui](https://github.com/jhj0517/Whisper-WebUI) runs locally to transcribe LPC audio tracks and provide speaker diarization. additionally, running the ai model locally avoids sharing the LPC audio tracks with third-parties.

cloud ai tools like ChatGPT Work have been used to code, review, and improve the code of stretchie.

furthermore, it has been my stance that ai is both good and bad - i believe that these tools can be used in good, productive ways while acknowleding problems like ai slop and misinformation.

### 🔎 Comparing Subtitles with Talkin' Whipapedia 🔎

`python/wiki_scrape_and_merge.py` downloads wiki transcripts into snapshots identified by a 13-digit Unix timestamp, aligns them with this project's timestamped JSON subtitles, and prepares speaker and text corrections for review. Generated data has one consistent layout:

```text
analysis/wiki/
├── scrapes/<unix-timestamp>/
├── comparisons/<unix-timestamp>/
├── merge-backups/<unix-timestamp>/
├── legacy-cache/                 # optional pre-snapshot data
└── latest-scrape
```

The comparison directory uses the same timestamp as its source scrape. The script uses only the Python 3.10+ standard library.

Run the workflow from the project root:

```bash
python3 python/wiki_scrape_and_merge.py scrape --album longmont-potion-castle-4
python3 python/wiki_scrape_and_merge.py compare --album longmont-potion-castle-4
python3 python/wiki_scrape_and_merge.py report --album longmont-potion-castle-4 --detail
python3 python/wiki_scrape_and_merge.py merge --album longmont-potion-castle-4 --dry-run
python3 python/wiki_scrape_and_merge.py merge --album longmont-potion-castle-4
```

Use `--track <track-slug>` with `scrape`, `compare`, `report`, or `merge` to work on one track. Text marked `review` is never merged automatically; change its `text_action` to `approved` in the comparison JSON after checking it. A real merge refuses comparison results made from an older version of a subtitle file, so rerun `compare` rather than bypassing that check. Every changed file is copied to `analysis/wiki/merge-backups/<unix-timestamp>/` before it is written.

Aliases and organizations can be reconciled separately from Talkin' Whipapedia's maintained index pages. The importer uses explicit wiki track groupings first, then searches album-scoped local transcripts for aliases and the full local catalog for otherwise-unassociated organizations:

```bash
python3 python/wiki_metadata_merge.py --dry-run
python3 python/wiki_metadata_merge.py --write
```

The project continues to call organizations `Establishments`. Each imported organization retains the wiki's `real-world` or `created` classification in `Establishment_Types`; entries found only in the wiki's unclassified “Just a big list” use `unspecified`. `Talkin_Whipapedia` records the values added by the importer so later runs can update or remove stale imports without disturbing hand-maintained metadata. The source material is available under CC BY-SA from [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/wiki/Home#Navigation).

### 🎙️ Local transcript analysis 🎙️

tracks on the LPC USB can be analyzed through a locally hosted Whisper-WebUI over HTTP or HTTPS. the workflow resolves a track from its album and track slugs, reviews its `Track_Type`, enables speaker diarization, and saves a review bundle under `analysis/whisper-webui/`. tracks classified as `music` automatically enable Whisper-WebUI's background music remover before transcription; `call` and unclassified tracks use the original audio. the selected type and preprocessing choice are recorded in the run manifest. the analysis directory is intentionally ignored by git, and no transcript changes are applied to the site automatically.

set `WHISPER_WEBUI_URL` to the reachable Whisper-WebUI base URL, then run:

```shell
python3 python/lpc_whisper_analysis.py analyze \
  --album longmont-potion-castle-12 \
  --track game-stop \
  --usb-root "/Volumes/LPC USB"
```

the client supports Whisper-WebUI's polling REST API and its Gradio browser API. optional Basic Auth can be supplied with `WHISPER_WEBUI_USERNAME` and `WHISPER_WEBUI_PASSWORD`. if the diarization model still needs authorization, supply `HF_TOKEN`. these values can be placed in the repository's git-ignored `.env` file instead of being entered on the command line; credentials are never written to analysis artifacts. use `--insecure` only for a trusted local deployment with a self-signed certificate.

an existing diarized SRT generated manually in Whisper-WebUI can be imported without running the model again:

```shell
python3 python/lpc_whisper_analysis.py import-srt \
  --album longmont-potion-castle-12 \
  --track game-stop \
  /path/to/game-stop.srt
```

each completed bundle includes the original SRT, normalized segments, repository-shaped candidate subtitles, suggested mappings from diarized speakers to current speaker names, and review leads for aliases and establishments. these are evidence for manual curation rather than automatic edits. the selected Whisper model is recorded in the ignored run manifest and merge receipts rather than in each public `data.json` track.

compare a completed analysis with both `data.json` and the current track subtitle JSON:

```shell
python3 python/whisper_compare_and_merge.py compare \
  --album longmont-potion-castle-7 \
  --track alex-trebek

python3 python/whisper_compare_and_merge.py report \
  --album longmont-potion-castle-7 \
  --track alex-trebek

python3 python/whisper_compare_and_merge.py merge --dry-run \
  --album longmont-potion-castle-7 \
  --track alex-trebek
```

the comparison is written as `comparison.json` inside the git-ignored analysis run. repository subtitle text and named speakers remain authoritative: Whisper differences use the `review` action and are merged only after that individual action, or an intended speaker mapping, is changed to `approved`. exact mentions of aliases or establishments already known elsewhere in the catalog use `auto_add`. a real merge validates hashes for the analysis artifacts, `data.json`, and the track JSON, then creates ignored backups under `analysis/whisper-webui/merge-backups/` before writing atomically. Detailed Whisper source provenance stays in an ignored `merge-receipts/` file inside the analysis run and is never added to `data.json`; a sanitized public record of the approved outcome is appended to `jekyll/_data/whisper_merges.json` for the `/whisper-data/` page.

subtitle entries may contain a boolean `Reviewed` field. when this field is missing, the merge initializes it from the track's existing `Subtitles_Adjusted` value; an explicitly approved Whisper text or speaker change is always written with `Reviewed: true`. this preserves the repository version by default while recording human review at line level.

### ✍️ How to Contribute ✍️

GitHub users can contribute corrections directly from the website. sign in with GitHub, use the **Suggest edits** option on a track, and submit your changes; the website will create a pull request for review.

### 📋 Attribution 📋

the transcript and subtitle data on this website are merged with data from [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/) and its contributors. that data is used and distributed here under the [Creative Commons Attribution-ShareAlike 3.0 Unported (CC-BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/) license, consistent with the wiki's own licensing.

### 🪪 Licensing & Rights 🪪

this project is **dual-licensed** — the source code and the JSON data are covered by separate licenses.

##### source code — GPLv3

all source code (Ruby plugins, Python scripts, JavaScript, HTML templates, YAML config, etc.) is licensed under the [GPLv3](https://github.com/willjasen/wallace-thrasher/blob/main/gpl-3.0.txt), and this license applies to all past versions and branches of the project. to help best illustrate this licensing, here's a list of what it entails:

1. anyone may copy, modify, and distribute this software *(throw it up and down)*
2. all distributions of this software must include the license and copyright notice always *(otherwise you're gettin' a citation)*
3. anyone may use this software privately *(even during a real hypnotic massage)*
4. anyone may use this software for commercial purposes *(cave of the winds might find it useful)*
6. if changes are made to the code, those changes must be indicated *(it better be real legible real quick)*
7. any and all modifications of this code base must without question be distributed with the same license, GPLv3 *(don't make me kick my boots around)*
8. this software is provided without warranty *(just like when those hubcaps came clean off the car)*
9. while it seems far out how such a case could arise, the software author or license can not be held liable for any damages inflicted by the software *(or your lips will be inflicted with the sidewalk)*

##### json data — CC-BY-SA 3.0

the JSON transcript and subtitle data files in `/assets/json/` are merged with data from [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/) and distributed here under the [Creative Commons Attribution-ShareAlike 3.0 Unported (CC-BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/) license, per the wiki's share-alike requirement.

##### longmont potion castle retains all rights to his associated and respective works

if you enjoy the catalogue, please support the artist by purchasing merch from [the official website at noisetent.com](http://noisetent.com/lpcmerchandise.htm)

### 🤓 Technical Details 🤓

the [technical details](https://stretchie.net/technical-details) page contains the project's implementation details and status badges.
