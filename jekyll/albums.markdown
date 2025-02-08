---
layout: default
title: Albums
permalink: /albums/
---

{% for album in site.data.albums.Albums %}

  <h2>Album: {{ album.Album }}</h2>
  <h3>Year: {{ album.Year }}</h3>
  <p><img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150"></p>

  <h3>Tracks</h3>
  <ul>
    {% for track_json in album.Tracks %}

      {% assign album_title = album.Album %}
      {% assign track_title = track_json.Track_Title %}
      {% assign track_number = track_json.Track_Number %}
      {% assign matched_album = site.data.tracks | where: "album", album_title | first %}

      {% if matched_album %}
        {% assign matched_track = matched_album.tracks | where_exp: "track", "track.track_number == track_number" | first %}
      {% endif %}

      {% assign track_slug = track_title | slugify %}
      {% assign album_slug = album_title | slugify %}
      
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
  

{% endfor %}





