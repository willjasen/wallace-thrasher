---
layout: page
title: About
permalink: /about/
---

a website project involving the works of [longmont potion castle](http://longmontpotioncastle.com/) - you can call me stretchie

### 🧭 Overview 🧭

this website allows for searching through subtitles and speakers within the longmont potion castle discography.

this website can currently be viewed at:

- primary domain --> [stretchie.delivery](https://stretchie.delivery)
- via ipfs/ipns --> example: [https://dweb.link/ipns/stretchie.delivery/](https://dweb.link/ipns/stretchie.delivery/)
- for development only --> [github pages](https://willjasen.github.io/wallace-thrasher/)

### 🎮 Features 🎮

there are three main features of various interests implemented:

- its basic feature is that albums and tracks have pages with the track pages containing the subtitles for the track
- its smart feature is that all of this aforementioned data is indexed so that search becomes possible
- its neat feature is that the lpc usb collection can be uploaded into the site and then tracks can be easily played, as well as one can jump into a track at the point of when a certain subtitle line is spoken.

### 📘 Backstory 📘

some time ago, i wanted to know one question - how many calls does alex trebek show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that has detailed info about albums, tracks, their subtitles, and other info, however its data isn't structured in a formal way and therefore is not indexedable in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### 🫡 A Pledge 🫡

when i began the venture of creating this magnificent package, i pledged that i would not monetize the website, and i still have no intentions of doing so. i created this as an effort of love for the works involved here and as a challenge to myself. it is the best homage that i can contribute to this little weird corner of the universe.

### 🔎 Searching 🔎

as of v1.4.0, the search feature uses a logical 'and' when operating, instead of a logical 'or'. this change in behavior affects when multiple words are searched. before, the search would return any subtitles containing any word that was entered. now, the search will only return subtitles that contain all words being searched.

for example, a search term of "cheese pizza" previously return 134 results - all subtitles containing either the word "cheese" or "pizza". now, the same search of "cheese pizza" returns 7 results - all subtitles containing both the words "cheese" and "pizza".

note that results returned are not based on phrase matching. for example, a subtitle of "i want a cheese pizza" will be returned, but so will "i would like cheese on my pizza". due to limitations of [lunr.js](https://lunrjs.com/), phrase matching is not possible.

also note that the ordering of the words does not matter, so a search for "cheese pizza" and for "pizza cheese" will return the same results.

### ⚙️ Components ⚙️

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper-webui is utilized to analyze the audio tracks and have it output subtitles (what is spoken) that include speaker diarization (determining who says what), which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages and combines all JSON data into one single JSON data file (`combined_data.json`).

because the website is static, there is no server-end processing that occurs (other than serving files) - the searching functions run locally within the browser.

### ↪️ Converting Tracks to Subtitles ↪️

i am using [whisper-webui](https://github.com/jhj0517/Whisper-WebUI) (deployed via pinokio) to analyze the .mp3 files using speech-to-text with speaker diarization (who says what) to output subtitle files (.srt)

### ↘️ Converting Subtitles to JSON ↘️

i am using [this python tool](https://github.com/willjasen/srt-to-json) to convert the subtitle files to json, but it also outputs a metadata.json file and a metadata.yml file in accordance to what this project needs

### 💽 JSON Structure for Albums and Tracks 💽

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

### 💽 JSON Structure for Track Subtitles 💽

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

when the search pages are accessed, the single combined JSON data (`/assets/json/combined_json.data`) is retrieved from the server, then lunr indexes the data so that it becomes searchable. lunr currently indexes for two categories - speakers and subtitles.

the keys of `USB_Directory` and `USB_Filename` refer to the respective directory and filename of the mp3 that resides on a "LPC Ultimate Session Bundle" usb drive that are occasionally available for sale via [lpc's website](http://longmontpotioncastle.com/). these two pieces of data are used to play audio, if the files from the usb collection are uploaded.

### 🛠️ Building 🛠️

to install the project's dependencies, ensure Ruby is installed, then install its necessary gems by running: `bundle install; bundle update;`

to build, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll build`

to build and start a local web server, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll serve`

when deploying to production, `JEKYLL_ENV` must be changed to `production`. the development environment tends to display information within data.json more so than the production environment.

### 📤 Deployment 📤

commits to the main branch trigger two [github actions](https://github.com/willjasen/wallace-thrasher/blob/main/.github/workflows):

- `deploy-production-build.yml`:
  - runs `jekyll build --baseurl ""` to generate the site on the "[production-build](https://github.com/willjasen/wallace-thrasher/tree/production-build)" branch
  - deploys the "[production-build](https://github.com/willjasen/wallace-thrasher/tree/production-build)" branch to IPFS

- `publish-to-github-pages.yml`:
  - runs `jekyll build --baseurl "/wallace-thrasher"` to generate the site on the "[gh-pages](https://github.com/willjasen/wallace-thrasher/tree/gh-pages)" branch
  - a separate action then uses the "[gh-pages](https://github.com/willjasen/wallace-thrasher/tree/gh-pages)" branch to deploy to github pages

the commit to "[production-build](https://github.com/willjasen/wallace-thrasher/tree/production-build)" is pulled by [netlify](https://app.netlify.com/sites/wallace-thrasher/deploys) to redeploy its copy of the site.

### ✍️ How to Contribute ✍️

if you've read this far and have an interest in contributing to this project - it is welcomed and appreciated!

please refer to [CONTRIBUTING.md](https://github.com/willjasen/wallace-thrasher/blob/main/CONTRIBUTING.md)

### ☑️ To-Do's ☑️

the to-do list has been moved to [TODO.md](https://github.com/willjasen/wallace-thrasher/blob/main/TODO.md)

### 🪪 Licensing & Rights 🪪

this project is licensed under the [GPLv3](https://github.com/willjasen/wallace-thrasher/blob/main/gpl-3.0.txt), and this license applies to all past versions and branches of the project. to help best illustrate this licensing, here's a list of what it entails:

1. anyone may copy, modify, and distribute this software *(throw it up and down)*
2. all distrubtions of this software must include the license and copyright notice always *(otherwise you're gettin' a citation)*
3. anyone may use this software privately *(even during a real hypnotic massage)*
4. anyone may use this software for commercial purposes *(cave of the winds might find it useful)*
6. if changes are made to the code, those changes must be indicated *(it better be real legible real quick)*
7. any and all modifications of this code base must without question be distributed with the same license, GPLv3 *(don't make me kick my boots around)*
8. this software is provided without warranty *(just like when those hubcaps came clean off the car)*
9. while it seems far out how such a case could arise, the software author or license can not be held liable for any damages inflicted by the software *(or your lips will be inflicted with the sidewalk)*

longmont potion castle retains all rights to his associated and respective works

if you enjoy the catalogue, please support the artist by purchasing merch from [the official website at noisetent.com](http://noisetent.com/lpcmerchandise.htm)

### 🤓 Technical Details 🤓

here are various badges related to this project's code and its deployments

[![Deploy a Production Build](https://github.com/willjasen/wallace-thrasher/actions/workflows/deploy-production-build.yml/badge.svg)](https://github.com/willjasen/wallace-thrasher/actions/workflows/deploy-production-build.yml)

[![Publish to GitHub Pages](https://github.com/willjasen/wallace-thrasher/actions/workflows/publish-to-github-pages.yml/badge.svg)](https://github.com/willjasen/wallace-thrasher/actions/workflows/publish-to-github-pages.yml) -- GitHub Action to publish to GitHub Pages

[![Netlify Status](https://api.netlify.com/api/v1/badges/93a34aa5-06c6-4fae-ab22-3b463c464ee6/deploy-status)](https://app.netlify.com/sites/wallace-thrasher/deploys) -- deployment status to Netlify

[![GitHub last commit](https://img.shields.io/github/last-commit/willjasen/wallace-thrasher)](https://github.com/willjasen/wallace-thrasher) -- when last committed to GitHub

![GitHub code size](https://img.shields.io/github/languages/code-size/willjasen/wallace-thrasher) -- deployed source code size

![GitHub repo size](https://img.shields.io/github/repo-size/willjasen/wallace-thrasher) -- source code repository size

![GitHub License](https://img.shields.io/github/license/willjasen/wallace-thrasher) -- the open source license

![GitHub Release](https://img.shields.io/github/v/release/willjasen/wallace-thrasher) -- the latest version

notes on version history can be found on the [version history]({{ site.baseurl }}/version-history) page

this website was last built on {{ site.time | date: '%B %e, %Y at %-I:%M %p %Z' }}