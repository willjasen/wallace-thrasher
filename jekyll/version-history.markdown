---
layout: page
permalink: /version-history/
published: true
---

### v2.0.0 (beta)

 - prefetch and index data on every page, if needed
 - remove the need for YML data files
 - move the LPC USB feature into a floating action button
 - the LPC USB feature now persists across page navigations
 - add a table of contents for the About and Version History pages
 - center the search box on associated pages
 - stop `jekyll serve` from constant rebuilding
 - specify `netlify.toml` for build settings at netlify
 - improvements to the content security policy for Netlify

---

### v1.8.1

 - set a Content Security Policy for Netlify
 - bump gem `rexml` to 3.4.4

---

### v1.8.0

this release builds upon the newly implemented caching feature of v1.7.0 to render track pages as they are accessed rather than statically render them during build time. this cuts down on the time it takes to build and deploy the site - a couple of minutes for development and much more for production.

 - render track pages at access time

---

### v1.7.1

 - upgrade Ruby to version 3.3
 - upgrade a few Ruby gems safely

---

### v1.7.0

this release adds the latest album "The Longmont Potion Castle (2026)", which released on 3/27/2026.

it also introduces minifying for `data.combined.json` and caching for `data.json` and `data.combined.json`, which makes subsequent search page loading times much quicker. pages like "Speakers" and "Subtitles" were taking about 2 seconds to load with every access, as each access would always download the data from the web server, then perform indexing so that it is searchable. now with caching, downloading and indexing needs to be done once, amking subsequent search page load times below 100 milliseconds. there's a noticable difference when navigating pages and the website should feel much more responsive.

 - add the new album "The Longmont Potion Castle (2026)"
 - minify the combined json data file
 - add caching support for search pages to decrease page load times

---

### v1.6.3

this minor release is mostly to stash any changes that haven't been merged yet now that the new album "the longmont potion castle" is out (3/27/2026)

 - began editing "Game Stop 2"; only got about 6 minutes in
 - minor typo fixes for the README and About pages

---

### v1.6.2

 - add aliases and establishments for "Alive in '25"
 - use stretchie.net for IPNS

---

### v1.6.1

 - fix the discord link in the footer
 - updates to a few tracks

 ---

### v1.6.0

 - add pages for Aliases and Establishments and their searching thereof
 - make the search boxes bigger and disable them until the data is loaded
 - move the site's title and logo to the top center (away from the left)
 - give the navigation menu a new layout
 - better the layout for the tracks list of each album on the "Track Review" page

---

### v1.5.4

 - fix the index page layout by creating a redirect to another page
 - minor edits to typos

---

### v1.5.3

- stretchie is now available via [https://stretchie.net](https://stretchie.net) and [https://stretchie.org](https://stretchie.org)
- [https://stretchie.net](https://stretchie.net) will now be the primary domain for the project

---

### v1.5.2

- fix the album page for "Where In The Hell Is The Lavender House Soundtrack (2018)"
- a few various track updates

---

### v1.5.1

- fix typo within page track data for "Circus Tickets" on LPC 1
- add logo to site title (formatting isn't the best yet)
- add link to Talkin' Whipapedia at the bottom of each album page
- add [link to the Discord server](https://discord.gg/fFzWs8Vv83) at the bottom of the page
- send webhook to the new Discord server after production builds

---

### v1.5.0

- updated all known tracks (excluding themes) that include Alex Trebek
- Alex Trebek's page now displays the tracks he is included in
- updated the format of the Albums page
- added link in the README and About page to [the lpc merch site at noisetent.com](http://noisetent.com/lpcmerchandise.htm)

---

### v1.4.1

- updates to the README and About pages
- minor fixes for "Drug Dumpling" (still needs a redo)

---

### v1.4.0

- website's title is renamed to 'stretchie'
- change search feature to use logical 'AND' instead of logical 'OR'
	- search results returned will now include only all words entered
- allow URL parameter for search (https://stretchie.net/subtitles/?search=cheese+pizza)
- deploy website to IPFS
	- renamed 'publish-for-netlify.yml' to 'deploy-production-build.yml'
	- 'deploy-production-build.yml' builds the website as a production build and publishes the built site's contents to the 'production-build' branch
	- 'deploy-production-build.yml' deploys the site to IPFS via [Filebase](https://filebase.com/) and [Storacha](https://storacha.network/) using the 'production-build' branch, then updates the `_dnslink` TXT DNS record for the "[stretchie.net](https://stretchie.net)" domain to reflect the new IPFS hash

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/version-history-toc.css">
<script>
(function () {
  function buildTOC() {
    // Remove any stale TOC left by a previous visit (soft-nav re-execution)
    var existing = document.getElementById("version-history-toc");
    if (existing) existing.remove();
    document.body.classList.remove("version-history-page");

    const content = document.querySelector(".post-content") || document.querySelector(".page-content .wrapper");
    if (!content) return;

    const headings = content.querySelectorAll("h3");
    if (headings.length === 0) return;

    const nav = document.createElement("nav");
    nav.id = "version-history-toc";
    nav.setAttribute("aria-label", "Page sections");

    const label = document.createElement("div");
    label.id = "version-history-toc-label";
    label.textContent = "Version History";
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
    document.body.classList.add("version-history-page");

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

  // Clean up when the persistent player soft-navigates away from Version History
  document.addEventListener("soft-nav", function onSoftNav(e) {
    var url = (e.detail && e.detail.url) || "";
    if (!url.match(/\/version-history\/?$/)) {
      var toc = document.getElementById("version-history-toc");
      if (toc) toc.remove();
      document.body.classList.remove("version-history-page");
      document.removeEventListener("soft-nav", onSoftNav);
    }
  });
})();
</script>