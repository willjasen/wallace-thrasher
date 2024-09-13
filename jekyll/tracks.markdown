---
layout: default
title: Tracks
permalink: /tracks/
---

{% assign album = site.data.albums.Albums %}
{% assign trackBooper = site.data.Booper %}

<h2>Album: {{ album.Album }}</h2>
<h3>Year: {{ album.Year }}</h3>
<p><img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150"></p>

<h3>Track: Booper</h3>
<ul>
  {% for trackTest in trackBooper %}
    <li>
      <strong>{{ trackTest.Speaker }}:</strong> {{ trackTest.Text }}
      <br>
    </li>
  {% endfor %}
</ul>
