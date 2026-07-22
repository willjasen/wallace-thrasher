---
layout: page
title: Transcription Merges
permalink: /transcription-merges/
hide_from_nav: true
---

<link rel="stylesheet" href="{{ '/assets/css/transcription-merges.css' | relative_url }}">

<div class="merge-vault">
  <header class="merge-hero">
    <div>
      <p class="merge-kicker">Whisper WebUI pipeline</p>
      <h1>Transcription merge archive</h1>
      <p>Explore how local Whisper results compare with the repository, which changes still need review, and what each real merge applied.</p>
    </div>
    <div class="merge-mark" aria-hidden="true"><span>W</span><small>LOCAL</small></div>
  </header>

  <p id="merge-status" class="merge-status" role="status">Opening the merge archive…</p>

  <section class="merge-stats" aria-label="Transcription merge summary">
    <article><strong id="merge-stat-runs">0</strong><span>Comparisons</span></article>
    <article><strong id="merge-stat-tracks">0</strong><span>Tracks</span></article>
    <article><strong id="merge-stat-review">0</strong><span>Review lines</span></article>
    <article><strong id="merge-stat-approved">0</strong><span>Approved lines</span></article>
    <article><strong id="merge-stat-merged">0</strong><span>Merged runs</span></article>
    <article><strong id="merge-stat-receipts">0</strong><span>Receipts</span></article>
  </section>

  <section class="merge-pipeline">
    <div><p class="merge-kicker">How it works</p><h2>Analyze → compare → review → merge</h2></div>
    <div class="merge-steps">
      <article><b>01</b><h3>Analyze</h3><p>Whisper creates subtitles and diarized speakers locally.</p></article>
      <article><b>02</b><h3>Compare</h3><p>Generated lines align with the more trusted repository data.</p></article>
      <article><b>03</b><h3>Review</h3><p>Text and speaker differences stay pending unless approved.</p></article>
      <article><b>04</b><h3>Merge</h3><p>Applied changes receive a local receipt and backup record.</p></article>
    </div>
  </section>

  <section class="merge-explorer">
    <div class="merge-section-heading"><div><p class="merge-kicker">Comparison explorer</p><h2>Review a run</h2></div><label>Analysis run<select id="merge-run"></select></label></div>
    <article id="merge-detail" hidden>
      <div class="merge-detail-heading"><div><p id="merge-album" class="merge-kicker"></p><h2 id="merge-track"></h2><p id="merge-meta"></p></div><span id="merge-state" class="merge-badge"></span></div>
      <div id="merge-run-stats" class="merge-run-stats"></div>
      <section class="merge-section"><div class="merge-section-heading"><h3>Speaker mappings</h3><span id="merge-speaker-count"></span></div><div id="merge-speakers" class="merge-chips"></div></section>
      <section class="merge-section"><div class="merge-section-heading"><h3>Metadata proposals</h3><span id="merge-metadata-count"></span></div><div id="merge-metadata" class="merge-chips"></div></section>
      <section class="merge-section"><div class="merge-section-heading merge-filter-heading"><div><h3>Line review</h3><span id="merge-line-count"></span></div><div class="merge-filters"><input id="merge-search" type="search" placeholder="Search dialogue or speaker…"><select id="merge-filter"><option value="all">All lines</option><option value="review">Needs review</option><option value="changes">Approved changes</option><option value="unmatched">Unmatched</option><option value="same">No change</option></select></div></div><div id="merge-lines" class="merge-lines"></div></section>
      <section class="merge-section"><div class="merge-section-heading"><h3>Merge receipts</h3><span id="merge-receipt-count"></span></div><div id="merge-receipts" class="merge-receipts"></div></section>
    </article>
    <div id="merge-empty" class="merge-empty" hidden><strong>No comparison runs yet.</strong><span>Runs appear after a Whisper analysis is compared with repository data.</span></div>
  </section>
</div>

<script src="{{ '/assets/js/transcription-merges.js' | relative_url }}" defer></script>
