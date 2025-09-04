---
layout: page
title: Track Review
permalink: /track-review/
published: true
---

<style>

  .album-info {
    display: flex;
    align-items: center;
    width: auto;
    margin: 0 0 10px 0;
    justify-content: flex-start;
  }

  /* Hide bullet points for all track lists */
  ul.track-list {
    list-style-type: none;
    padding-left: 2em;
    margin-left: 0;
  }

  .album-image {
    margin-left: 0;
    margin-right: 20px;
  }

    .album-image img {
        width: 50px;
        height: 50px;
    }

    .album-text {
       margin-bottom: 0px;
    }

</style>

{% include variables.liquid %}

<h5 style="text-align: center;">Tracks that are shown in <span style='color: green;'>green</span> have been reviewed for its speaker and subtitles content!</h5>
<h5 style="text-align: center; margin: -20px;">Tracks that are shown in <span style='color: yellow;'>yellow</span> still need to be reviewed.</h5>
<hr/>

{% assign sorted_albums = site.data.albums.Albums | sort: "Year" %}
{% for album in sorted_albums %}

  <ul style="list-style-type: none; padding: 0;">
    <div class="album-info">
      <div class="album-image">
        <a href="{{ site.baseurl }}/albums/{{ album.Album_Slug }}">
            <img src="{{ site.baseurl }}/assets/img/albums/{{ album.Album_Picture }}" alt="{{ album.Album }}">
        </a>
      </div>
      <span class="album-text">
        <h3> {{ album.Album }} ({{ album.Year }})</h3>
      </span>
    </div>
  </ul>

  <!-- <div style="align-items: center;"> -->
  <ul class="track-list">
  {% for track in album.Tracks %}
      {% assign track_color = "yellow" %}
      {% if track.Speakers_Adjusted == true and track.Subtitles_Adjusted == true %}
        {% assign track_color = "green" %}
      {% endif %}
      <li style="margin: 0px; color: {{ track_color }};">
        Track {{ track.Track_Number }}: <a href="{{ site.baseurl }}/tracks/{{ album.Album_Slug }}/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
      </li>
  {% endfor %}
  </ul>
  <!-- </div> -->
{% endfor %}

{% if track_needs_review.size == 0 %}
  <p style="text-align: center;">All tracks are reviewed and up to date!</p>
{% endif %}
