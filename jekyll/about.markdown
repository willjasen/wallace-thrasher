---
layout: page
title: About
permalink: /about/
---

codename for a website project involving the works of [longmont potion castle](http://longmontpotioncastle.com/) - you can call me stretchie

### Overview

this website allows for searching through subtitles and speakers within the longmont potion castle discography.

this website can currently be viewed at [stretchie.delivery](https://stretchie.delivery). there is a corresponding development website available at [dev.stretchie.delivery](https://dev.stretchie.delivery).

### Backstory

some time ago, i wanted to know one question - how many calls does alex trebek show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that has detailed info about albums, tracks, their subtitles, and other info, however the data is not indexed and therefore not searchable, at least in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### Components

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper is utilized to analyze mp3 tracks and have it output subtitle files, which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages and combines all JSON data into one single JSON data file (`combined_data.json`), and then any changes are then pushed here into this repo.

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

To install the project's dependencies, ensure Ruby is installed, then install its necessary gems by running: `bundle install; bundle update;`

To build, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll build`
To build and start a local webserver, run this command from the `jekyll` directory: `JEKYLL_ENV=development bundle exec jekyll serve`

When deploying to production, `JEKYLL_ENV` must be changed to `production`. The development environment tends to display information within data.json more so than the production environment.

### How to Contribute

if you've read this far and have an interest in contributing to this project - it is welcomed and appreciated!

please refer to [CONTRIBUTING.md](https://github.com/willjasen/wallace-thrasher/blob/main/CONTRIBUTING.md)

### To-Do's

the to-do list has been moved to [TODO.md](https://github.com/willjasen/wallace-thrasher/blob/main/TODO.md)

### Licensing

this project is licensed under the [GPLv3](https://github.com/willjasen/wallace-thrasher/blob/main/gpl-3.0.txt), and this license applies to all past versions and branches of the project.