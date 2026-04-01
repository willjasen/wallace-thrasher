---
layout: page
title: Speakers
permalink: /speakers/
search_page: true
---


<div class="search-flex-row">
  <input type="text" id="speakers-search-input" placeholder="Search...">
  {%- include load-search-with-progress.html -%}
</div>
<ul id="speakers-search-results"></ul>

<style>
  .loader {
    opacity: 0.2;
    pointer-events: none;
  }

  .loader input,
  .loader ul {
    opacity: 1 !important;
  }
</style>