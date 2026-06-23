---
layout: page
title: Instructions
permalink: /instructions/
published: true
---

### 🧭 Search Pages 🧭

there are four pages that utilize the search feature, found under the Search menu option at the top:

the "[Aliases]({{ site.baseurl }}/aliases)" page enables for searching through the aliases and nicknames that LPC uses when calling others. in your case - you can call me stretchie. the page also displays all aliases used throughout the discography.

the "[Establishments]({{ site.baseurl }}/establishments)" page enables searching through the establishments and places that LPC mentions. a frequently used establishment is UPS. the page also displays all establishments used throughout the discography.

the "[Speakers]({{ site.baseurl }}/speakers)" page enables searching through the "victims" of calls from LPC. an example that inspired the creation of this web app is [Alex Trebek]({{ site.baseurl }}/alex-trebek).

the "[Subtitles]({{ site.baseurl }}/subtitles)" page enables searching through the subtitles and spoken words that are heard on the calls.

---

### 🔎 Search Logic 🔎

the search feature uses a logical 'and' when operating, instead of a logical 'or'. this change in behavior affects when multiple words are searched. before, the search would return any subtitles containing any word that was entered. now, the search will only return subtitles that contain all words being searched.

for example, a search term of "cheese pizza" previously return 134 results - all subtitles containing either the word "cheese" or "pizza". now, the same search of "cheese pizza" returns 7 results - all subtitles containing both the words "cheese" and "pizza".

note that results returned are not based on phrase matching. for example, a subtitle of "i want a cheese pizza" will be returned, but so will "i would like cheese on my pizza". due to limitations of [lunr.js](https://lunrjs.com/), phrase matching is not possible.

also note that the ordering of the words does not matter, so a search for "cheese pizza" and for "pizza cheese" will return the same results.

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/instructions-toc.css">
<script>
(function () {
  function buildTOC() {
    // Remove any stale TOC left by a previous visit (soft-nav re-execution)
    var existing = document.getElementById("instructions-toc");
    if (existing) existing.remove();
    document.body.classList.remove("instructions-page");

    const content = document.querySelector(".post-content") || document.querySelector(".page-content .wrapper");
    if (!content) return;

    const headings = content.querySelectorAll("h3");
    if (headings.length === 0) return;

    const nav = document.createElement("nav");
    nav.id = "instructions-toc";
    nav.setAttribute("aria-label", "Page sections");

    const label = document.createElement("div");
    label.id = "instructions-toc-label";
    label.textContent = "Instructions";
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
      a.textContent = h.textContent
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FFFD}\u2194-\u21FF\u2300-\u23FF\u2B00-\u2BFF\u{231A}-\u{231B}☑↪↘⚙🛠✍☑🪪🤓]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    document.body.appendChild(nav);
    document.body.classList.add("instructions-page");

    const links = nav.querySelectorAll("a");

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.getElementById(a.dataset.targetId);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) { a.classList.remove("active"); });
          const active = nav.querySelector('[data-target-id="' + entry.target.id + '"]');
          if (active) active.classList.add("active");
        }
      });
    }, { rootMargin: "0px 0px -80% 0px" });

    headings.forEach(function (h) { observer.observe(h); });
  }

  // Run immediately if DOM is ready (soft-nav re-execution), otherwise wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildTOC);
  } else {
    buildTOC();
  }

  // Clean up when the persistent player soft-navigates away from Instructions
  document.addEventListener("soft-nav", function onSoftNav(e) {
    var url = (e.detail && e.detail.url) || "";
    if (!url.match(/\/instructions\/?$/)) {
      var toc = document.getElementById("instructions-toc");
      if (toc) toc.remove();
      document.body.classList.remove("instructions-page");
      document.removeEventListener("soft-nav", onSoftNav);
    }
  });
})();
</script>
