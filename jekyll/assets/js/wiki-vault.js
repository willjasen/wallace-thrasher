(function () {
  'use strict';

  const root = document.querySelector('.wiki-vault');
  if (!root) return;

  const elements = {
    status: document.getElementById('vault-status'),
    run: document.getElementById('vault-run'),
    album: document.getElementById('vault-album'),
    track: document.getElementById('vault-track'),
    runNote: document.getElementById('vault-run-note'),
    panel: document.getElementById('vault-track-panel'),
    empty: document.getElementById('vault-empty'),
    albumLabel: document.getElementById('vault-album-label'),
    trackTitle: document.getElementById('vault-track-title'),
    trackMeta: document.getElementById('vault-track-meta'),
    sourceLinks: document.getElementById('vault-source-links'),
    trackStats: document.getElementById('vault-track-stats'),
    mappingTitle: document.getElementById('vault-mapping-title'),
    mappingCount: document.getElementById('vault-mapping-count'),
    speakerMap: document.getElementById('vault-speaker-map'),
    alignmentTitle: document.getElementById('vault-alignment-title'),
    search: document.getElementById('vault-search'),
    filter: document.getElementById('vault-filter'),
    resultCount: document.getElementById('vault-result-count'),
    alignmentList: document.getElementById('vault-alignment-list'),
    mergeCount: document.getElementById('vault-merge-count'),
    mergeList: document.getElementById('vault-merge-list')
  };

  const state = { manifest: null, run: null, album: null, track: null, comparison: null, viewType: null };
  let requestNumber = 0;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function setOptions(select, options, selectedValue) {
    select.replaceChildren();
    options.forEach((option) => {
      const item = node('option', '', option.label);
      item.value = option.value;
      item.selected = option.value === selectedValue;
      select.appendChild(item);
    });
    select.disabled = options.length === 0;
  }

  function number(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
  }

  function runDate(run) {
    if (!run.timestamp_ms) return 'Unknown date';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(run.timestamp_ms));
  }

  function percentage(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function absoluteDataPath(path) {
    if (!path) return null;
    const manifestUrl = new URL(root.dataset.manifestUrl, window.location.href);
    return new URL(path.replace(/^\//, ''), `${manifestUrl.origin}/`).toString();
  }

  function addLink(container, label, href, external) {
    if (!href) return;
    const link = node('a', '', label);
    link.href = href;
    if (external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    container.appendChild(link);
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.run) url.searchParams.set('run', state.run.id);
    if (state.album) url.searchParams.set('album', state.album.slug);
    if (state.track) url.searchParams.set('track', state.track.slug);
    history.replaceState(null, '', url);
  }

  function selectedFromQuery(items, key, fallback) {
    const requested = new URLSearchParams(window.location.search).get(key);
    return items.find((item) => (item.id || item.slug) === requested) || fallback;
  }

  function chooseRun(runId, useQuery) {
    const runs = state.manifest.runs;
    state.run = runs.find((run) => run.id === runId) || runs.find((run) => (run.albums || []).length > 0) || runs[0];
    if (!state.run) return;

    elements.run.value = state.run.id;
    elements.runNote.textContent = `${state.run.id} · ${runDate(state.run)} · ${number(state.run.scrape_track_count)} scraped · ${number(state.run.track_count)} compared${state.run.latest ? ' · latest scrape' : ''}`;

    const albums = state.run.albums || [];
    state.album = useQuery ? selectedFromQuery(albums, 'album', albums[0]) : albums[0];
    setOptions(elements.album, albums.map((album) => ({ value: album.slug, label: `${album.title} (${album.tracks.length})` })), state.album && state.album.slug);
    chooseAlbum(state.album && state.album.slug, useQuery);
  }

  function chooseAlbum(albumSlug, useQuery) {
    const albums = state.run ? state.run.albums : [];
    state.album = albums.find((album) => album.slug === albumSlug) || albums[0];
    const tracks = state.album ? state.album.tracks : [];
    state.track = useQuery ? selectedFromQuery(tracks, 'track', tracks[0]) : tracks[0];
    setOptions(elements.track, tracks.map((track) => {
      const summary = track.summary || {};
      const review = Number(summary.text_review || 0) + Number(summary.text_group_review || 0);
      const status = track.comparison_path
        ? (review ? `${review} review` : 'compared')
        : (track.not_found ? 'wiki page missing' : `${number(track.transcript_lines)} scraped lines`);
      return { value: track.slug, label: `${track.title} · ${status}` };
    }), state.track && state.track.slug);
    chooseTrack(state.track && state.track.slug);
  }

  async function chooseTrack(trackSlug) {
    const tracks = state.album ? state.album.tracks : [];
    state.track = tracks.find((track) => track.slug === trackSlug) || tracks[0];
    state.comparison = null;
    state.viewType = null;
    elements.alignmentList.replaceChildren();

    if (!state.track) {
      elements.panel.hidden = true;
      elements.empty.hidden = false;
      updateUrl();
      return;
    }

    elements.empty.hidden = true;
    elements.panel.hidden = false;
    elements.status.textContent = `Loading ${state.track.title}…`;
    const currentRequest = ++requestNumber;

    try {
      const dataPath = state.track.comparison_path || state.track.scrape_path;
      if (!dataPath) throw new Error('No saved data path');
      const response = await fetch(absoluteDataPath(dataPath), { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const record = await response.json();
      if (currentRequest !== requestNumber) return;
      if (state.track.comparison_path) {
        state.comparison = record;
        state.viewType = 'comparison';
        renderTrack();
      } else {
        state.viewType = 'scrape';
        renderScrape(record);
      }
      elements.status.textContent = `Data ready · ${number(state.manifest.stats.scrape_records)} scrapes and ${number(state.manifest.stats.comparison_tracks)} comparisons indexed`;
    } catch (error) {
      console.error('Unable to load wiki comparison:', error);
      elements.status.textContent = 'This comparison record could not be opened.';
      elements.status.classList.add('is-error');
    }

    updateUrl();
  }

  function statCard(value, label) {
    const card = node('article');
    card.append(node('strong', '', value), node('small', '', label));
    return card;
  }

  function renderTrack() {
    const comparison = state.comparison;
    const summary = comparison.summary || {};
    const total = Number(summary.total_json_entries || 0);
    const matched = Number(summary.matched || 0);
    const coverage = total ? matched / total : 0;
    const review = Number(summary.text_review || 0) + Number(summary.text_group_review || 0);

    elements.albumLabel.textContent = comparison.album || state.album.title;
    elements.trackTitle.textContent = comparison.track || state.track.title;
    const generated = comparison.generated_at ? new Date(comparison.generated_at).toLocaleString() : 'legacy comparison';
    elements.trackMeta.textContent = `Generated ${generated} · snapshot ${comparison.snapshot || state.run.id}`;

    elements.sourceLinks.replaceChildren();
    addLink(elements.sourceLinks, 'Wiki page ↗', comparison.wiki_url || state.track.wiki_url, true);
    addLink(elements.sourceLinks, 'Comparison JSON', absoluteDataPath(state.track.comparison_path));
    addLink(elements.sourceLinks, 'Scrape JSON', absoluteDataPath(state.track.scrape_path));

    elements.trackStats.replaceChildren(
      statCard(percentage(coverage), 'subtitle coverage'),
      statCard(number(matched), 'matched entries'),
      statCard(number(summary.unmatched_json), 'unmatched entries'),
      statCard(number(summary.text_auto_correct), 'auto corrections'),
      statCard(number(review), 'review flags')
    );

    elements.mappingTitle.textContent = 'Speaker map';
    elements.alignmentTitle.textContent = 'Alignment review';
    elements.filter.disabled = false;
    const mappings = Object.entries(comparison.speaker_mapping || {});
    elements.mappingCount.textContent = `${mappings.length} accepted`;
    elements.speakerMap.replaceChildren();
    mappings.sort(([a], [b]) => a.localeCompare(b)).forEach(([source, target]) => {
      const chip = node('span', 'vault-speaker-chip');
      chip.append(node('i', '', source), node('span', '', '→'), node('b', '', target));
      elements.speakerMap.appendChild(chip);
    });

    renderAlignments();
  }

  function renderScrape(scrape) {
    const transcript = Array.isArray(scrape.transcript) ? scrape.transcript : [];
    const speakers = [...new Set(transcript.map((line) => line[0]).filter(Boolean))];
    state.comparison = {
      alignments: transcript.map((line, index) => ({
        json_index: index + 1,
        wiki_speaker: line[0],
        wiki_text: line[1],
        match_type: 'scrape'
      }))
    };

    elements.albumLabel.textContent = state.album.title;
    elements.trackTitle.textContent = scrape.track_title || state.track.title;
    elements.trackMeta.textContent = `Scraped ${runDate(state.run)} · snapshot ${state.run.id}`;
    elements.sourceLinks.replaceChildren();
    addLink(elements.sourceLinks, 'Wiki page ↗', scrape.wiki_url || state.track.wiki_url, true);
    addLink(elements.sourceLinks, 'Scrape JSON', absoluteDataPath(state.track.scrape_path));

    const status = scrape.not_found ? 'Page not found' : scrape.wiki_title ? 'Page found' : 'No wiki page';
    elements.trackStats.replaceChildren(
      statCard(number(transcript.length), 'transcript lines'),
      statCard(number(speakers.length), 'speaker labels'),
      statCard(scrape.wiki_pageid || '—', 'wiki page ID'),
      statCard(status, 'scrape status'),
      statCard(state.track.comparison_path ? 'Available' : 'Not run', 'comparison')
    );

    elements.mappingTitle.textContent = 'Speaker labels';
    elements.mappingCount.textContent = `${number(speakers.length)} found`;
    elements.speakerMap.replaceChildren();
    speakers.sort((a, b) => a.localeCompare(b)).forEach((speaker) => {
      elements.speakerMap.appendChild(node('span', 'vault-speaker-chip', speaker));
    });
    elements.alignmentTitle.textContent = 'Scraped transcript';
    elements.filter.value = 'all';
    elements.filter.disabled = true;
    renderAlignments();
  }

  function alignmentCategory(alignment) {
    if (state.viewType === 'scrape') return 'matched';
    if (alignment.match_type === 'unmatched_json' || !alignment.wiki_text) return 'unmatched';
    if (alignment.text_action === 'review' || alignment.text_action === 'group_review') return 'review';
    if (alignment.text_action === 'auto_correct' || alignment.text_action === 'approved' ||
        (alignment.proposed_speaker && alignment.proposed_speaker !== alignment.json_speaker)) return 'changes';
    return 'matched';
  }

  function renderAlignments() {
    if (!state.comparison) return;
    const query = elements.search.value.trim().toLocaleLowerCase();
    const filter = elements.filter.value;
    const alignments = (state.comparison.alignments || []).filter((alignment) => {
      const category = alignmentCategory(alignment);
      if (filter !== 'all' && category !== filter && !(filter === 'changes' && category === 'review')) return false;
      if (!query) return true;
      return [alignment.json_index, alignment.json_speaker, alignment.json_text, alignment.wiki_speaker, alignment.wiki_text]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    });

    elements.resultCount.textContent = `${number(alignments.length)} of ${number((state.comparison.alignments || []).length)} lines`;
    elements.alignmentList.replaceChildren();

    if (!alignments.length) {
      const empty = node('div', 'vault-empty');
      empty.append(node('strong', '', 'No lines match this view.'), node('span', '', 'Try a different filter or search phrase.'));
      elements.alignmentList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    alignments.forEach((alignment) => fragment.appendChild(renderAlignment(alignment)));
    elements.alignmentList.appendChild(fragment);
  }

  function renderAlignment(alignment) {
    if (state.viewType === 'scrape') {
      const card = node('article', 'vault-line-card is-scrape');
      const top = node('div', 'vault-line-top');
      top.append(
        node('span', 'vault-line-index', `#${alignment.json_index}`),
        node('span', 'vault-badge', 'wiki transcript')
      );
      const body = node('div', 'vault-line-body is-single');
      body.append(dialogue('Whipapedia', alignment.wiki_speaker, alignment.wiki_text, true));
      card.append(top, body);
      return card;
    }
    const category = alignmentCategory(alignment);
    const card = node('article', `vault-line-card is-${category}`);
    const top = node('div', 'vault-line-top');
    const similarity = alignment.similarity === null || alignment.similarity === undefined
      ? '—' : percentage(alignment.similarity);
    const action = String(alignment.text_action || alignment.match_type || category).replaceAll('_', ' ');
    top.append(
      node('span', 'vault-line-index', `#${alignment.json_index}`),
      node('span', '', `${similarity} similarity`),
      node('span', 'vault-badge', action)
    );

    const body = node('div', 'vault-line-body');
    body.append(
      dialogue('Local JSON', alignment.json_speaker, alignment.json_text, false),
      dialogue('Whipapedia', alignment.wiki_speaker, alignment.wiki_text, true)
    );
    card.append(top, body);
    return card;
  }

  function dialogue(source, speaker, text, wiki) {
    const container = node('div', 'vault-dialogue');
    const label = node('small');
    label.append(document.createTextNode(`${source} · `), node('b', '', speaker || 'no speaker'));
    const copy = node('p', text ? '' : 'vault-no-match', text || (wiki ? 'No aligned wiki line' : 'No local subtitle text'));
    container.append(label, copy);
    return container;
  }

  function bindEvents() {
    elements.run.addEventListener('change', () => chooseRun(elements.run.value, false));
    elements.album.addEventListener('change', () => chooseAlbum(elements.album.value, false));
    elements.track.addEventListener('change', () => chooseTrack(elements.track.value));
    elements.search.addEventListener('input', renderAlignments);
    elements.filter.addEventListener('change', renderAlignments);
  }

  function renderMergeRuns() {
    const runs = state.manifest.merge_runs || [];
    elements.mergeCount.textContent = `${number(runs.length)} runs · ${number(state.manifest.stats.merge_backup_files)} files preserved`;
    elements.mergeList.replaceChildren();

    if (!runs.length) {
      const empty = node('div', 'vault-empty');
      empty.append(node('strong', '', 'No merge backups yet.'), node('span', '', 'A backup run will appear after the first real merge.'));
      elements.mergeList.appendChild(empty);
      return;
    }

    runs.forEach((run) => {
      const card = node('article', 'vault-merge-card');
      const heading = node('div', 'vault-merge-heading');
      const title = node('div');
      title.append(node('strong', '', runDate(run)), node('small', '', run.id));
      heading.append(title, node('span', 'vault-merge-total', `${number(run.file_count)} files`));
      card.appendChild(heading);

      const albums = node('div', 'vault-merge-albums');
      (run.albums || []).forEach((album) => {
        albums.appendChild(node('span', '', `${album.title} · ${number(album.file_count)}`));
      });
      if (!run.file_count) albums.appendChild(node('span', 'is-empty', 'No files were changed in this run'));
      card.appendChild(albums);
      elements.mergeList.appendChild(card);
    });
  }

  async function start() {
    try {
      const response = await fetch(root.dataset.manifestUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.manifest = await response.json();

      document.getElementById('stat-scrape-records').textContent = number(state.manifest.stats.scrape_records);
      document.getElementById('stat-wiki-pages').textContent = number(state.manifest.stats.wiki_pages_found);
      document.getElementById('stat-missing-pages').textContent = number(state.manifest.stats.wiki_pages_missing);
      document.getElementById('stat-comparison-tracks').textContent = number(state.manifest.stats.comparison_tracks);
      document.getElementById('stat-merged-files').textContent = number(state.manifest.stats.merge_backup_files);
      document.getElementById('stat-runs').textContent = number((state.manifest.runs || []).length + (state.manifest.merge_runs || []).length);
      renderMergeRuns();

      const runs = state.manifest.runs || [];
      const fallback = runs.find((run) => (run.albums || []).length > 0) || runs[0];
      const selected = selectedFromQuery(runs, 'run', fallback);
      setOptions(elements.run, runs.map((run) => ({
        value: run.id,
        label: `${runDate(run)} · ${run.label} · ${number(run.scrape_track_count)} scraped / ${number(run.track_count)} compared${run.latest ? ' · latest' : ''}`
      })), selected && selected.id);
      bindEvents();
      chooseRun(selected && selected.id, true);
    } catch (error) {
      console.error('Unable to load wiki archive manifest:', error);
      elements.status.textContent = 'The archive index could not be loaded.';
      elements.status.classList.add('is-error');
      elements.empty.hidden = false;
    }
  }

  start();
})();
