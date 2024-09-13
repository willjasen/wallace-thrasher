---
layout: default
title: Victor's Mixup
album: Best Before '24
permalink: /victors-mixup/
track_number: "2"
---

{% assign album = site.data.albums.Albums %}
{% assign track = site.data.Victors_Mixup %}

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
