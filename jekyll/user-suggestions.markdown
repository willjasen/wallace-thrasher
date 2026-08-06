---
layout: page
title: Suggestions Leaderboard
nav_title: Leaderboard
description: GitHub pull requests submitted by stretchie contributors.
permalink: /user-suggestions/
---

<link rel="stylesheet" href="{{ '/assets/css/user-suggestions.css' | relative_url }}">
<style>.suggestion-avatar{width:1.2rem;height:1.2rem}</style>

<main class="suggestions-page" data-repository="willjasen/wallace-thrasher">
  <header class="suggestions-hero">
    <div>
      <p class="suggestions-kicker">COMMUNITY ACTIVITY</p>
      <h1>GitHub user suggestions</h1>
      <p class="suggestions-intro">The Leaderboard shows the GitHub users who have submitted suggestions to improve stretchie, along with the number of suggestions they have submitted. Every suggestion is reviewed before it becomes part of the site.</p>
    </div>
    <a class="suggestions-github-link" href="https://github.com/willjasen/wallace-thrasher/pulls?q=is%3Apr+%5BSuggestion%5D" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
  </header>

  <section class="suggestions-stats" aria-label="Suggestion summary">
    <article><strong id="suggestion-total">—</strong><span>suggestions submitted</span></article>
    <article><strong id="suggestion-contributors">—</strong><span>contributors</span></article>
    <article><strong id="suggestion-merged">—</strong><span>merged</span></article>
    <article><strong id="suggestion-open">—</strong><span>awaiting review</span></article>
  </section>

  <section class="suggestions-panel" aria-labelledby="contributors-heading">
    <div class="suggestions-heading"><div><p class="suggestions-kicker">THE PEOPLE BEHIND THE FIXES</p><h2 id="contributors-heading">Contributors</h2></div><span id="suggestion-updated">Loading GitHub data…</span></div>
    <div id="contributor-list" class="contributor-list" aria-live="polite"><p class="suggestions-loading">Fetching suggestion history…</p></div>
  </section>

  <section class="suggestions-panel" aria-labelledby="recent-heading">
    <div class="suggestions-heading"><div><p class="suggestions-kicker">LATEST ACTIVITY</p><h2 id="recent-heading">Recent suggestions</h2></div></div>
    <div id="suggestion-list" class="suggestion-list" aria-live="polite"></div>
  </section>
</main>

<script src="{{ '/assets/js/user-suggestions.js' | relative_url }}" defer></script>
