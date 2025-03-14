---
layout: page
title: Track Review
permalink: /track-review/
---

{% include variables.liquid %}

<h1 style="text-align: center;">Tracks Needing Review</h1>

{% assign sorted_albums = site.data.albums.Albums %}
{% for album in sorted_albums %}

  <ul style="list-style-type: none; padding: 0;">

    <h3> {{ album.Album }} </h3>

  </ul>

  {% for track in album.Tracks %}

  <ul style="padding: 0;">
  
      <li style="margin: 20px 0;">
        Track {{ track.Track_Number }}: {{ track.Track_Title }}
        <!-- <p><strong>Speakers adjusted:</strong> {{ track.Speakers_Adjusted }}</p> -->
        <!-- <p><strong>Subtitles adjusted:</strong> {{ track.Subtitles_Adjusted }}</p> -->
      </li>

  </ul>

  {% endfor %}
{% endfor %}

{% if track_needs_review.size == 0 %}
  <p style="text-align: center;">All tracks are reviewed and up to date!</p>
{% endif %}
