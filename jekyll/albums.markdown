---
layout: default
title: Albums
permalink: /albums/
---

{% for album in site.data.albums.Albums %}

  <div class="album-info" style="display: flex; align-items: center;">
      <h2 style="margin-bottom: 10px;">{{ album.Album }} ({{ album.Year }})</h2>
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

  <p>
  <ul>
    {% for track_json in album.Tracks %}

      {% assign album_title = album.Album %}
      {% assign track_title = track_json.Track_Title %}
      {% assign track_number = track_json.Track_Number %}
      {% assign matched_album = site.data.tracks | where: "album", album_title | first %}

      {% if matched_album %}
        {% assign matched_track = matched_album.tracks | where_exp: "track", "track.track_number == track_number" | first %}
      {% endif %}

      {% assign album_slug = album_title | slugify %}
      {% assign track_slug = track_title | slugify %}
      
      <li>
        <strong>{{ track_json.Track_Number }}: </strong>
        {% if matched_track %}
          <a href="/tracks/{{ track_slug }}">{{ track_json.Track_Title }}</a>
        {% else %}
          {{ track_json.Track_Title }} (track not found)
        {% endif %}
      </li>
    
    {% endfor %}
  </ul>
  </p>
  
{% endfor %}





