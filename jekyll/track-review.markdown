---
layout: page
title: Track Review
permalink: /track-review/
published: true
---

{% include variables.liquid %}

<h1 style="text-align: center;">Tracks Needing Review</h1>

{% assign sorted_albums = site.data.albums.Albums %}
{% for album in sorted_albums %}

  <ul style="list-style-type: none; padding: 0;">
    <h3> {{ album.Album }} </h3>
  </ul>

  <ul style="padding: 0px;">
  {% for track in album.Tracks %}
      {% if track_speakers_detail != true or track_subtitles_detail != true %}
          <li style="margin: 0px;">
            Track {{ track.Track_Number }}: <a href="/tracks/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
          </li>
      {% endif %}
  {% endfor %}
  </ul>
{% endfor %}

{% if track_needs_review.size == 0 %}
  <p style="text-align: center;">All tracks are reviewed and up to date!</p>
{% endif %}
