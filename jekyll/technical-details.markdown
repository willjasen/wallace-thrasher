---
layout: page
title: Technical Details
description: Technical details about stretchie's components, transcription workflow, and data formats.
permalink: /technical-details/
---

### ⚙️ Components ⚙️

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper-webui is utilized to analyze the audio tracks and have it output subtitles (what is spoken) that include speaker diarization (determining who says what), which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages and combines all JSON data into one single JSON data file (`data.combined.json`).

because the website is static, there is no server-end processing that occurs when searching - it runs locally within the browser.

### ↪️ Converting Tracks to JSON ↪️

i use [whisper-webui](https://github.com/jhj0517/Whisper-WebUI) (deployed via pinokio) to create subtitle files (.srt) with speech-to-text and speaker diarization, then use [this python tool](https://github.com/willjasen/srt-to-json) to convert them to json.

### 💽 JSON for Albums and Tracks 💽

the main JSON data file resides at `/assets/data.json`

```text
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

```text
[
    {
        "Index": 1,
        "Start Time": "00:00:02,140",
        "End Time": "00:00:02,920",
        "Speaker": "Woman 1",
        "Text": "Betty Boop Diner."
    }
]
```

### 🏷️ Badges 🏷️

here are various badges related to this project's code and its deployments

[![Netlify Status](https://api.netlify.com/api/v1/badges/93a34aa5-06c6-4fae-ab22-3b463c464ee6/deploy-status)](https://app.netlify.com/sites/wallace-thrasher/deploys) -- production deployment status to Netlify

[![GitHub last commit](https://img.shields.io/github/last-commit/willjasen/wallace-thrasher)](https://github.com/willjasen/wallace-thrasher) -- when last committed to GitHub

![GitHub code size](https://img.shields.io/github/languages/code-size/willjasen/wallace-thrasher) -- deployed source code size

![GitHub repo size](https://img.shields.io/github/repo-size/willjasen/wallace-thrasher) -- source code repository size

![GitHub Release](https://img.shields.io/github/v/release/willjasen/wallace-thrasher) -- the latest version
