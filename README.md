# wallace-thrasher
codename for a website project involving the works of [longmont potion castle](http://longmontpotioncastle.com/) - you can call me stretchie

### Overview

this website allows for searching through subtitles and speakers within the longmont potion castle discography.

this website can currently be viewed at [stretchie.delivery](https://stretchie.delivery). there is a corresponding development website available at [dev.stretchie.delivery](https://dev.stretchie.delivery).

### Backstory

some time ago, i wanted to know one question - how many calls does alex trebek show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that has detailed info about albums, tracks, their subtitles, and other info, however the data is not indexed and therefore not searchable, at least in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### Components

this website is built with the static site generator [jekyll](https://jekyllrb.com). whisper is utilized to analyze mp3 tracks and have it output subtitle files, which are then transformed into json files. each json file containing a track's speakers and subtitles data must be manually reviewed and corrected as needed. as changes are made, `jekyll build` recreates the site's pages, and then any changes are then pushed here into this repo.

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
it is possible that the keys `Speakers_Adjusted`, `Subtitles_Adjusted`, `USB_Filename`, and `Whisper_Model` may not be present with the `Track` object.

### JSON Structure for Track Subtitles

the JSON data for each track resides within a folder named as the respective album title's slug at `/assets/json`
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

when the search pages are accessed, the JSON data is retrieved from the server, then lunr indexes the data so that it becomes searchable. i have noticed that the first time that the website is loaded, the JSON files may take a handful of seconds to retrieve and load (its progress can be seen on the search pages). after the data has been loaded once and subsequently cached, the loading process is much faster.

the key `USB_Filename` refers to the respective mp3 file's name that resides on a "LPC Ultimate Session Bundle" usb drive that are occasionally available for sale via [lpc's website](http://longmontpotioncastle.com/). this key is planned for a future feature.

### How to Contribute

if you've read this far and have an interest in contributing to this project - it is welcomed and appreciated!

please refer to [CONTRIBUTING.md](CONTRIBUTING.md)

### To-Do's

the to-do list has been moved to [TODO.md](TODO.md)

### Licensing

this project is licensed under the [GPLv3](gpl-3.0.txt), and this license applies to all past versions and branches of the project.
