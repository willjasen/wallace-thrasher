---
layout: page
title: Track Review
permalink: /track-review/
published: true
---

{% include variables.liquid %}

<h5 style="text-align: center;">Tracks that are shown in <span style='color: green;'>green</span> have been reviewed for its speaker and subtitles content!</h5>
<h5 style="text-align: center; margin: -20px;">Tracks that are shown in <span style='color: yellow;'>yellow</span> still need to be reviewed.</h5>
<hr/>

{% assign sorted_albums = site.data.albums.Albums | sort: "Year" %}
{% for album in sorted_albums %}

  <ul style="list-style-type: none; padding: 0;">
    <h3> {{ album.Album }} ({{ album.Year }})</h3>
  </ul>

  <ul style="padding: 0px;">
  {% for track in album.Tracks %}
      {% if track.Speakers_Adjusted != true or track.Subtitles_Adjusted != true %}
          <li style="margin: 0px; color: yellow;">
            Track {{ track.Track_Number }}: <a href="/tracks/{{ album.Album_Slug }}/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
          </li>
      {% else %}
          <li style="margin: 0px; color: green;">
            Track {{ track.Track_Number }}: <a href="/tracks/{{ album.Album_Slug }}/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
          </li>
      {% endif %}
  {% endfor %}
  </ul>
{% endfor %}

{% if track_needs_review.size == 0 %}
  <p style="text-align: center;">All tracks are reviewed and up to date!</p>
{% endif %}
