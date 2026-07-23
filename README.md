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

### ⚙️ Components ⚙️

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper-webui is utilized to analyze the audio tracks and have it output subtitles (what is spoken) that include speaker diarization (determining who says what), which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages and combines all JSON data into one single JSON data file (`data.combined.json`).

because the website is static, there is no server-end processing that occurs when searching - it runs locally within the browser.

### ↪️ Converting Tracks to Subtitles ↪️

i am using [whisper-webui](https://github.com/jhj0517/Whisper-WebUI) (deployed via pinokio) to analyze the .mp3 files using speech-to-text with speaker diarization (who says what) to output subtitle files (.srt)

### ↘️ Converting Subtitles to JSON ↘️

i am using [this python tool](https://github.com/willjasen/srt-to-json) to convert the subtitle files to json, but it also outputs a metadata.json file and a metadata.yml file in accordance to what this project needs

### 🔎 Comparing Subtitles with Talkin' Whipapedia 🔎

`python/wiki_scrape_and_merge.py` downloads wiki transcripts into snapshots identified by a 13-digit Unix timestamp, aligns them with this project's timestamped JSON subtitles, and prepares speaker and text corrections for review. Generated data has one consistent layout:

```text
python/wiki-data/
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

Use `--track <track-slug>` with `scrape`, `compare`, `report`, or `merge` to work on one track. Text marked `review` is never merged automatically; change its `text_action` to `approved` in the comparison JSON after checking it. A real merge refuses comparison results made from an older version of a subtitle file, so rerun `compare` rather than bypassing that check. Every changed file is copied to `python/wiki-data/merge-backups/<unix-timestamp>/` before it is written.

Aliases and organizations can be reconciled separately from Talkin' Whipapedia's maintained index pages. The importer uses explicit wiki track groupings first, then searches album-scoped local transcripts for aliases and the full local catalog for otherwise-unassociated organizations:

```bash
python3 python/wiki_metadata_merge.py --dry-run
python3 python/wiki_metadata_merge.py --write
```

The project continues to call organizations `Establishments`. Each imported organization retains the wiki's `real-world` or `created` classification in `Establishment_Types`; entries found only in the wiki's unclassified “Just a big list” use `unspecified`. `Talkin_Whipapedia` records the values added by the importer so later runs can update or remove stale imports without disturbing hand-maintained metadata. The source material is available under CC BY-SA from [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/wiki/Home#Navigation).

### 💽 JSON for Albums and Tracks 💽

the main JSON data file resides at `/assets/data.json`

```
{
  "Albums": [
    { "Album": "Longmont Potion Castle",
      "Album_Slug": "longmont-potion-castle",
      "Album_Picture": "LPC_1.jpg",
      "Year": 1988,
      "Tracks": [
        {
          "Track_Title": "Longmont Theme 1",
          "Track_Number": 1,
          "Track_JSONPath": "longmont-theme-1.json",
          "Track_Slug": "longmont-theme-1",
          "Aliases": ["Wallace Thrasher"],
          "Establishments": ["UPS"],
          "Establishment_Notes": {"UPS": "Optional context shown in a pop-up on the track page."},
          "Establishment_Types": {"UPS": "real-world"},
          "Talkin_Whipapedia": {
            "Source": "https://talkinwhipapedia.fandom.com/wiki/Home#Navigation",
            "Aliases": ["Wallace Thrasher"],
            "Establishments": ["UPS"]
          },
          "Speakers_Adjusted": "false",
          "Subtitles_Adjusted": "false",
          "USB_Filename": "longmont-theme-1.mp3"
        }
      ]
    }
  ]
}
```
it is possible that some keys are not present in all tracks, but the necessary ones of `Track_Title`, `Track_Number`, `Track_JSONPath`, and `Track_Slug` are listed for each track.

### 💽 JSON for Track Subtitles 💽

the JSON data for each track resides within a folder named as the respective album title's slug within the `/assets/json` folder
```
[
    {
        "Index": 1,
        "Start Time": "00:00:02,140",
        "End Time": "00:00:02,920",
        "Speaker": "Woman 1",
        "Text": "Betty Boop Diner."
    },
    {
        "Index": 2,
        "Start Time": "00:00:04,008",
        "End Time": "00:00:08,449",
        "Speaker": "LPC",
        "Text": "Hi, can I please get a take-up or a pick-up?"
    }
]
```

### 🚘 Under The Hood 🚘

when the search pages are accessed, the single combined JSON data (`/assets/json/data.combined.json`) is retrieved from the server, then lunr indexes the data so that it becomes searchable. lunr currently indexes for multiple fields: speakers, subtitles, aliases, and establishments.

the same file is exposed through a read-only browser API. the API downloads and caches `data.combined.json` once; all of its methods query that in-memory dataset and do not request `data.json`, individual track files, or a backend. it is available on every page as `window.WallaceThrasherAPI`:

```javascript
const api = window.WallaceThrasherAPI;

const albums = await api.getAlbums({ year: 2001, query: 'volume' });
const tracks = await api.getTracks({ album: 'longmont-potion-castle-4' });
const result = await api.getTrack('longmont-potion-castle-4', 'alex-trebek');
const lines = await api.getSubtitles({ speaker: 'Alex Trebek', query: 'parcel', limit: 20 });
const speakers = await api.getSpeakers({ album: 'longmont-potion-castle-4' });
const aliases = await api.getAliases({ query: 'stretch' });
const establishments = await api.getEstablishments({ query: 'ups' });
const stats = await api.getStats();
```

list methods accept `offset` and `limit`. `getTracks()` returns `{ album, track }` records, `getTrack()` returns one such record or `null`, and `getSubtitles()` returns `{ album, track, subtitle }` records. `api.ready()` or `api.getData()` provides the original combined document when a specialized query is not enough.

the keys of `USB_Directory` and `USB_Filename` refer to the respective directory and filename of the mp3 that resides on a "LPC Ultimate Session Bundle" usb drive that are occasionally available for sale via [lpc's website](http://longmontpotioncastle.com/). these two pieces of data are used to play audio, if the files from the usb collection are uploaded.

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

the comparison is written as `comparison.json` inside the git-ignored analysis run. repository subtitle text and named speakers remain authoritative: Whisper differences use the `review` action and are merged only after that individual action, or an intended speaker mapping, is changed to `approved`. exact mentions of aliases or establishments already known elsewhere in the catalog use `auto_add`. a real merge validates hashes for the analysis artifacts, `data.json`, and the track JSON, then creates ignored backups under `analysis/whisper-webui/merge-backups/` before writing atomically. Whisper source provenance is kept in an ignored `merge-receipts/` file inside the analysis run and is never added to `data.json`.

subtitle entries may contain a boolean `Reviewed` field. when this field is missing, the merge initializes it from the track's existing `Subtitles_Adjusted` value; an explicitly approved Whisper text or speaker change is always written with `Reviewed: true`. this preserves the repository version by default while recording human review at line level.

### 🛠️ Building 🛠️

to install the project's dependencies, ensure Ruby is installed, then install its necessary gems by running: `bundle install; bundle update;`

to build, run this command from the `jekyll` directory: `JEKYLL_ENV=production bundle exec jekyll build`

to build and start a local web server, run this command from the `jekyll` directory: `JEKYLL_ENV=production bundle exec jekyll serve`

### 📤 Deployment 📤

commits to the main branch are deployed directly by [netlify](https://app.netlify.com/sites/wallace-thrasher/deploys). netlify uses [`netlify.toml`](https://github.com/willjasen/wallace-thrasher/blob/main/netlify.toml) to build the jekyll site with `JEKYLL_ENV=production`.

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

here are various badges related to this project's code and its deployments

[![Netlify Status](https://api.netlify.com/api/v1/badges/93a34aa5-06c6-4fae-ab22-3b463c464ee6/deploy-status)](https://app.netlify.com/sites/wallace-thrasher/deploys) -- production deployment status to Netlify

[![GitHub last commit](https://img.shields.io/github/last-commit/willjasen/wallace-thrasher)](https://github.com/willjasen/wallace-thrasher) -- when last committed to GitHub

![GitHub code size](https://img.shields.io/github/languages/code-size/willjasen/wallace-thrasher) -- deployed source code size

![GitHub repo size](https://img.shields.io/github/repo-size/willjasen/wallace-thrasher) -- source code repository size

![GitHub Release](https://img.shields.io/github/v/release/willjasen/wallace-thrasher) -- the latest version
