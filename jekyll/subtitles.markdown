---
layout: page
title: Subtitles
description: Search spoken subtitle text across the Longmont Potion Castle discography.
permalink: /subtitles/
search_page: true
search_menu: true
---

{%- include embed-audio-dir-for-search.html -%}

<div class="search-flex-row">
  <label class="visually-hidden" for="subtitles-search-input">Search subtitles</label>
  <input type="search" id="subtitles-search-input" placeholder="Search spoken words..." autocomplete="off">
  {%- include load-search-with-progress.html -%}
</div>
<p id="subtitles-search-status" class="subtitles-search-status" aria-live="polite"></p>
<ul id="subtitles-search-results" class="subtitles-search-results" aria-label="Subtitle search results"></ul>
