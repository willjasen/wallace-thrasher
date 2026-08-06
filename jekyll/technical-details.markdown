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

### 🚘 Under The Hood 🚘

when the search pages are accessed, the single combined JSON data (`/assets/json/data.combined.json`) is retrieved from the server, then lunr indexes the data so that it becomes searchable. lunr currently indexes for multiple fields: speakers, subtitles, aliases, and establishments.

the same file is exposed through a read-only browser API. the API downloads and caches `data.combined.json` once; all of its methods query that in-memory dataset and do not request `data.json`, individual track files, or a backend. it is available on every page as `window.WallaceThrasherAPI`.

the keys of `USB_Directory` and `USB_Filename` refer to the respective directory and filename of the mp3 that resides on a "LPC Ultimate Session Bundle" usb drive that are occasionally available for sale via [lpc's website](http://longmontpotioncastle.com/). these two pieces of data are used to play audio, if the files from the usb collection are uploaded.

### 🛠️ Building 🛠️

to install the project's dependencies, ensure Ruby is installed, then install its necessary gems by running: `bundle install; bundle update;`

to create the default indexable production build, run this command from the `jekyll` directory: `JEKYLL_ENV=production bundle exec jekyll build`

when the LPC USB collection is available locally, the build can also verify that every catalog album directory and track filename matches the USB files. set `LPC_USB_ROOT` to the USB collection's root before building, for example: `LPC_USB_ROOT="/path/to/LPC USB" JEKYLL_ENV=production bundle exec jekyll build`.

to build the site with the shared browser-rendered track viewer instead of fully rendered track HTML, run: `JEKYLL_ENV=production INDEXABLE=false bundle exec jekyll build`

to build and start a local web server, run this command from the `jekyll` directory: `JEKYLL_ENV=production bundle exec jekyll serve`

### 📤 Deployment 📤

commits to the main branch are deployed directly by [netlify](https://app.netlify.com/sites/wallace-thrasher/deploys). netlify uses [`netlify.toml`](https://github.com/willjasen/wallace-thrasher/blob/main/netlify.toml) to build the jekyll site with `JEKYLL_ENV=production`.

### 🏷️ Badges 🏷️

here are various badges related to this project's code and its deployments

[![Netlify Status](https://api.netlify.com/api/v1/badges/93a34aa5-06c6-4fae-ab22-3b463c464ee6/deploy-status)](https://app.netlify.com/sites/wallace-thrasher/deploys) -- production deployment status to Netlify

[![GitHub last commit](https://img.shields.io/github/last-commit/willjasen/wallace-thrasher)](https://github.com/willjasen/wallace-thrasher) -- when last committed to GitHub

![GitHub code size](https://img.shields.io/github/languages/code-size/willjasen/wallace-thrasher) -- deployed source code size

![GitHub repo size](https://img.shields.io/github/repo-size/willjasen/wallace-thrasher) -- source code repository size

![GitHub Release](https://img.shields.io/github/v/release/willjasen/wallace-thrasher) -- the latest version

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/technical-details-toc.css">
<script>
(function () {
  function buildTOC() {
    var existing = document.getElementById("technical-details-toc");
    if (existing) {
      if (existing.cleanup) existing.cleanup();
      existing.remove();
    }

    var content = document.querySelector(".post-content") || document.querySelector(".page-content .wrapper");
    if (!content) return;

    var headings = content.querySelectorAll("h3");
    if (!headings.length) return;

    var nav = document.createElement("nav");
    nav.id = "technical-details-toc";
    nav.setAttribute("aria-label", "Page sections");

    var label = document.createElement("div");
    label.id = "technical-details-toc-label";
    label.textContent = "Technical details";
    nav.appendChild(label);

    var list = document.createElement("ul");
    headings.forEach(function (heading) {
      if (!heading.id) {
        heading.id = heading.textContent.trim().toLowerCase()
          .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      }
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.dataset.targetId = heading.id;
      link.textContent = heading.textContent.replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE00-\uFE0F\u2194-\u21FF\u2300-\u23FF\u2B00-\u2BFF]/gu, "")
        .replace(/\s{2,}/g, " ").trim();
      link.addEventListener("click", function (event) {
        event.preventDefault();
        heading.scrollIntoView({ behavior: "smooth" });
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    nav.appendChild(list);
    document.body.appendChild(nav);

    function updateActiveLink() {
      var active = headings[0];
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        active = headings[headings.length - 1];
      } else {
        headings.forEach(function (heading) {
          if (heading.getBoundingClientRect().top <= window.innerHeight * 0.2) active = heading;
        });
      }
      list.querySelectorAll("a").forEach(function (link) {
        link.classList.toggle("active", link.dataset.targetId === active.id);
      });
    }

    var queued = false;
    function queueActiveLinkUpdate() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        updateActiveLink();
      });
    }
    window.addEventListener("scroll", queueActiveLinkUpdate, { passive: true });
    window.addEventListener("resize", queueActiveLinkUpdate);
    updateActiveLink();
    nav.cleanup = function () {
      window.removeEventListener("scroll", queueActiveLinkUpdate);
      window.removeEventListener("resize", queueActiveLinkUpdate);
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildTOC);
  else buildTOC();
})();
</script>
