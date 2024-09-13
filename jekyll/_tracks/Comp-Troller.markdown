---
layout: default
title: Comp-Troller
album: Best Before '24
permalink: /comp-troller/
track_number: "4"
---

{% assign album = site.data.albums.Albums %}
{% assign track = site.data.Comp-Troller %}

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
