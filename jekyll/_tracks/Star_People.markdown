---
layout: default
title: Star People
album: Best Before '24
permalink: /star-people/
track_number: "6"
---

{% assign album = site.data.albums.Albums %}
{% assign track = site.data.Star_People %}

<h2>Album: {{ album.Album }}</h2>
<h3>Year: {{ album.Year }}</h3>
<p><img src="/assets/png/{{ album.Album_Picture }}" alt="{{ album.Album }}" width="150" height="150"></p>

<h3>Track: {{ page.title }}</h3>
<ul>
  {% for trackText in track %}
    <li>
      <strong>{{ trackText.Speaker }}:</strong> {{ trackText.Text }}
      <br>
    </li>
  {% endfor %}
</ul>
