---
layout: default
title: Albums2
permalink: /albums2/
---

{% for album in site.data.albums.Albums %}

  <div class="album-info" style="display: flex; align-items: center;">
      <h2 style="margin-bottom: 10px;">
        <a href="/albums/{{ album.Album_Slug }}">{{ album.Album }} ({{ album.Year }})</a>
      </h2>
      <div class="image-container" style="margin-left: 50px;">
          <img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150">
      </div>
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





