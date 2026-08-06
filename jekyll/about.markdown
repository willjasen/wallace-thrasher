---
layout: page
title: About
description: Learn about stretchie, a searchable Longmont Potion Castle subtitle and speaker archive.
permalink: /about/
---

a website project involving the works of [longmont potion castle](https://en.wikipedia.org/wiki/Longmont_Potion_Castle)

*you can call me stretchie*

### 🧭 Overview 🧭

this website allows for searching through data like subtitles within the longmont potion castle discography.

for help on how to use the web app, refer to the [instructions]({{ site.baseurl }}/instructions) page.

this website can currently be viewed at:

- primary domain --> [stretchie.net](https://stretchie.net)

### 🎮 Features 🎮

there are four main features of various interests implemented:

- its basic feature is that albums and tracks have pages with the track pages containing the subtitles for the track
- its smart feature is that all of this aforementioned data is indexed so that search becomes possible
- its neat feature is that the lpc usb collection can be uploaded into the site and then tracks can be easily played, as well as one can jump into a track at the point of when a certain subtitle line is spoken.
- its thoughtful feature is that the website runs locally within the browser (there is no remote backend database that executes the searches)

### 📘 Backstory 📘

some time ago, i wanted to know one question - how many calls does [alex trebek]({{ site.baseurl }}/alex-trebek) show up in throughout the discography of lpc?

there are great resources like [talkin' whipapedia](https://talkinwhipapedia.fandom.com/) out there that have detailed info about albums, tracks, their subtitles, and other info, however its data isn't structured in a formal way and therefore is not indexedable in a way that can answer my original question. given that i've been programming since i was in elementary school, i knew i could create something that would tell me, and i wanted it to be something that i could share within the niche community of lpc.

### 🫡 A Pledge 🫡

when i began the venture of creating this magnificent package, i pledged that i would not monetize the website, and i still have no intentions of doing so. i created this as an effort of love for the works involved here and as a challenge to myself. it is the best homage that i can contribute to this little weird corner of the universe.

### 🤖 Disclosure 🤖

this project uses both local and cloud-based ai tools.

[whisper-webui](https://github.com/jhj0517/Whisper-WebUI) runs locally to transcribe LPC audio tracks and provide speaker diarization. additionally, running the ai model locally avoids sharing the LPC audio tracks with third-parties.

cloud ai tools like ChatGPT Work have been used to code, review, and improve the code of stretchie.

furthermore, it has been my stance that ai is both good and bad - i believe that these tools can be used in good, productive ways while acknowleding problems like ai slop and misinformation.

### ✍️ How to Contribute ✍️

GitHub users can [contribute]({{ site.baseurl }}/instructions/#edit-subtitles-and-speakers) corrections directly from the website. sign in with GitHub, use the **Suggest edits** option on a track, and submit your changes; the website will create a pull request for review.

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

the [technical details]({{ site.baseurl }}/technical-details/) page contains the project's implementation details and status badges.

notes on version history can be found on the [version history]({{ site.baseurl }}/version-history) page. browse the Talkin' Whipapedia scrape, comparison, and merge archive on the [wiki data]({{ site.baseurl }}/wiki-data/) page. browse the detailed transcription comparisons, review history, and approved Whisper changes on the combined [transcription and Whisper data]({{ site.baseurl }}/transcription-data/) page.

this website was last built on {{ site.time | date: '%B %e, %Y at %-I:%M %p %Z' }}

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/about-toc.css">
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/about-netlify.css">
<script>
(function () {
  function buildTOC() {
    // Remove any stale TOC left by a previous visit (soft-nav re-execution)
    var existing = document.getElementById("about-toc");
    if (existing) {
      if (existing.cleanup) existing.cleanup();
      existing.remove();
    }
    document.body.classList.remove("about-page");

    const content = document.querySelector(".post-content") || document.querySelector(".page-content .wrapper");
    if (!content) return;

    const headings = content.querySelectorAll("h3");
    if (headings.length === 0) return;

    const nav = document.createElement("nav");
    nav.id = "about-toc";
    nav.setAttribute("aria-label", "Page sections");

    const label = document.createElement("div");
    label.id = "about-toc-label";
    label.textContent = "About";
    nav.appendChild(label);

    const ul = document.createElement("ul");
    headings.forEach(function (h) {
      if (!h.id) {
        h.id = h.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      }
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + h.id;
      a.dataset.targetId = h.id;
      // strip all emoji and variation selectors, then collapse extra whitespace
      a.textContent = h.textContent
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FFFD}\u2194-\u21FF\u2300-\u23FF\u2B00-\u2BFF\u{231A}-\u{231B}☑↪↘⚙🛠✍☑🪪🤓]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    document.body.appendChild(nav);
    document.body.classList.add("about-page");

    const links = nav.querySelectorAll("a");

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.getElementById(a.dataset.targetId);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
    });

    function setActive(heading) {
      links.forEach(function (a) { a.classList.remove("active"); });
      const active = nav.querySelector('[data-target-id="' + heading.id + '"]');
      if (active) active.classList.add("active");
    }

    function updateActiveLink() {
      var atPageEnd = window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      var activeHeading = headings[0];

      if (atPageEnd) {
        activeHeading = headings[headings.length - 1];
      } else {
        var activationLine = window.innerHeight * 0.2;
        headings.forEach(function (h) {
          if (h.getBoundingClientRect().top <= activationLine) activeHeading = h;
        });
      }

      setActive(activeHeading);
    }

    var updateQueued = false;
    function queueActiveLinkUpdate() {
      if (updateQueued) return;
      updateQueued = true;
      window.requestAnimationFrame(function () {
        updateQueued = false;
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

  // Run immediately if DOM is ready (soft-nav re-execution), otherwise wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildTOC);
  } else {
    buildTOC();
  }

  // Clean up when the persistent player soft-navigates away from About
  document.addEventListener("soft-nav", function onSoftNav(e) {
    var url = (e.detail && e.detail.url) || "";
    if (!url.match(/\/about\/?$/)) {
      var toc = document.getElementById("about-toc");
      if (toc) {
        if (toc.cleanup) toc.cleanup();
        toc.remove();
      }
      document.body.classList.remove("about-page");
      document.removeEventListener("soft-nav", onSoftNav);
    }
  });
})();
</script>
