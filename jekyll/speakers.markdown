---
layout: page
title: Speakers
permalink: /speakers/
---


<div class="search-flex-row">
  <input type="text" id="speakers-search-input" placeholder="Search...">
  {%- include load-search-with-progress.html -%}
</div>
<ul id="speakers-search-results"></ul>
<link rel="stylesheet" href="/assets/css/search-box.css">  

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