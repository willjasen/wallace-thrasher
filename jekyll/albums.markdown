---
layout: default
title: Albums
permalink: /albums/
---

<h1>{{ page.title }}</h1>

{% for album in site.data.albums.Albums %}

<h2>Album: {{ album.Album }}</h2>
<h3>Year: {{ album.Year }}</h3>
<p><img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150"></p>

<h3>Tracks</h3>
<ul>
  {% for track_json in album.Tracks %}

    {% assign track_number = track_json.Track_Number %}
    {% assign matched_track = site.tracks | where: "track_number", track_number | first %}

    <li>
      <strong>{{ track_json.Track_Number }}: </strong>
      <a href="{{ matched_track.url }}">{{ track_json.Track_Title }}</a>
    </li>
   
  {% endfor %}
</ul>

{% endfor %}





