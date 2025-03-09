---
layout: page
title: Subtitles
permalink: /subtitles/
---

{%- include load-search-with-progress.html -%}
{% if jekyll.environment != "production" %}
  {%- include embed-audio-dir-for-search.html -%}
{% endif %}

<input type="text" id="subtitles-search-input" placeholder="Search...">
  <ul id="subtitles-search-results"></ul>