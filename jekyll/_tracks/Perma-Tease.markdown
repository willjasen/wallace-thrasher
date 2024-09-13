---
layout: default
title: Perma-Tease
album: Best Before '24
permalink: /perma-tease/
track_number: "12"
---

{% assign album = site.data.albums.Albums %}
{% assign track = site.data.Perma-Tease %}

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
