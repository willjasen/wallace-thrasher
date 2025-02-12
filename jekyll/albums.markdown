---
layout: default
title: Albums
permalink: /albums/
---

{% assign sorted_albums = site.data.albums.Albums | sort: "Year" %}
{% for album in sorted_albums %}

  <div class="album-info" style="display: flex; align-items: center;">
      <div class="image-container" style="margin-left: 50px;">
          <img src="/assets/img/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="50" height="50">
      </div>
      <h4 style="margin-bottom: 10px;">
        <a href="/albums/{{ album.Album_Slug }}">{{ album.Album }} ({{ album.Year }})</a>
      </h4>
  </div>

  <style>
      .album-info {
          display: flex;
          align-items: center;
      }

      .image-container {
          margin-right: 20px; /* Adds some space between the image and text for better readability */
      }
  </style>

  <p></p>
  
{% endfor %}





