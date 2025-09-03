---
layout: page
title: Aliases
permalink: /aliases/
published: true
---

{% include variables.liquid %}

{% assign sorted_albums = site.data.albums.Albums | sort: "Year" %}
{% for album in sorted_albums %}

  {% assign has_aliases = false %}
  {% for track in album.Tracks %}
    {% if track.Aliases and track.Aliases.size > 0 %}
      {% assign has_aliases = true %}
    {% endif %}
  {% endfor %}
  
  {% if has_aliases %}
  <ul style="list-style-type: none; padding: 0;">
    <h3> {{ album.Album }} ({{ album.Year }})</h3>
  </ul>
  {% endif %}

  <ul style="padding: 0px;">
  {% for track in album.Tracks %}
      {% if track.Aliases and track.Aliases.size > 0 %}
          <li style="margin: 0px;">
            Track {{ track.Track_Number }}: <a href="{{ site.baseurl }}/tracks/{{ album.Album_Slug }}/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
          </li>
          <ul style="padding: 0px;">
        {% for alias_used in track.Aliases %}
          <li style="margin: 0px;">
            {{ alias_used }}
          </li>
        {% endfor %}
        </ul>
      {% endif %}
  {% endfor %}
  </ul>
  
{% endfor %}
