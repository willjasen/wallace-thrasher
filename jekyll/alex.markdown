---
layout: page
title: Alex Trebek
permalink: /alex-trebek/
published: true
search_page: true
---

{% include variables.liquid %}
{% include load-search.html %}

Alex Trebek shows up in <span id="alex-count-span"><img src="{{ site.baseurl }}/assets/img/loading.gif" id="statusImage" width="15" height="15" /></span> tracks!

<style>
  .alex-tracks-list {
    list-style-type: none;
    margin: 1rem 0 0 0;
    padding: 0;
  }

  .alex-track-item {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    column-gap: 0.65rem;
    align-items: center;
    margin: 0 0 0.55rem 0;
  }

  .alex-track-image {
    display: block;
    width: 32px;
    height: 32px;
    object-fit: cover;
  }

  .alex-track-title {
    display: block;
    min-width: 0;
    line-height: 1.25;
  }

  .alex-track-album {
    display: block;
    color: #666;
    font-size: 0.9em;
    line-height: 1.25;
    margin-top: 0.1rem;
  }

  @media (max-width: 480px) {
    .alex-track-item {
      grid-template-columns: 40px minmax(0, 1fr);
      column-gap: 0.75rem;
      margin-bottom: 0.7rem;
    }

    .alex-track-image {
      width: 40px;
      height: 40px;
    }

    .alex-track-title {
      overflow-wrap: anywhere;
    }
  }
</style>

<ul id="alex-tracks-span" class="alex-tracks-list"></ul>

---

Read more about Alex Trebek on [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/wiki/Alex_Trebek_(person)) and [Wikipedia](https://en.wikipedia.org/wiki/Alex_Trebek)
