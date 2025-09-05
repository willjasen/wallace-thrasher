---
layout: page
title: Aliases
permalink: /aliases/
published: true
---

<div class="search-flex-row">
  <input type="text" id="aliases-search-input" placeholder="Search...">
  {%- include load-search-with-progress.html -%}
</div>
<ul id="aliases-search-results"></ul>
<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/search-box.css">

<style>
  .loader {
    opacity: 0.2;
    pointer-events: none;
  }

  .loader input,
  .loader ul {
    opacity: 1 !important;
  }
</style>

<hr/>

<style>

  .album-info {
    display: flex;
    align-items: center;
    width: auto;
    margin: 0 0 10px 0;
    justify-content: flex-start;
  }

  ul.track-list {
    list-style-type: none;
    padding-left: 2em;
    margin-left: 0;
  }

  .album-image {
    margin-left: 0;
    margin-right: 20px;
  }

  .album-image img {
      width: 50px;
      height: 50px;
  }

  .album-text {
     margin-bottom: 0px;
  }

</style>

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
    <div class="album-info">
      <div class="album-image">
        <a href="{{ site.baseurl }}/albums/{{ album.Album_Slug }}">
            <img src="{{ site.baseurl }}/assets/img/albums/{{ album.Album_Picture }}" alt="{{ album.Album }}">
        </a>
      </div>
      <span class="album-text">
        <h3> {{ album.Album }} ({{ album.Year }})</h3>
      </span>
    </div>
  </ul>
  {% endif %}

  <ul class="track-list">
  {% for track in album.Tracks %}
      {% if track.Aliases and track.Aliases.size > 0 %}
          <li style="margin: 0px;">
            Track {{ track.Track_Number }}: <a href="{{ site.baseurl }}/tracks/{{ album.Album_Slug }}/{{ track.Track_Slug }}">{{ track.Track_Title }}</a>
          </li>
          <ul>
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
