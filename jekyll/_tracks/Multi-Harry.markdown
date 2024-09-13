---
layout: default
title: Multi-Harry
album: Best Before '24
permalink: /multi-harry/
track_number: "8"
---

{% assign album = site.data.albums.Albums %}
{% assign track = site.data.Multi-Harry %}

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
