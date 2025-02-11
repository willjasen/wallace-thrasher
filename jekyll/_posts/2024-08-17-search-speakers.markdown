---
layout: post
title:  "search speakers"
date:   2024-08-17 06:17:00 -0400
categories: lunr search
---

{%- include loading-status.html -%}

<script type="javascript">
  document.getElementById('search_result').innerHTML = idx.search("bright");
</script>

<input type="text" id="speakers-search-input" placeholder="Search...">
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