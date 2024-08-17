---
layout: default
title: Albums
---

<h1>{{ page.title }}</h1>

{% assign album = site.data.albums.Albums %}

<h2>Album: {{ album.Album }}</h2>
<h3>Year: {{ album.Year }}</h3>
<p><img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150"></p>


<h3>Tracks</h3>
<ul>
  {% for track in album.Tracks %}
    <li>
      <strong>{{ track.Track_Number }}: {{ track.Track_Title }}</strong>
      <br>
      <!-- <a href="{{ track.Track_JSONPath }}" target="_blank">View Track JSON</a> -->
    </li>
  {% endfor %}
</ul>
