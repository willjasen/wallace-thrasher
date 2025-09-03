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
        {% for alias_used in track.Aliases %}
          <li style="margin: 0px;">
            {{ alias_used }}
          </li>
        {% endfor %}
      {% endif %}
  {% endfor %}
  </ul>

{% endfor %}

{% if track_needs_review.size == 0 %}
  <p style="text-align: center;">All tracks are reviewed and up to date!</p>
{% endif %}


  
  
 