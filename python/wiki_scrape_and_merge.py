#!/usr/bin/env python3
"""
wiki_scrape_and_merge.py

Scrapes transcript data from talkinwhipapedia.fandom.com, compares it with
local track JSON subtitle files, and can merge corrections back into the source.

The wiki has human-curated transcripts with real speaker names (e.g. "LPC",
"Larry", "Pam"). The local JSON files have auto-generated speaker codes
(SPEAKER_00, SPEAKER_01, …) and Whisper-transcribed text that may contain
errors.  This tool bridges the two sources.

Scrape snapshots
────────────────
Each `scrape` run creates a timestamped snapshot under wiki_cache/snapshots/.
All subsequent commands default to the most-recent snapshot (recorded in
wiki_cache/latest).  Pass --snapshot <name> to target a specific one.

Usage
─────
  # 1. Fetch & cache wiki transcripts (creates a new snapshot)
  python wiki_scrape_and_merge.py scrape
  python wiki_scrape_and_merge.py scrape --snapshot my-label   # custom name
  python wiki_scrape_and_merge.py scrape --album longmont-potion-castle-4
  python wiki_scrape_and_merge.py scrape --album longmont-potion-castle-4 --track a-simple-inquiry
  python wiki_scrape_and_merge.py scrape --force               # overwrite existing snapshot

  # 2. List available snapshots
  python wiki_scrape_and_merge.py list-snapshots

  # 3. Activate a different snapshot as the default
  python wiki_scrape_and_merge.py use <snapshot>

  # 4. Compare wiki transcripts with local JSON files
  python wiki_scrape_and_merge.py compare
  python wiki_scrape_and_merge.py compare --snapshot 20260408-142301
  python wiki_scrape_and_merge.py compare --album longmont-potion-castle-4
  python wiki_scrape_and_merge.py compare --threshold 0.5   # lower = more permissive alignment

  # 5. Merge approved changes from compare output into source JSON files
  python wiki_scrape_and_merge.py merge
  python wiki_scrape_and_merge.py merge --snapshot 20260408-142301
  python wiki_scrape_and_merge.py merge --album longmont-potion-castle-4 --track a-simple-inquiry
  python wiki_scrape_and_merge.py merge --dry-run           # show changes without writing
  python wiki_scrape_and_merge.py merge --auto-threshold 0.85  # min similarity to auto-apply text
  python wiki_scrape_and_merge.py merge --speakers-only     # only update speaker labels

  # 6. Print a readable summary of compare results
  python wiki_scrape_and_merge.py report
  python wiki_scrape_and_merge.py report --snapshot 20260408-142301
  python wiki_scrape_and_merge.py report --album longmont-potion-castle-4 --track a-simple-inquiry

  # 7. Migrate legacy flat wiki_cache/ structure into a named snapshot
  python wiki_scrape_and_merge.py migrate
  python wiki_scrape_and_merge.py migrate --snapshot initial  # custom name

Dependencies: Python 3.10+ standard library only (urllib, json, re, difflib, etc.)
"""

import argparse
import datetime
import difflib
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR     = Path(__file__).parent.resolve()
PROJECT_ROOT   = SCRIPT_DIR.parent
JEKYLL_DIR     = PROJECT_ROOT / "jekyll"
JSON_SRC_DIR   = JEKYLL_DIR / "assets" / "json"
DATA_JSON      = JSON_SRC_DIR / "data.json"
CACHE_DIR      = SCRIPT_DIR / "wiki_cache"
SNAPSHOTS_DIR  = CACHE_DIR / "snapshots"   # each scrape run creates a subdir here
LATEST_FILE    = CACHE_DIR / "latest"      # plain-text file containing the active snapshot name
COMPARE_DIR    = SCRIPT_DIR / "wiki_compare_output"
BACKUP_DIR     = SCRIPT_DIR / "wiki_merge_backups"

# ── Wiki API ──────────────────────────────────────────────────────────────────

WIKI_API       = "https://talkinwhipapedia.fandom.com/api.php"
REQUEST_DELAY  = 0.8   # seconds between requests (be polite)
USER_AGENT     = "wallace-thrasher-wiki-scraper/1.0 (github.com/willjasen/wallace-thrasher)"
SNAPSHOT_RE    = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}\Z")

# ── Helpers: HTTP ─────────────────────────────────────────────────────────────

class WikiRequestError(RuntimeError):
    """Raised when the wiki cannot be reached after retrying."""


def _request_json(url: str, attempts: int = 3) -> object:
    """Fetch JSON with bounded retries; never turn a network error into a miss."""
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(1.5 * attempt)
    raise WikiRequestError(f"wiki request failed after {attempts} attempts: {last_error}")

def fetch_wikitext(title: str) -> dict | None:
    """
    Fetch the wikitext of a page from the Fandom API.
    Returns dict with keys: title, pageid, wikitext  (or None if page missing).
    """
    params = urllib.parse.urlencode({
        "action":  "query",
        "prop":    "revisions",
        "rvprop":  "content",
        "rvslots": "main",
        "titles":  title,
        "format":  "json",
        "formatversion": "2",
    })
    url = f"{WIKI_API}?{params}"
    data = _request_json(url)

    pages = data.get("query", {}).get("pages", [])
    if not pages:
        return None
    page = pages[0]
    if page.get("missing"):
        return None

    revisions = page.get("revisions", [])
    if not revisions:
        return None
    wikitext = revisions[0].get("slots", {}).get("main", {}).get("content", "")
    return {
        "title":    page["title"],
        "pageid":   page["pageid"],
        "wikitext": wikitext,
    }

# ── Helpers: Wikitext parsing ─────────────────────────────────────────────────

def _extract_cell_content(line: str) -> str:
    """
    Given a raw wikitext table cell line (starts with | or !), return the cell
    content (everything after the attribute separator pipe).

    e.g.  '| style="width:10%;"|Larry:'   → 'Larry:'
          '| style="width:10%;" |Larry:'  → 'Larry:'
          '| Larry:'                       → 'Larry:'
    """
    # Strip leading | or ! and optional whitespace
    stripped = line.lstrip("|! \t")
    # Quoted and unquoted attributes are both valid MediaWiki markup:
    #   | style=width:13%; text-align:right; |Larry:
    # Only treat a pipe as an attribute separator when the prefix looks like
    # table-cell attributes; ordinary transcript text may itself contain pipes.
    if re.match(
        r"(?:style|class|id|rowspan|colspan|align|valign|width)\s*=",
        stripped,
        re.IGNORECASE,
    ) and "|" in stripped:
        return stripped.split("|", 1)[1].strip()
    # No style attributes — the content is everything
    return stripped.strip()


def _clean_wiki_text(raw: str) -> str:
    """Strip wiki markup, returning plain text."""
    # Italic/bold markers (order matters: longest first)
    raw = re.sub(r"''''(.+?)''''", r"\1", raw)
    raw = re.sub(r"'''(.+?)'''",   r"\1", raw)
    raw = re.sub(r"''(.+?)''",     r"\1", raw)
    # Wiki links with display text: [[Page|Text]] → Text
    raw = re.sub(r"\[\[[^\]|]+\|([^\]]+)\]\]", r"\1", raw)
    # Wiki links without display text: [[Page]] → Page
    raw = re.sub(r"\[\[([^\]]+)\]\]", r"\1", raw)
    # External links with labels: [https://example.test Label] → Label
    raw = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", raw)
    # Bare external links are metadata, not spoken transcript text.
    raw = re.sub(r"\[https?://[^\]]+\]", "", raw)
    # HTML tags (spans etc.)
    raw = re.sub(r"<[^>]+>", "", raw)
    # Collapse whitespace
    return re.sub(r"\s+", " ", raw).strip()


def _extract_speaker_name(cell_content: str) -> str | None:
    """
    Given the content of a speaker cell (first column of a transcript row),
    return the human-readable speaker name, or None if the cell is empty.

    e.g.  '[[Rifle|<span style="color:#fff;">Larry</span>]]:'  → 'Larry'
          'LPC:'                                                → 'LPC'
          ''                                                    → None
    """
    content = cell_content.strip()
    if not content:
        return None
    # Remove trailing colon
    if content.endswith(":"):
        content = content[:-1].rstrip()
    if not content:
        return None

    # 1) Wikilink with span: [[Page|<span ...>Name</span>]]
    m = re.search(r"\[\[[^\]]*\|<span[^>]*>([^<]+)</span>\]\]", content)
    if m:
        return m.group(1).strip()

    # 2) Wikilink with plain display text: [[Page|Name]]
    m = re.search(r"\[\[[^\]|]+\|([^\]<>]+)\]\]", content)
    if m:
        return m.group(1).strip()

    # 3) Bare span: <span ...>Name</span>
    m = re.search(r"<span[^>]*>([^<]+)</span>", content)
    if m:
        return m.group(1).strip()

    # 4) Plain text
    cleaned = _clean_wiki_text(content).strip()
    return cleaned if cleaned else None


def parse_transcript_from_wikitext(wikitext: str) -> list[tuple[str | None, str]]:
    """
    Parse the == Transcript == section from wikitext.

    Returns list of (speaker_name_or_None, text) tuples.
    Sound/action entries (e.g. ``[beep]``) have speaker = None.
    Lines with only sound effects embedded in speech are kept whole.
    """
    # Extract just the Transcript section
    transcript_match = re.search(
        r"==\s*Transcript\s*==(.+?)(?:\n==\s*\w|\Z)",
        wikitext,
        re.DOTALL | re.IGNORECASE,
    )
    if not transcript_match:
        return []

    transcript_wikitext = transcript_match.group(1)

    # Find all wiki tables within the transcript section
    # A table goes from {| to |}
    table_pattern = re.compile(r"\{\|.*?\|\}", re.DOTALL)
    tables = table_pattern.findall(transcript_wikitext)

    lines: list[tuple[str | None, str]] = []

    for table in tables:
        # Split into rows at |-
        rows = re.split(r"\n\|-[^\n]*\n?", table)

        for row in rows:
            # Collect cell lines (lines starting with | or !)
            # Ignore lines starting with {| or |}
            cell_lines = []
            for raw_line in row.split("\n"):
                stripped = raw_line.lstrip()
                if (stripped.startswith("|") or stripped.startswith("!")) and not \
                   (stripped.startswith("{|") or stripped.startswith("|}") or
                    stripped.startswith("|-")):
                    cell_lines.append(raw_line)

            if not cell_lines:
                continue

            # Each row has up to two cells: speaker (col 1) and text (col 2).
            # MediaWiki allows two cells on one line separated by ||
            cells = []
            for cl in cell_lines:
                # Handle || (two cells on one line)
                if "||" in cl:
                    # Split on first || that isn't inside [[...]]
                    # Simple approach: split on ||
                    parts = cl.split("||", 1)
                    cells.extend(parts)
                else:
                    cells.append(cl)

            if len(cells) < 2:
                # May be a sound-only row (empty speaker, just text)
                if cells:
                    text_raw = _extract_cell_content(cells[0])
                    text = _clean_wiki_text(text_raw)
                    if text:
                        lines.append((None, text))
                continue

            speaker_raw = _extract_cell_content(cells[0])
            text_raw    = _extract_cell_content(cells[1])

            speaker = _extract_speaker_name(speaker_raw)
            text    = _clean_wiki_text(text_raw)

            if text:
                lines.append((speaker, text))

    return lines

# ── Helpers: Data loading ─────────────────────────────────────────────────────

def load_data_json() -> dict:
    """Load and return the parsed data.json."""
    if not DATA_JSON.exists():
        sys.exit(f"Error: data.json not found at {DATA_JSON}")
    try:
        data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"Error: could not read {DATA_JSON}: {exc}")
    if not isinstance(data, dict) or not isinstance(data.get("Albums"), list):
        sys.exit(f"Error: {DATA_JSON} must contain an 'Albums' list.")
    return data


def iter_tracks(data: dict, album_filter: str | None = None, track_filter: str | None = None):
    """Yield (album_info, track_info) tuples, honouring optional slug filters."""
    for album in data.get("Albums", []):
        a_slug = album.get("Album_Slug", "")
        if album_filter and a_slug != album_filter:
            continue
        for track in album.get("Tracks", []):
            t_slug = track.get("Track_Slug", "")
            if track_filter and t_slug != track_filter:
                continue
            yield album, track


def load_track_json(album_slug: str, json_path: str) -> list[dict] | None:
    """Load a track's subtitle JSON file from the source directory."""
    album_dir = (JSON_SRC_DIR / album_slug).resolve()
    full_path = (album_dir / json_path).resolve()
    if full_path.parent != album_dir:
        raise ValueError(f"Track JSON path escapes its album directory: {json_path!r}")
    if not full_path.exists():
        return None
    data = json.loads(full_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Track JSON must be a list: {full_path}")
    return data


def _file_sha256(path: Path) -> str:
    """Return the SHA-256 digest of a file."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json_atomic(path: Path, data: object) -> None:
    """Write JSON without leaving a partially-written destination file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temp_name, path)
    except BaseException:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise

# ── Helpers: Text normalisation for matching ──────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase and strip punctuation for fuzzy comparison."""
    text = text.lower()
    # Keep apostrophes (contractions), remove everything else non-alphanumeric
    text = re.sub(r"[^\w\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _character_ngrams(text: str) -> frozenset[str]:
    """Build a cheap fuzzy-match prefilter for normalized text."""
    compact = text.replace(" ", "")
    width = 2 if len(compact) < 12 else 3
    if len(compact) <= width:
        return frozenset({compact}) if compact else frozenset()
    return frozenset(compact[index:index + width] for index in range(len(compact) - width + 1))

# ── Helpers: Alignment ────────────────────────────────────────────────────────

def _is_action_only(text: str) -> bool:
    """Return True if the text is purely a sound/action annotation like [beep]."""
    return bool(re.fullmatch(r"[\[\(][^\]\)]+[\]\)]", text.strip()))


def _contains_uncertainty(text: str) -> bool:
    """Return True when wiki text explicitly says its wording is uncertain."""
    return bool(re.search(r"\[(?:unclear|inaudible|unintelligible|\?)[^\]]*\]", text, re.I))


def align_wiki_to_json(
    wiki_lines: list[tuple[str | None, str]],
    json_entries: list[dict],
    min_similarity: float = 0.4,
) -> list[dict]:
    """
    Globally align wiki transcript lines to JSON subtitle entries.

    Wiki transcripts tend to have one line per speaker turn while timestamped
    JSON subtitles split that turn into several fragments.  Alignment therefore
    compares short, consecutive spans from both sources.  A dynamic program
    chooses a monotonic set of matches, so one locally-attractive match cannot
    reorder the rest of the transcript.  Speaker codes are deliberately ignored
    while matching because diarisation mistakes are one of the things this tool
    is intended to correct.

    Returns a list of alignment records, each a dict:
      json_index       – 1-based index of JSON entry
      json_speaker     – original SPEAKER_XX code
      json_text        – original JSON text
      wiki_speaker     – human name from wiki (may be None)
      wiki_text        – wiki text for this line
      similarity       – float 0-1 (span-level for grouped matches)
      match_type       – 'exact'|'similar'|'unmatched_json'
      json_group       – list of json_indices in the group (None for singles)
      wiki_indices     – original zero-based wiki line indices in the match
    """
    # Filter wiki lines that have actual speech content (not pure [actions])
    wiki_speech = [
        (i, spk, txt)
        for i, (spk, txt) in enumerate(wiki_lines)
        if txt and not _is_action_only(txt)
    ]
    json_speech = []
    seen_indices: set[int] = set()
    for position, entry in enumerate(json_entries):
        if not isinstance(entry, dict) or not entry.get("Text", "").strip():
            continue
        index = entry.get("Index")
        if not isinstance(index, int) or isinstance(index, bool):
            raise ValueError(f"Subtitle entry {position + 1} has a non-integer Index.")
        if index in seen_indices:
            raise ValueError(f"Subtitle JSON contains duplicate Index {index}.")
        seen_indices.add(index)
        json_speech.append((index, entry))

    if not wiki_speech or not json_speech:
        return [
            {
                "json_index":   entry["Index"],
                "json_speaker": entry.get("Speaker", ""),
                "json_text":    entry.get("Text", ""),
                "wiki_speaker": None,
                "wiki_text":    None,
                "similarity":   0.0,
                "match_type":   "unmatched_json",
                "json_group":   None,
                "wiki_indices": [],
            }
            for _, entry in json_speech
        ]
    if not 0.0 <= min_similarity <= 1.0:
        raise ValueError("min_similarity must be between 0 and 1.")

    max_wiki_span = 3
    max_json_span = 6
    n_wiki, n_json = len(wiki_speech), len(json_speech)
    wiki_spans: dict[tuple[int, int], tuple[str, str, frozenset[str]]] = {}
    json_spans: dict[tuple[int, int], tuple[str, str, frozenset[str]]] = {}
    for start in range(n_wiki):
        combined = []
        speakers: set[str] = set()
        for count in range(1, min(max_wiki_span, n_wiki - start) + 1):
            _, speaker, text = wiki_speech[start + count - 1]
            combined.append(text)
            if speaker:
                speakers.add(speaker)
            if len(speakers) > 1:
                break
            value = " ".join(combined)
            normalized = _normalize(value)
            wiki_spans[(start, count)] = (value, normalized, _character_ngrams(normalized))
    for start in range(n_json):
        combined = []
        for count in range(1, min(max_json_span, n_json - start) + 1):
            combined.append(json_speech[start + count - 1][1].get("Text", "").strip())
            value = " ".join(combined)
            normalized = _normalize(value)
            json_spans[(start, count)] = (value, normalized, _character_ngrams(normalized))

    negative = float("-inf")
    scores = [[negative] * (n_json + 1) for _ in range(n_wiki + 1)]
    previous: list[list[tuple[int, int, tuple] | None]] = [
        [None] * (n_json + 1) for _ in range(n_wiki + 1)
    ]
    scores[0][0] = 0.0

    def update(i: int, j: int, value: float, prior: tuple[int, int, tuple]) -> None:
        if value > scores[i][j] + 1e-12:
            scores[i][j] = value
            previous[i][j] = prior

    for i in range(n_wiki + 1):
        for j in range(n_json + 1):
            base = scores[i][j]
            if base == negative:
                continue
            if i < n_wiki:
                update(i + 1, j, base, (i, j, ("skip_wiki",)))
            if j < n_json:
                update(i, j + 1, base, (i, j, ("skip_json",)))

            for wiki_count in range(1, min(max_wiki_span, n_wiki - i) + 1):
                wiki_span = wiki_spans.get((i, wiki_count))
                if wiki_span is None:
                    break
                _, wiki_normalized, wiki_ngrams = wiki_span
                for json_count in range(1, min(max_json_span, n_json - j) + 1):
                    _, json_normalized, json_ngrams = json_spans[(j, json_count)]
                    # SequenceMatcher cannot exceed this length-only bound.
                    # Avoid constructing it for clearly impossible matches.
                    longer = len(wiki_normalized) + len(json_normalized)
                    length_upper_bound = (
                        2 * min(len(wiki_normalized), len(json_normalized)) / longer
                        if longer else 1.0
                    )
                    effective_threshold = min_similarity
                    if wiki_count + json_count > 2:
                        effective_threshold = max(min_similarity, 0.5)
                    if length_upper_bound < effective_threshold:
                        continue
                    gram_total = len(wiki_ngrams) + len(json_ngrams)
                    gram_similarity = (
                        2 * len(wiki_ngrams & json_ngrams) / gram_total
                        if gram_total else 1.0
                    )
                    if gram_similarity < max(0.08, effective_threshold - 0.28):
                        continue
                    matcher = difflib.SequenceMatcher(
                        None, wiki_normalized, json_normalized, autojunk=False
                    )
                    if matcher.quick_ratio() < effective_threshold:
                        continue
                    similarity = matcher.ratio()
                    if similarity < effective_threshold:
                        continue
                    # Similarity drives selection. A tiny bonus only resolves
                    # true ties in favour of covering more source material.
                    match_score = similarity + 0.001 * (wiki_count + json_count - 2)
                    update(
                        i + wiki_count,
                        j + json_count,
                        base + match_score,
                        (i, j, ("match", wiki_count, json_count, similarity)),
                    )

    operations = []
    i, j = n_wiki, n_json
    while i or j:
        prior = previous[i][j]
        if prior is None:  # Defensive: skip an entry if a future change makes a state unreachable.
            if j:
                operations.append(("skip_json", i, j - 1))
                j -= 1
            else:
                operations.append(("skip_wiki", i - 1, j))
                i -= 1
            continue
        old_i, old_j, operation = prior
        operations.append((*operation, old_i, old_j))
        i, j = old_i, old_j
    operations.reverse()

    alignments: list[dict] = []
    for operation in operations:
        kind = operation[0]
        if kind == "skip_json":
            _, _, json_position = operation
            _, entry = json_speech[json_position]
            alignments.append({
                "json_index": entry["Index"],
                "json_speaker": entry.get("Speaker", ""),
                "json_text": entry.get("Text", ""),
                "wiki_speaker": None,
                "wiki_text": None,
                "similarity": 0.0,
                "match_type": "unmatched_json",
                "json_group": None,
                "wiki_indices": [],
            })
        elif kind == "match":
            _, wiki_count, json_count, similarity, wiki_position, json_position = operation
            wiki_slice = wiki_speech[wiki_position:wiki_position + wiki_count]
            json_slice = json_speech[json_position:json_position + json_count]
            wiki_indices = [original_index for original_index, _, _ in wiki_slice]
            wiki_speaker = next((speaker for _, speaker, _ in wiki_slice if speaker), None)
            wiki_text = " ".join(text for _, _, text in wiki_slice)
            group_indices = [entry["Index"] for _, entry in json_slice]
            for _, entry in json_slice:
                alignments.append({
                    "json_index": entry["Index"],
                    "json_speaker": entry.get("Speaker", ""),
                    "json_text": entry.get("Text", ""),
                    "wiki_speaker": wiki_speaker,
                    "wiki_text": wiki_text,
                    "similarity": round(similarity, 4),
                    "match_type": "exact" if similarity >= 0.9999 else "similar",
                    "json_group": group_indices if json_count > 1 else None,
                    "wiki_indices": wiki_indices,
                })

    alignments.sort(key=lambda item: item["json_index"])
    return alignments


def deduce_speaker_mapping_details(alignments: list[dict]) -> tuple[dict[str, str], dict]:
    """Infer reliable diariser-code mappings and return supporting evidence."""
    scores: Counter = Counter()
    evidence: Counter = Counter()
    seen: set[tuple] = set()
    for alignment in alignments:
        code = alignment.get("json_speaker", "")
        name = alignment.get("wiki_speaker")
        similarity = float(alignment.get("similarity", 0.0))
        if not (name and re.fullmatch(r"SPEAKER_\d+", code) and similarity >= 0.60):
            continue
        # A wiki line expanded over three JSON fragments is one observation,
        # not three votes. This prevents long turns from dominating a mapping.
        observation = (code, name, tuple(alignment.get("wiki_indices", [])))
        if observation in seen:
            continue
        seen.add(observation)
        scores[(code, name)] += similarity
        evidence[(code, name)] += 1

    mapping: dict[str, str] = {}
    details: dict[str, dict] = {}
    codes = sorted({code for code, _ in scores})
    for code in codes:
        candidates = sorted(
            ((name, scores[(code, name)], evidence[(code, name)])
             for candidate_code, name in scores if candidate_code == code),
            key=lambda item: (-item[1], item[0].casefold()),
        )
        winner, winning_score, observations = candidates[0]
        total_score = sum(score for _, score, _ in candidates)
        confidence = winning_score / total_score if total_score else 0.0
        accepted = confidence >= 0.67 and (observations >= 2 or winning_score >= 0.85)
        details[code] = {
            "name": winner,
            "confidence": round(confidence, 4),
            "observations": observations,
            "accepted": accepted,
            "candidates": [
                {"name": name, "score": round(score, 4), "observations": count}
                for name, score, count in candidates
            ],
        }
        if accepted:
            mapping[code] = winner
    return mapping, details


def deduce_speaker_mapping(alignments: list[dict]) -> dict[str, str]:
    """Backward-compatible shorthand returning only accepted mappings."""
    return deduce_speaker_mapping_details(alignments)[0]

# ── Cache helpers ─────────────────────────────────────────────────────────────

def _resolve_snapshot(snapshot: str | None) -> str | None:
    """Return and validate the requested or active snapshot name."""
    if snapshot:
        return _validate_snapshot_name(snapshot)
    if LATEST_FILE.exists():
        value = LATEST_FILE.read_text(encoding="utf-8").strip()
        return _validate_snapshot_name(value) if value else None
    return None


def _validate_snapshot_name(snapshot: str) -> str:
    if not SNAPSHOT_RE.fullmatch(snapshot):
        raise ValueError(
            "Snapshot names must be 1-80 letters, numbers, dots, underscores, or hyphens."
        )
    return snapshot


def _snapshot_cache_dir(snapshot: str) -> Path:
    return SNAPSHOTS_DIR / snapshot


def _cache_path(album_slug: str, track_slug: str, snapshot: str) -> Path:
    return _snapshot_cache_dir(snapshot) / album_slug / f"{track_slug}.json"


def save_cache(album_slug: str, track_slug: str, data: dict, snapshot: str) -> None:
    p = _cache_path(album_slug, track_slug, snapshot)
    p.parent.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(p, data)


def load_cache(album_slug: str, track_slug: str, snapshot: str | None = None) -> dict | None:
    resolved = _resolve_snapshot(snapshot)
    if not resolved:
        return None
    p = _cache_path(album_slug, track_slug, resolved)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def _compare_path(album_slug: str, track_slug: str, snapshot: str) -> Path:
    return COMPARE_DIR / snapshot / album_slug / f"{track_slug}.json"


def save_compare(album_slug: str, track_slug: str, data: dict, snapshot: str) -> None:
    p = _compare_path(album_slug, track_slug, snapshot)
    p.parent.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(p, data)


def load_compare(album_slug: str, track_slug: str, snapshot: str | None = None) -> dict | None:
    resolved = _resolve_snapshot(snapshot)
    if not resolved:
        return None
    p = _compare_path(album_slug, track_slug, resolved)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None

# ── Wiki title lookup ─────────────────────────────────────────────────────────

ALBUM_SLUG_TO_WIKI_ALBUM = {
    "longmont-potion-castle":       "Longmont Potion Castle",
    "longmont-potion-castle-ii":    "Longmont Potion Castle II",
    "longmont-potion-castle-iii":   "Longmont Potion Castle III",
    "longmont-potion-castle-4":     "Longmont Potion Castle Vol. 4",
    "longmont-potion-castle-5":     "Longmont Potion Castle 5",
    "longmont-potion-castle-6":     "Longmont Potion Castle 6",
    "longmont-potion-castle-7":     "Longmont Potion Castle 7",
    "longmont-potion-castle-8":     "Longmont Potion Castle 8",
    "longmont-potion-castle-9":     "Longmont Potion Castle 9",
    "longmont-potion-castle-10":    "Longmont Potion Castle 10",
    "longmont-potion-castle-11":    "Longmont Potion Castle 11",
    "longmont-potion-castle-12":    "Longmont Potion Castle 12",
    "longmont-potion-castle-13":    "Longmont Potion Castle 13",
    "longmont-potion-castle-14":    "Longmont Potion Castle 14",
    "longmont-potion-castle-15":    "Longmont Potion Castle 15",
    "longmont-potion-castle-16":    "Longmont Potion Castle 16",
    "longmont-potion-castle-17":    "Longmont Potion Castle 17",
    "longmont-potion-castle-18":    "Longmont Potion Castle 18",
    "longmont-potion-castle-19":    "Longmont Potion Castle 19",
    "longmont-potion-castle-20":    "Longmont Potion Castle 20",
    "the-longmont-potion-castle":   "The Longmont Potion Castle",
    "best-before-24":               "Best Before '24",
    "alive-in-25":                  "Alive in '25",
    "tour-line-live":               "Tour Line Live",
    "where-in-the-hell-is-the-lavender-house-soundtrack":
        "Where in the Hell Is the Lavender House Soundtrack",
}

# Some album slugs use roman numerals on wiki  (fallback list for disambiguation)
ROMAN_ALBUM_SUFFIXES = {
    "longmont-potion-castle-ii":  "LPC II",
    "longmont-potion-castle-iii": "LPC III",
}


def search_wiki_titles(query: str, limit: int = 5) -> list[str]:
    """
    Use the MediaWiki opensearch API to find page titles matching a query.
    Returns a list of page title strings.
    """
    params = urllib.parse.urlencode({
        "action":    "opensearch",
        "search":    query,
        "limit":     str(limit),
        "namespace": "0",
        "format":    "json",
    })
    url = f"{WIKI_API}?{params}"
    data = _request_json(url)
    # opensearch returns [query, [titles], [descriptions], [urls]]
    return data[1] if isinstance(data, list) and len(data) > 1 else []


def candidate_wiki_titles(track_title: str, album_slug: str) -> list[str]:
    """
    Generate a prioritised list of wiki page titles to try for a given track.
    """
    candidates: list[str] = []

    # Try with album disambiguation suffix  e.g. "Brian (LPC II)"
    suffix = ROMAN_ALBUM_SUFFIXES.get(album_slug)
    if suffix:
        candidates.append(f"{track_title} ({suffix})")

    # Try with numeric album suffix  e.g. "Brian (LPC 7)"
    m = re.search(r"-(\d+)$", album_slug)
    if m:
        num = m.group(1)
        candidates.append(f"{track_title} (LPC {num})")

    # Unqualified pages are a fallback: common track names can otherwise
    # resolve to a similarly named transcript from the wrong album.
    candidates.append(track_title)
    return list(dict.fromkeys(candidates))


def best_search_match(track_title: str, album_slug: str) -> str | None:
    """
    Use the wiki's opensearch API to find the closest title to track_title.
    Returns the best matching title, or None if nothing plausible found.
    """
    results = search_wiki_titles(track_title)
    if not results:
        return None

    norm_query = _normalize(track_title)
    best_title, best_score = None, 0.0
    for title in results:
        score = difflib.SequenceMatcher(None, norm_query, _normalize(title)).ratio()
        if score > best_score:
            best_score, best_title = score, title

    # Only accept if similarity is high enough (avoids wrong-page matches)
    return best_title if best_score >= 0.70 else None

# ── Subcommand: scrape ────────────────────────────────────────────────────────

def cmd_scrape(args) -> None:
    """Fetch wiki transcripts and cache them to disk as a named snapshot."""
    data = load_data_json()

    snapshot = _validate_snapshot_name(
        args.snapshot or datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    snapshot_dir = _snapshot_cache_dir(snapshot)

    if snapshot_dir.exists() and not args.force:
        sys.exit(
            f"Error: snapshot '{snapshot}' already exists under {SNAPSHOTS_DIR}.\n"
            f"Use --force to overwrite, or choose a different name with --snapshot."
        )

    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    print(f"Snapshot: {snapshot}")

    fetched = skipped = missing = 0

    for album, track in iter_tracks(data, args.album, args.track):
        a_slug   = album["Album_Slug"]
        t_slug   = track["Track_Slug"]
        t_title  = track["Track_Title"]

        if not args.force and load_cache(a_slug, t_slug, snapshot):
            print(f"  [cache] {a_slug}/{t_slug}")
            skipped += 1
            continue

        found = None
        tried: list[str] = []

        for wiki_title in candidate_wiki_titles(t_title, a_slug):
            tried.append(wiki_title)
            print(f"  [fetch] {a_slug}/{t_slug} → '{wiki_title}' …", end=" ", flush=True)
            time.sleep(REQUEST_DELAY)
            result = fetch_wikitext(wiki_title)
            if result:
                found = result
                found["queried_as"] = wiki_title
                print("OK")
                break
            print("not found")

        # Fallback: use opensearch to find the closest-matching page title
        if not found:
            print(f"  [search] {a_slug}/{t_slug} → searching for '{t_title}' …", end=" ", flush=True)
            time.sleep(REQUEST_DELAY)
            search_title = best_search_match(t_title, a_slug)
            if search_title and search_title not in tried:
                tried.append(search_title)
                print(f"→ '{search_title}' …", end=" ", flush=True)
                time.sleep(REQUEST_DELAY)
                result = fetch_wikitext(search_title)
                if result:
                    found = result
                    found["queried_as"] = search_title
                    print("OK")
                else:
                    print("not found")
            else:
                print("no viable match")

        if found:
            transcript = parse_transcript_from_wikitext(found["wikitext"])
            save_cache(a_slug, t_slug, {
                "album_slug":   a_slug,
                "track_slug":   t_slug,
                "track_title":  t_title,
                "wiki_title":   found["title"],
                "wiki_pageid":  found["pageid"],
                "wiki_url":     f"https://talkinwhipapedia.fandom.com/wiki/{urllib.parse.quote(found['title'].replace(' ', '_'))}",
                "transcript":   transcript,
            }, snapshot)
            fetched += 1
        else:
            print(f"  [miss]  {a_slug}/{t_slug} — tried: {tried}")
            # Cache a sentinel so we don't re-try on every run
            save_cache(a_slug, t_slug, {
                "album_slug":   a_slug,
                "track_slug":   t_slug,
                "track_title":  t_title,
                "wiki_title":   None,
                "wiki_pageid":  None,
                "wiki_url":     None,
                "transcript":   [],
                "not_found":    True,
            }, snapshot)
            missing += 1

    # Record this as the latest snapshot
    LATEST_FILE.write_text(snapshot, encoding="utf-8")
    print(f"\nDone — fetched: {fetched}, cached/skipped: {skipped}, not found: {missing}")
    print(f"Latest snapshot → {snapshot}")

# ── Subcommand: compare ───────────────────────────────────────────────────────

def cmd_compare(args) -> None:
    """Compare cached wiki transcripts against local JSON subtitle files."""
    data = load_data_json()

    snapshot = _resolve_snapshot(args.snapshot)
    if not snapshot:
        sys.exit("No snapshot found. Run 'scrape' first, or pass --snapshot <name>.")

    (COMPARE_DIR / snapshot).mkdir(parents=True, exist_ok=True)

    threshold = args.threshold
    processed = skipped = no_wiki = no_json = 0

    for album, track in iter_tracks(data, args.album, args.track):
        a_slug    = album["Album_Slug"]
        t_slug    = track["Track_Slug"]
        json_path = track.get("Track_JSONPath", "")

        cached = load_cache(a_slug, t_slug, snapshot)
        if not cached:
            print(f"  [skip]  {a_slug}/{t_slug} — not scraped yet (run 'scrape' first)")
            skipped += 1
            continue

        if cached.get("not_found") or not cached.get("transcript"):
            no_wiki += 1
            continue

        json_entries = load_track_json(a_slug, json_path)
        if json_entries is None:
            print(f"  [skip]  {a_slug}/{t_slug} — JSON file not found")
            no_json += 1
            continue

        wiki_lines = [
            (
                _extract_speaker_name(_extract_cell_content(str(row[0])))
                if row[0] else None,
                _clean_wiki_text(_extract_cell_content(str(row[1]))),
            )
            for row in cached["transcript"]
            if isinstance(row, (list, tuple)) and len(row) >= 2
        ]
        alignments = align_wiki_to_json(wiki_lines, json_entries, threshold)
        speaker_map, speaker_evidence = deduce_speaker_mapping_details(alignments)

        # Annotate each alignment with proposed changes
        for aln in alignments:
            code   = aln["json_speaker"]
            w_text = aln["wiki_text"]
            j_text = aln["json_text"]
            sim    = aln["similarity"]
            is_group = aln.get("json_group") is not None

            if aln.get("wiki_speaker") and sim >= 0.65:
                # Prefer the speaker attached to this particular matched line.
                # The global map is only a fallback for unmatched/weak lines.
                aln["proposed_speaker"] = aln["wiki_speaker"]
                aln["speaker_action"] = "matched_line"
            elif code in speaker_map:
                aln["proposed_speaker"] = speaker_map[code]
                aln["speaker_action"] = "inferred_mapping"
            else:
                aln["proposed_speaker"] = code
                aln["speaker_action"] = "keep"

            if w_text is None:
                aln["proposed_text"]   = j_text
                aln["text_action"]     = "no_wiki_match"
            elif is_group:
                # Multi-entry group: wiki text spans several JSON entries,
                # so we can't auto-replace individual entry text.
                aln["proposed_text"] = j_text
                if sim >= 0.99:
                    aln["text_action"] = "keep"
                else:
                    aln["text_action"] = "group_review"
            elif sim >= 0.99:
                aln["proposed_text"]   = j_text
                aln["text_action"]     = "keep"
            elif _contains_uncertainty(w_text):
                aln["proposed_text"]   = w_text
                aln["text_action"]     = "review"
            elif sim >= 0.85:
                aln["proposed_text"]   = w_text
                aln["text_action"]     = "auto_correct"
            elif sim >= threshold:
                aln["proposed_text"]   = w_text
                aln["text_action"]     = "review"
            else:
                aln["proposed_text"]   = j_text
                aln["text_action"]     = "keep_low_confidence"

        track_file = (JSON_SRC_DIR / a_slug / json_path).resolve()
        matched_wiki_indices = {
            index for alignment in alignments
            for index in alignment.get("wiki_indices", [])
        }
        total_wiki_lines = len([line for line in wiki_lines if not _is_action_only(line[1])])
        result = {
            "format_version": 2,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "snapshot": snapshot,
            "album":        album.get("Album", ""),
            "album_slug":   a_slug,
            "track":        track.get("Track_Title", ""),
            "track_slug":   t_slug,
            "json_path":    str(track_file),
            "json_sha256":  _file_sha256(track_file),
            "wiki_title":   cached.get("wiki_title"),
            "wiki_url":     cached.get("wiki_url"),
            "speaker_mapping": speaker_map,
            "speaker_mapping_evidence": speaker_evidence,
            "alignments":   alignments,
            "summary": {
                "total_json_entries":  len(json_entries),
                "total_wiki_lines":    total_wiki_lines,
                "matched_wiki_lines":  len(matched_wiki_indices),
                "unmatched_wiki_lines": total_wiki_lines - len(matched_wiki_indices),
                "matched":             sum(1 for a in alignments if a["similarity"] > 0),
                "speakers_to_map":     len(speaker_map),
                "text_auto_correct":   sum(1 for a in alignments if a.get("text_action") == "auto_correct"),
                "text_review":         sum(1 for a in alignments if a.get("text_action") == "review"),
                "text_group_review":   sum(1 for a in alignments if a.get("text_action") == "group_review"),
                "unmatched_json":      sum(1 for a in alignments if a["match_type"] == "unmatched_json"),
            },
        }

        save_compare(a_slug, t_slug, result, snapshot)
        print(
            f"  [compare] {a_slug}/{t_slug}"
            f"  speakers={len(speaker_map)}"
            f"  auto_correct={result['summary']['text_auto_correct']}"
            f"  review={result['summary']['text_review']}"
            f"  group_review={result['summary']['text_group_review']}"
            f"  unmatched={result['summary']['unmatched_json']}"
        )
        processed += 1

    print(f"\nDone — compared: {processed}, no wiki: {no_wiki}, no json: {no_json}, skipped: {skipped}")

# ── Subcommand: merge ─────────────────────────────────────────────────────────

def cmd_merge(args) -> None:
    """Apply approved changes from compare output into source JSON files."""
    data        = load_data_json()
    dry_run     = args.dry_run
    spk_only    = args.speakers_only
    auto_thresh = args.auto_threshold
    min_coverage = args.min_coverage

    snapshot = _resolve_snapshot(args.snapshot)
    if not snapshot:
        sys.exit("No snapshot found. Run 'scrape' and 'compare' first, or pass --snapshot <name>.")

    applied = skipped = low_coverage = no_compare = stale = 0
    backup_run = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")

    for album, track in iter_tracks(data, args.album, args.track):
        a_slug    = album["Album_Slug"]
        t_slug    = track["Track_Slug"]
        json_path = track.get("Track_JSONPath", "")

        compare = load_compare(a_slug, t_slug, snapshot)
        if not compare:
            no_compare += 1
            continue

        if not compare.get("alignments"):
            skipped += 1
            continue

        summary = compare.get("summary", {})
        total_entries = summary.get("total_json_entries", 0)
        matched_entries = summary.get("matched", 0)
        coverage = matched_entries / total_entries if total_entries else 0.0
        if coverage < min_coverage:
            print(
                f"  [coverage] {a_slug}/{t_slug} — {coverage:.1%} is below "
                f"the required {min_coverage:.1%}"
            )
            low_coverage += 1
            continue

        json_entries = load_track_json(a_slug, json_path)
        if json_entries is None:
            print(f"  [skip] {a_slug}/{t_slug} — JSON file not found")
            skipped += 1
            continue

        full_path = (JSON_SRC_DIR / a_slug / json_path).resolve()
        expected_hash = compare.get("json_sha256")
        current_hash = _file_sha256(full_path)
        if expected_hash != current_hash and not args.allow_stale:
            reason = "legacy comparison has no source hash" if not expected_hash else "source JSON changed"
            print(
                f"  [stale] {a_slug}/{t_slug} — {reason}; "
                "run 'compare' again (or use --allow-stale after reviewing)"
            )
            stale += 1
            continue

        # Index JSON entries by their Index field for fast lookup
        by_index: dict[int, dict] = {e["Index"]: e for e in json_entries}

        changed_speaker = 0
        changed_text    = 0

        for aln in compare["alignments"]:
            j_idx      = aln["json_index"]
            entry      = by_index.get(j_idx)
            if not entry:
                continue

            # Speaker update
            old_spk = entry["Speaker"]
            new_spk = aln.get("proposed_speaker", old_spk)
            if new_spk and new_spk != old_spk:
                if not dry_run:
                    entry["Speaker"] = new_spk
                changed_speaker += 1

            if spk_only:
                continue

            # Multi-entry groups: wiki text spans several JSON entries and
            # can't be auto-split back — skip text replacement for these.
            if aln.get("json_group"):
                continue

            # Text update — only apply when confidence is sufficient
            old_txt = entry["Text"]
            w_txt   = aln.get("wiki_text")
            sim     = aln.get("similarity", 0.0)
            action  = aln.get("text_action", "keep")

            if (
                w_txt
                and w_txt != old_txt
                and action in ("auto_correct", "approved")
                and sim >= auto_thresh
            ):
                if not dry_run:
                    entry["Text"] = w_txt
                changed_text += 1

        if changed_speaker == 0 and changed_text == 0:
            skipped += 1
            continue

        if not dry_run:
            backup_path = BACKUP_DIR / backup_run / a_slug / json_path
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(full_path, backup_path)
            _write_json_atomic(full_path, json_entries)

        tag = "[dry-run]" if dry_run else "[merged]"
        print(
            f"  {tag} {a_slug}/{t_slug}"
            f"  speakers={changed_speaker}"
            f"  text={changed_text}"
        )
        applied += 1

    print(
        f"\nDone — merged: {applied}, skipped: {skipped}, "
        f"below coverage: {low_coverage}, stale: {stale}, no compare: {no_compare}"
    )
    if dry_run:
        print("(dry-run mode — no files were modified)")
    elif applied:
        print(f"Backups → {BACKUP_DIR / backup_run}")

# ── Subcommand: report ────────────────────────────────────────────────────────

def cmd_report(args) -> None:
    """Print a human-readable summary of compare results."""
    data   = load_data_json()
    detail = args.detail

    snapshot = _resolve_snapshot(args.snapshot)
    if not snapshot:
        sys.exit("No snapshot found. Run 'scrape' and 'compare' first, or pass --snapshot <name>.")

    for album, track in iter_tracks(data, args.album, args.track):
        a_slug = album["Album_Slug"]
        t_slug = track["Track_Slug"]

        compare = load_compare(a_slug, t_slug, snapshot)
        if not compare:
            continue

        s = compare.get("summary", {})
        sm = compare.get("speaker_mapping", {})

        print(f"\n{'═'*70}")
        print(f"  {compare.get('album')} / {compare.get('track')}")
        print(f"  Wiki: {compare.get('wiki_url', 'N/A')}")
        print(f"  {'─'*66}")
        print(f"  JSON entries : {s.get('total_json_entries', '?')}")
        print(f"  Wiki lines   : {s.get('total_wiki_lines', '?')}")
        print(f"  Wiki matched : {s.get('matched_wiki_lines', '?')}")
        print(f"  Wiki missing : {s.get('unmatched_wiki_lines', '?')}")
        print(f"  Matched      : {s.get('matched', '?')}")
        print(f"  Unmatched    : {s.get('unmatched_json', '?')}")
        print(f"  Auto-correct : {s.get('text_auto_correct', '?')} text changes")
        print(f"  For review   : {s.get('text_review', '?')} text changes")
        print(f"  Group review : {s.get('text_group_review', '?')} grouped entries")

        if sm:
            print(f"  Speaker map  :")
            for code, name in sorted(sm.items()):
                print(f"    {code}  →  {name}")

        if detail and compare.get("alignments"):
            print(f"\n  Alignments:")
            for aln in compare["alignments"]:
                action = aln.get("text_action", "")
                marker = {
                    "auto_correct":  "✏ ",
                    "approved":      "✓ ",
                    "review":        "? ",
                    "group_review":  "⊞ ",
                    "keep":          "  ",
                    "no_wiki_match": "  ",
                }.get(action, "  ")
                spk_from = aln["json_speaker"]
                spk_to   = aln.get("proposed_speaker", spk_from)
                spk_note = f" [{spk_from}→{spk_to}]" if spk_from != spk_to else f" [{spk_from}]"
                sim_pct  = f"{aln['similarity']*100:.0f}%"
                grp      = aln.get("json_group")
                grp_note = f" grp{grp}" if grp else ""
                print(f"  {marker}[{aln['json_index']:3d}]{spk_note} ({sim_pct}){grp_note}")
                if aln.get("wiki_text") and aln["wiki_text"] != aln["json_text"]:
                    print(f"       JSON: {aln['json_text']}")
                    print(f"       WIKI: {aln['wiki_text']}")

# ── Subcommand: list-snapshots ────────────────────────────────────────────────

def cmd_list_snapshots(args) -> None:
    """List all available scrape snapshots."""
    if not SNAPSHOTS_DIR.exists():
        print("No snapshots found. Run 'scrape' to create one.")
        return
    latest = _resolve_snapshot(None)
    snapshots = sorted(d.name for d in SNAPSHOTS_DIR.iterdir() if d.is_dir())
    if not snapshots:
        print("No snapshots found. Run 'scrape' to create one.")
        return
    col = max(len(s) for s in snapshots)
    print(f"  {'Snapshot':<{col}}  Status")
    print(f"  {'─' * col}  {'─' * 8}")
    for s in snapshots:
        marker = "← latest" if s == latest else ""
        print(f"  {s:<{col}}  {marker}")

# ── Subcommand: use ───────────────────────────────────────────────────────────

def cmd_use(args) -> None:
    """Set a snapshot as the active default (updates wiki/cache/latest)."""
    snapshot = _validate_snapshot_name(args.snapshot)
    if not _snapshot_cache_dir(snapshot).exists():
        sys.exit(f"Snapshot '{snapshot}' not found under {SNAPSHOTS_DIR}.")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    LATEST_FILE.write_text(snapshot, encoding="utf-8")
    print(f"Latest → {snapshot}")

# ── Subcommand: migrate ───────────────────────────────────────────────────────

def cmd_migrate(args) -> None:
    """Migrate legacy flat wiki_cache/<album>/ structure into a named snapshot."""
    if not CACHE_DIR.exists():
        print("wiki_cache/ does not exist. Nothing to migrate.")
        return

    legacy_dirs = [
        d for d in CACHE_DIR.iterdir()
        if d.is_dir() and d.name != "snapshots"
    ]
    if not legacy_dirs:
        print("No legacy album directories found directly under wiki_cache/.")
        return

    snapshot = _validate_snapshot_name(args.snapshot or "initial")
    dest_dir = _snapshot_cache_dir(snapshot)

    if dest_dir.exists() and not args.force:
        sys.exit(
            f"Snapshot '{snapshot}' already exists. "
            f"Use --force to merge into it, or pick a different name with --snapshot."
        )

    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Migrating {len(legacy_dirs)} directory(s) → snapshot '{snapshot}'")
    for album_dir in sorted(legacy_dirs, key=lambda d: d.name):
        dest = dest_dir / album_dir.name
        print(f"  {album_dir.name}/")
        shutil.copytree(str(album_dir), str(dest), dirs_exist_ok=True)

    if not LATEST_FILE.exists():
        LATEST_FILE.write_text(snapshot, encoding="utf-8")
        print(f"Latest → {snapshot}")
    else:
        print(f"Note: 'latest' still points to '{_resolve_snapshot(None)}'; not changed.")
        print(f"      Run 'use {snapshot}' to switch if desired.")

    print(f"\nMigration complete. Original files remain in wiki_cache/<album>/.")
    print("Delete them manually once you have verified the snapshot.")

# ── CLI ───────────────────────────────────────────────────────────────────────

def _ratio_arg(value: str) -> float:
    try:
        ratio = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a number between 0 and 1") from exc
    if not 0.0 <= ratio <= 1.0:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return ratio


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape transcripts from talkinwhipapedia.fandom.com and merge with local JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── scrape ──
    p_scrape = sub.add_parser("scrape", help="Fetch wiki transcripts and cache them as a new snapshot.")
    p_scrape.add_argument("--snapshot", help="Snapshot name (default: YYYYMMDD-HHMMSS timestamp).")
    p_scrape.add_argument("--album",    help="Limit to a single album slug.")
    p_scrape.add_argument("--track",    help="Limit to a single track slug.")
    p_scrape.add_argument("--force",    action="store_true", help="Overwrite snapshot if it already exists.")

    # ── list-snapshots ──
    sub.add_parser("list-snapshots", help="List all available scrape snapshots.")

    # ── use ──
    p_use = sub.add_parser("use", help="Set a snapshot as the active default.")
    p_use.add_argument("snapshot", help="Snapshot name to activate.")

    # ── compare ──
    p_cmp = sub.add_parser("compare", help="Compare wiki transcripts with local JSONs.")
    p_cmp.add_argument("--snapshot",  help="Snapshot to compare against (default: latest).")
    p_cmp.add_argument("--album",     help="Limit to a single album slug.")
    p_cmp.add_argument("--track",     help="Limit to a single track slug.")
    p_cmp.add_argument("--threshold", type=_ratio_arg, default=0.4,
                       help="Minimum similarity ratio to consider a line matched (default 0.4).")

    # ── merge ──
    p_mrg = sub.add_parser("merge", help="Apply approved changes to source JSON files.")
    p_mrg.add_argument("--snapshot",       help="Snapshot whose compare output to merge (default: latest).")
    p_mrg.add_argument("--album",          help="Limit to a single album slug.")
    p_mrg.add_argument("--track",          help="Limit to a single track slug.")
    p_mrg.add_argument("--dry-run",        action="store_true",
                       help="Show what would change without writing files.")
    p_mrg.add_argument("--speakers-only",  action="store_true",
                       help="Only update speaker labels, not transcription text.")
    p_mrg.add_argument("--auto-threshold", type=_ratio_arg, default=0.85,
                       help="Min similarity to auto-apply text corrections (default 0.85).")
    p_mrg.add_argument("--min-coverage", type=_ratio_arg, default=0.0,
                       help="Only merge tracks with at least this matched-entry coverage (default 0).")
    p_mrg.add_argument("--allow-stale", action="store_true",
                       help="Apply comparison output even if the source JSON has changed (unsafe).")

    # ── report ──
    p_rep = sub.add_parser("report", help="Print a human-readable summary of compare results.")
    p_rep.add_argument("--snapshot", help="Snapshot to report on (default: latest).")
    p_rep.add_argument("--album",    help="Limit to a single album slug.")
    p_rep.add_argument("--track",    help="Limit to a single track slug.")
    p_rep.add_argument("--detail",   action="store_true",
                       help="Show individual alignment entries.")

    # ── migrate ──
    p_mig = sub.add_parser("migrate", help="Migrate legacy flat wiki/cache/ structure into a snapshot.")
    p_mig.add_argument("--snapshot", help="Snapshot name for migrated data (default: 'initial').")
    p_mig.add_argument("--force",    action="store_true", help="Merge into snapshot if it already exists.")

    return parser


def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()

    dispatch = {
        "scrape":          cmd_scrape,
        "list-snapshots":  cmd_list_snapshots,
        "use":             cmd_use,
        "compare":         cmd_compare,
        "merge":           cmd_merge,
        "report":          cmd_report,
        "migrate":         cmd_migrate,
    }
    try:
        dispatch[args.command](args)
    except (ValueError, json.JSONDecodeError, OSError, WikiRequestError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
