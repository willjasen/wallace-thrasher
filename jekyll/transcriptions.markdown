---
layout: page
title: Transcriptions
permalink: /transcriptions/
---

<link rel="stylesheet" href="{{ '/assets/css/transcriptions.css' | relative_url }}">

<main class="transcription-monitor" aria-labelledby="monitor-title">
  <section class="monitor-hero">
    <div>
      <p class="monitor-eyebrow">Local Whisper monitor</p>
      <h1 id="monitor-title">Transcription progress</h1>
      <p class="monitor-intro">Live status for tracks analyzed on this Mac. This page refreshes automatically.</p>
    </div>
    <div class="connection-card">
      <span class="status-dot" id="connection-dot" aria-hidden="true"></span>
      <div><strong id="connection-label">Checking Whisper…</strong><span id="connection-detail">Local connection</span></div>
    </div>
  </section>

  <section class="batch-card" aria-live="polite">
    <div class="batch-heading">
      <div><p class="monitor-eyebrow">Current batch</p><h2 id="album-title">Waiting for a batch</h2></div>
      <button type="button" id="refresh-status">Refresh</button>
    </div>
    <div class="model-line"><span id="batch-state" class="state-pill">Waiting</span><span>Model: <strong id="model-name">—</strong></span><span id="last-updated">Not updated yet</span></div>
    <div class="progress-label"><strong id="progress-count">0 of 0 complete</strong><span id="progress-percent">0%</span></div>
    <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="progress-bar"></span></div>
    <p id="current-track" class="current-track">The next track will appear here.</p>
  </section>

  <section class="summary-grid" aria-label="Batch totals">
    <div><strong id="total-completed">0</strong><span>Completed</span></div>
    <div><strong id="total-running">0</strong><span>Running</span></div>
    <div><strong id="total-pending">0</strong><span>Pending</span></div>
    <div><strong id="total-failed">0</strong><span>Needs attention</span></div>
  </section>

  <section class="track-card">
    <div class="track-heading"><h2>Tracks</h2><span id="refresh-note">Updates every 5 seconds</span></div>
    <ol id="track-list" class="track-list"><li class="empty-row">No batch has started yet.</li></ol>
  </section>
</main>

<script src="{{ '/assets/js/transcriptions.js' | relative_url }}" defer></script>
