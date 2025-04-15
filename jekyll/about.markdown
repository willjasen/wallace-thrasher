---
layout: page
title: About
permalink: /about/
---

codename for a website project involving the works of [longmont potion castle](http://longmontpotioncastle.com/) - you can call me stretchie


### Overview

this website allows for searching through subtitles and speakers within the longmont potion castle discography.

this website can currently be viewed at [stretchie.delivery](https://stretchie.delivery).

### Features

its basic feature is that albums and tracks have pages with the track pages containing the subtitles for the track. its smart feature is that all of this aforementioned data is indexed so that search becomes possible. the neat feature is that the lpc usb collection can be uploaded into the site and then tracks can be easily played, as well as one can jump into a track at the point of when a certain subtitle line is spoken.

### Backstory

some time ago, i wanted to know one question - how many calls does alex trebek show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that has detailed info about albums, tracks, their subtitles, and other info, however the data is not indexed and therefore not searchable, at least in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### Components

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper-webui is utilized to analyze the audio tracks and have it output subtitles (what is spoken) that include speaker diarization (determining who says what), which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages and combines all JSON data into one single JSON data file (`combined_data.json`).

because the website is static, there is no server-end processing that occurs (other than serving files) - the searching functions run locally within the browser.

### Converting Tracks to Subtitles

i am using whisper-webui (deployed via pinokio) to analyze the .mp3 files using speech-to-text with speaker diarization to output subtitle files (.srt)

### Converting Subtitles to JSON

i am using [this python tool](https://github.com/willjasen/srt-to-json) to convert the subtitle files to json, but it also outputs a metadata.json file and a metadata.yml file in accordance to what this project needs

### JSON Structure for Albums and Tracks

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
          "Aliases": "Wallace Thrasher",
          "Establishments": "UPS",
          "Speakers_Adjusted": "false",
          "Subtitles_Adjusted": "false"
          "USB_Filename": "longmont-theme-1.mp3",
          "Whisper_Model": "distil-whisper/distil-large-v3"
        }
      ]
    }
  ]
}
```
it is possible that some keys are not present in all tracks, but the necessary ones of `Track_Title`, `Track_Number`, `Track_JSONPath`, and `Track_Slug` are listed for each track.

### JSON Structure for Track Subtitles

the JSON data for each track resides within a folder named as the respective album title's slug with the `/assets/json` folder
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

### Under The Hood

when the search pages are accessed, the single combined JSON data (`/assets/json/combined_json.data`) is retrieved from the server, then lunr indexes the data so that it becomes searchable. lunr currently indexes for two categories - speakers and subtitles.

the keys of `USB_Directory` and `USB_Filename` refer to the respective directory and filename of the mp3 that resides on a "LPC Ultimate Session Bundle" usb drive that are occasionally available for sale via [lpc's website](http://longmontpotioncastle.com/). these two pieces of data are used to play audio, if the files from the usb collection are uploaded.

### Building

to install the project's dependencies, ensure Ruby is installed, then install its necessary gems by running: `bundle install; bundle update;`

to build, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll build`
to build and start a local web server, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll serve`

when deploying to production, `JEKYLL_ENV` must be changed to `production`. The development environment tends to display information within data.json more so than the production environment.


### How to Contribute

if you've read this far and have an interest in contributing to this project - it is welcomed and appreciated!

please refer to [CONTRIBUTING.md](https://github.com/willjasen/wallace-thrasher/blob/main/CONTRIBUTING.md)

### To-Do's

the to-do list has been moved to [TODO.md](https://github.com/willjasen/wallace-thrasher/blob/main/TODO.md)

### Licensing

this project is licensed under the [GPLv3](https://github.com/willjasen/wallace-thrasher/blob/main/gpl-3.0.txt), and this license applies to all past versions and branches of the project.

### Technical Details

this website was last built on {{ site.time | date: '%B %d, %Y at %I:%M %p %Z' }} ({{ site.time | date: '%Y-%m-%d %H:%M:%S UTC' }})

the deployment process is that commits to the main branch trigger a github action that runs `jekyll build` to generate the site's contents (usually stored within "/jekyll/_site") to the "gh-pages" branch of the repository. the commit to "gh-pages" is then pulled by netlify to redeploy its copy of the site.

[![Netlify Status](https://api.netlify.com/api/v1/badges/93a34aa5-06c6-4fae-ab22-3b463c464ee6/deploy-status)](https://app.netlify.com/sites/wallace-thrasher-rendered-main/deploys) -- this website is deployed to Netlify

[![GitHub last commit](https://img.shields.io/github/last-commit/willjasen/wallace-thrasher)](https://github.com/willjasen/wallace-thrasher) -- this website last committed to GitHub

![GitHub code size](https://img.shields.io/github/languages/code-size/willjasen/wallace-thrasher) -- deployed source code size

![GitHub repo size](https://img.shields.io/github/repo-size/willjasen/wallace-thrasher) -- source code repository size
