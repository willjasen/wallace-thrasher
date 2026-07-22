#!/usr/bin/env python3
"""Compare completed Whisper-WebUI runs with project data and merge reviewed changes.

The comparison file is saved inside the git-ignored analysis run. Exact matches
to catalog metadata are marked ``auto_add``; transcription and diarization
differences are always ``review`` until their action is changed to ``approved``.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Sequence


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
JSON_ROOT = PROJECT_ROOT / "jekyll" / "assets" / "json"
DATA_JSON = JSON_ROOT / "data.json"
ANALYSIS_ROOT = PROJECT_ROOT / "analysis" / "whisper-webui"
BACKUP_ROOT = ANALYSIS_ROOT / "merge-backups"
WIKI_MODULE_PATH = SCRIPT_DIR / "wiki_scrape_and_merge.py"
FORMAT_VERSION = 1
MERGE_ACTIONS = {"approved", "auto_add"}


def _load_wiki_module():
    spec = importlib.util.spec_from_file_location("whisper_merge_wiki_helpers", WIKI_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load alignment helpers from {WIKI_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Required file is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def _write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _run_id() -> str:
    return str(time.time_ns() // 1_000_000)


def _normalize(value: str) -> str:
    return " ".join(str(value).casefold().split())


def _append_unique(values: Iterable[str], additions: Iterable[str]) -> list[str]:
    output = [str(value) for value in values]
    seen = {_normalize(value) for value in output}
    for addition in additions:
        key = _normalize(addition)
        if key and key not in seen:
            output.append(addition)
            seen.add(key)
    return output


def _find_track(data: dict[str, Any], album_slug: str, track_slug: str) -> tuple[dict[str, Any], dict[str, Any]]:
    album = next((item for item in data.get("Albums", []) if item.get("Album_Slug") == album_slug), None)
    if album is None:
        raise ValueError(f"Unknown album slug: {album_slug}")
    track = next((item for item in album.get("Tracks", []) if item.get("Track_Slug") == track_slug), None)
    if track is None:
        raise ValueError(f"Unknown track slug {track_slug!r} in album {album_slug!r}")
    return album, track


def _track_json_path(album_slug: str, track: dict[str, Any]) -> Path:
    album_dir = (JSON_ROOT / album_slug).resolve()
    path = (album_dir / str(track.get("Track_JSONPath") or "")).resolve()
    if path.parent != album_dir:
        raise ValueError("Track_JSONPath escapes its album directory")
    return path


def _project_path(value: str) -> Path:
    root = PROJECT_ROOT.resolve()
    path = (root / value).resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"Comparison path escapes the project: {value!r}")
    return path


def resolve_run(album_slug: str, track_slug: str, run: str | None = None,
                analysis_root: Path = ANALYSIS_ROOT) -> Path:
    track_root = analysis_root / album_slug / track_slug
    if run:
        candidate = Path(run)
        if not candidate.is_absolute():
            candidate = track_root / run
    else:
        latest_path = track_root / "latest.json"
        latest = _read_json(latest_path)
        candidate = track_root / str(latest.get("run") or "")
    candidate = candidate.resolve()
    expected_parent = track_root.resolve()
    if candidate.parent != expected_parent:
        raise ValueError(f"Analysis run must be directly beneath {track_root}")
    manifest = _read_json(candidate / "manifest.json")
    if manifest.get("status") != "completed":
        raise ValueError(f"Analysis run is not completed: {candidate.name}")
    if manifest.get("track", {}).get("album_slug") != album_slug or manifest.get("track", {}).get("track_slug") != track_slug:
        raise ValueError("Analysis run does not match the requested track")
    return candidate


def _catalog_type(data: dict[str, Any], establishment: str) -> str:
    types: Counter[str] = Counter()
    needle = _normalize(establishment)
    for album in data.get("Albums", []):
        for track in album.get("Tracks", []):
            for value in track.get("Establishments") or []:
                if _normalize(value) == needle:
                    kind = (track.get("Establishment_Types") or {}).get(value, "unspecified")
                    types[str(kind)] += 1
    return types.most_common(1)[0][0] if types else "unspecified"


def _metadata_proposals(data: dict[str, Any], track: dict[str, Any],
                        review: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    metadata = review.get("metadata") or {}
    current_aliases = {_normalize(value) for value in track.get("Aliases") or []}
    current_establishments = {_normalize(value) for value in track.get("Establishments") or []}
    aliases = [{
        "value": value,
        "action": "auto_add",
        "reason": "Known catalog alias appears in the local Whisper transcript.",
    } for value in metadata.get("known_aliases_detected_but_missing_from_track") or []
        if _normalize(value) not in current_aliases]
    establishments = [{
        "value": value,
        "type": _catalog_type(data, value),
        "action": "auto_add",
        "reason": "Known catalog establishment appears in the local Whisper transcript.",
    } for value in metadata.get("known_establishments_detected_but_missing_from_track") or []
        if _normalize(value) not in current_establishments]
    return {"aliases": aliases, "establishments": establishments}


def _speaker_mappings(review: dict[str, Any]) -> list[dict[str, Any]]:
    mappings = []
    for suggestion in review.get("speaker_mapping_suggestions") or []:
        source = suggestion.get("diarized_speaker")
        target = suggestion.get("suggested_catalog_speaker")
        if not source:
            continue
        mappings.append({
            "source_speaker": source,
            "proposed_speaker": target,
            "confidence": float(suggestion.get("confidence") or 0),
            "overlap_seconds": float(suggestion.get("overlap_seconds") or 0),
            "action": "review" if target else "keep",
        })
    return mappings


def _transform_alignments(raw: Sequence[dict[str, Any]], mapping: dict[str, str], threshold: float,
                          reviewed_by_index: dict[int, bool], reviewed_default: bool) -> list[dict[str, Any]]:
    output = []
    for item in raw:
        source_speaker = item.get("wiki_speaker")
        source_text = item.get("wiki_text")
        current_speaker = item.get("json_speaker")
        current_text = item.get("json_text")
        similarity = float(item.get("similarity") or 0)
        grouped = item.get("json_group") is not None
        proposed_speaker = mapping.get(str(source_speaker), current_speaker)

        if not source_text:
            text_action = "keep_no_source_match"
            proposed_text = current_text
        elif grouped and similarity < 0.99:
            text_action = "group_review"
            proposed_text = current_text
        elif similarity >= 0.99:
            text_action = "keep"
            proposed_text = current_text
        elif grouped:
            text_action = "keep"
            proposed_text = current_text
        elif similarity >= threshold:
            text_action = "review"
            proposed_text = source_text
        else:
            text_action = "keep_low_confidence"
            proposed_text = current_text

        speaker_action = "keep"
        if source_speaker and proposed_speaker and proposed_speaker != current_speaker:
            speaker_action = "review"

        target_index = item.get("json_index")
        current_reviewed = reviewed_by_index.get(target_index)
        output.append({
            "target_index": target_index,
            "target_group": item.get("json_group"),
            "source_indices": item.get("wiki_indices") or [],
            "current_speaker": current_speaker,
            "source_speaker": source_speaker,
            "proposed_speaker": proposed_speaker,
            "speaker_action": speaker_action,
            "current_text": current_text,
            "source_text": source_text,
            "proposed_text": proposed_text,
            "text_action": text_action,
            "similarity": round(similarity, 6),
            "match_type": item.get("match_type"),
            "current_reviewed": current_reviewed,
            "proposed_reviewed": current_reviewed if current_reviewed is not None else reviewed_default,
            "review_action": "keep" if current_reviewed is not None else "initialize_from_track",
        })
    return output


def build_comparison(data: dict[str, Any], album_slug: str, track_slug: str, run_dir: Path,
                     threshold: float = 0.4) -> dict[str, Any]:
    album, track = _find_track(data, album_slug, track_slug)
    track_path = _track_json_path(album_slug, track)
    current = _read_json(track_path)
    candidate_path = run_dir / "candidate-subtitles.json"
    candidate = _read_json(candidate_path)
    review_path = run_dir / "review.json"
    review = _read_json(review_path)
    manifest_path = run_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    if not isinstance(current, list) or not isinstance(candidate, list):
        raise ValueError("Current and candidate subtitle files must both contain JSON lists")

    source_lines = [
        (str(item.get("Speaker") or "None"), str(item.get("Text") or ""))
        for item in candidate
    ]
    wiki = _load_wiki_module()
    raw_alignments = wiki.align_wiki_to_json(source_lines, current, threshold)
    mappings = _speaker_mappings(review)
    mapping = {
        str(item["source_speaker"]): str(item["proposed_speaker"])
        for item in mappings if item.get("proposed_speaker")
    }
    reviewed_by_index = {
        item.get("Index"): item["Reviewed"]
        for item in current
        if isinstance(item.get("Reviewed"), bool)
    }
    reviewed_default = bool(track.get("Subtitles_Adjusted"))
    alignments = _transform_alignments(
        raw_alignments, mapping, threshold, reviewed_by_index, reviewed_default
    )
    metadata = _metadata_proposals(data, track, review)

    return {
        "format_version": FORMAT_VERSION,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": {
            "kind": "whisper-webui-analysis",
            "run": run_dir.name,
            "run_path": run_dir.relative_to(PROJECT_ROOT).as_posix(),
            "audio_sha256": manifest.get("audio", {}).get("sha256"),
            "model": manifest.get("request", {}).get("model"),
            "candidate_sha256": _sha256(candidate_path),
            "manifest_sha256": _sha256(manifest_path),
        },
        "target": {
            "album": album.get("Album"),
            "album_slug": album_slug,
            "track": track.get("Track_Title"),
            "track_slug": track_slug,
            "data_path": DATA_JSON.relative_to(PROJECT_ROOT).as_posix(),
            "data_sha256": _sha256(DATA_JSON),
            "subtitle_path": track_path.relative_to(PROJECT_ROOT).as_posix(),
            "subtitle_sha256": _sha256(track_path),
            "current_aliases": list(track.get("Aliases") or []),
            "current_establishments": list(track.get("Establishments") or []),
        },
        "speaker_mappings": mappings,
        "metadata": metadata,
        "alignments": alignments,
        "summary": {
            "current_subtitles": len(current),
            "candidate_subtitles": len(candidate),
            "matched": sum(1 for item in alignments if item["match_type"] != "unmatched_json"),
            "text_review": sum(1 for item in alignments if item["text_action"] == "review"),
            "text_group_review": sum(1 for item in alignments if item["text_action"] == "group_review"),
            "speaker_review": sum(1 for item in alignments if item["speaker_action"] == "review"),
            "review_flags_to_initialize": sum(
                1 for item in alignments if item["review_action"] == "initialize_from_track"
            ),
            "alias_additions": len(metadata["aliases"]),
            "establishment_additions": len(metadata["establishments"]),
        },
        "instructions": [
            "Current repository text and named speakers remain canonical unless a review action is explicitly changed to approved.",
            "Change a review action to approved only after checking the audio and current project data.",
            "Missing per-line Reviewed flags are initialized from the track-level Subtitles_Adjusted value without changing text or speakers.",
            "auto_add metadata is eligible for merge because it is an exact term already present elsewhere in the catalog.",
            "Grouped subtitle differences cannot be merged automatically; edit the target subtitle manually or approve individual ungrouped lines.",
            "Run merge --dry-run before merge. Target or source hash changes require a fresh comparison.",
        ],
    }


def compare(args: argparse.Namespace) -> Path:
    data = _read_json(DATA_JSON)
    run_dir = resolve_run(args.album, args.track, args.run, args.analysis_root)
    result = build_comparison(data, args.album, args.track, run_dir, args.threshold)
    output = run_dir / "comparison.json"
    _write_json_atomic(output, result)
    summary = result["summary"]
    print(
        f"[compare] {args.album}/{args.track} run={run_dir.name} "
        f"text_review={summary['text_review']} group_review={summary['text_group_review']} "
        f"speaker_review={summary['speaker_review']} metadata_additions="
        f"{summary['alias_additions'] + summary['establishment_additions']}"
    )
    print(f"Comparison → {output}")
    return output


def _approved(values: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in values if item.get("action") in MERGE_ACTIONS]


def _validate_hash(path: Path, expected: str | None, label: str, allow_stale: bool) -> None:
    if not expected or _sha256(path) != expected:
        if allow_stale:
            return
        raise ValueError(f"{label} changed after comparison; run compare again")


def _copy_backup(path: Path, backup_run: Path) -> Path:
    relative = path.relative_to(PROJECT_ROOT)
    destination = backup_run / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)
    return destination


def merge(args: argparse.Namespace) -> dict[str, Any]:
    run_dir = resolve_run(args.album, args.track, args.run, args.analysis_root)
    comparison_path = run_dir / "comparison.json"
    comparison = _read_json(comparison_path)
    if comparison.get("format_version") != FORMAT_VERSION:
        raise ValueError("Unsupported comparison format; run compare again")
    target = comparison.get("target") or {}
    source = comparison.get("source") or {}
    if target.get("album_slug") != args.album or target.get("track_slug") != args.track:
        raise ValueError("Comparison target does not match the requested track")

    data_path = _project_path(str(target.get("data_path")))
    subtitle_path = _project_path(str(target.get("subtitle_path")))
    candidate_path = run_dir / "candidate-subtitles.json"
    manifest_path = run_dir / "manifest.json"
    _validate_hash(data_path, target.get("data_sha256"), "data.json", args.allow_stale)
    _validate_hash(subtitle_path, target.get("subtitle_sha256"), "subtitle JSON", args.allow_stale)
    _validate_hash(candidate_path, source.get("candidate_sha256"), "Whisper candidate", args.allow_stale)
    _validate_hash(manifest_path, source.get("manifest_sha256"), "Whisper manifest", args.allow_stale)

    data = _read_json(data_path)
    subtitles = _read_json(subtitle_path)
    _, track = _find_track(data, args.album, args.track)
    by_index = {item.get("Index"): item for item in subtitles}
    approved_mappings = {
        str(item["source_speaker"]): str(item["proposed_speaker"])
        for item in comparison.get("speaker_mappings") or []
        if item.get("action") == "approved" and item.get("proposed_speaker")
    }

    changed_text = changed_speaker = review_flags_added = 0
    for alignment in comparison.get("alignments") or []:
        entry = by_index.get(alignment.get("target_index"))
        if not entry:
            continue
        if alignment.get("review_action") == "initialize_from_track" and not isinstance(entry.get("Reviewed"), bool):
            entry["Reviewed"] = bool(alignment.get("proposed_reviewed"))
            review_flags_added += 1
        elif alignment.get("review_action") == "approved":
            proposed_reviewed = bool(alignment.get("proposed_reviewed", True))
            if entry.get("Reviewed") is not proposed_reviewed:
                entry["Reviewed"] = proposed_reviewed
                review_flags_added += 1
        source_speaker = alignment.get("source_speaker")
        proposed_speaker = None
        if alignment.get("speaker_action") == "approved":
            proposed_speaker = alignment.get("proposed_speaker")
        elif source_speaker in approved_mappings:
            proposed_speaker = approved_mappings[source_speaker]
        if proposed_speaker and proposed_speaker != entry.get("Speaker"):
            entry["Speaker"] = proposed_speaker
            entry["Reviewed"] = True
            changed_speaker += 1

        if alignment.get("text_action") != "approved" or alignment.get("target_group"):
            continue
        proposed_text = alignment.get("proposed_text")
        if proposed_text and proposed_text != entry.get("Text"):
            entry["Text"] = proposed_text
            entry["Reviewed"] = True
            changed_text += 1

    aliases = _approved((comparison.get("metadata") or {}).get("aliases") or [])
    establishments = _approved((comparison.get("metadata") or {}).get("establishments") or [])
    old_aliases = list(track.get("Aliases") or [])
    old_establishments = list(track.get("Establishments") or [])
    track["Aliases"] = _append_unique(old_aliases, [item["value"] for item in aliases])
    track["Establishments"] = _append_unique(
        old_establishments, [item["value"] for item in establishments]
    )
    if not track["Aliases"]:
        track.pop("Aliases", None)
    if not track["Establishments"]:
        track.pop("Establishments", None)
    else:
        types = dict(track.get("Establishment_Types") or {})
        for item in establishments:
            types.setdefault(item["value"], item.get("type") or "unspecified")
        track["Establishment_Types"] = {
            value: types.get(value, "unspecified") for value in track["Establishments"]
        }

    aliases_added = len(track.get("Aliases") or []) - len(old_aliases)
    establishments_added = len(track.get("Establishments") or []) - len(old_establishments)
    if changed_speaker:
        track["Speakers_Adjusted"] = True
    if changed_text:
        track["Subtitles_Adjusted"] = True

    result = {
        "dry_run": bool(args.dry_run),
        "album_slug": args.album,
        "track_slug": args.track,
        "run": run_dir.name,
        "speakers_changed": changed_speaker,
        "text_changed": changed_text,
        "review_flags_added": review_flags_added,
        "aliases_added": aliases_added,
        "establishments_added": establishments_added,
        "pending_text_review": sum(
            item.get("text_action") in {"review", "group_review"}
            for item in comparison.get("alignments") or []
        ),
        "pending_speaker_review": sum(
            item.get("speaker_action") == "review"
            for item in comparison.get("alignments") or []
        ) + sum(
            item.get("action") == "review"
            for item in comparison.get("speaker_mappings") or []
        ),
    }

    if not args.dry_run and any((changed_text, changed_speaker, review_flags_added, aliases_added, establishments_added)):
        merge_id = _run_id()
        backup_run = args.backup_root / merge_id
        _copy_backup(data_path, backup_run)
        if changed_text or changed_speaker or review_flags_added:
            _copy_backup(subtitle_path, backup_run)
            _write_json_atomic(subtitle_path, subtitles)
        _write_json_atomic(data_path, data)
        result["backup"] = backup_run.relative_to(PROJECT_ROOT).as_posix()
        receipt_path = run_dir / "merge-receipts" / f"{merge_id}.json"
        receipt = {
            "format_version": 1,
            "merged_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": {
                "run": source.get("run_path"),
                "audio_sha256": source.get("audio_sha256"),
                "model": source.get("model"),
            },
            "applied": {
                "aliases": [item["value"] for item in aliases],
                "establishments": [item["value"] for item in establishments],
                "speakers_changed": changed_speaker,
                "text_changed": changed_text,
                "review_flags_added": review_flags_added,
            },
            "backup": result["backup"],
        }
        _write_json_atomic(receipt_path, receipt)
        result["receipt"] = receipt_path.relative_to(PROJECT_ROOT).as_posix()
    print(json.dumps(result, indent=2, sort_keys=True))
    if args.dry_run:
        print("Dry run only — no project files were modified.")
    return result


def report(args: argparse.Namespace) -> dict[str, Any]:
    run_dir = resolve_run(args.album, args.track, args.run, args.analysis_root)
    comparison = _read_json(run_dir / "comparison.json")
    summary = comparison.get("summary") or {}
    report_value = {
        "album": comparison.get("target", {}).get("album"),
        "track": comparison.get("target", {}).get("track"),
        "run": run_dir.name,
        **summary,
        "auto_add_aliases": [
            item["value"] for item in (comparison.get("metadata") or {}).get("aliases") or []
            if item.get("action") == "auto_add"
        ],
        "auto_add_establishments": [
            item["value"] for item in (comparison.get("metadata") or {}).get("establishments") or []
            if item.get("action") == "auto_add"
        ],
    }
    print(json.dumps(report_value, indent=2, sort_keys=True))
    return report_value


def _ratio(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a number between 0 and 1") from exc
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def _common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--album", required=True, help="Album slug from data.json")
    parser.add_argument("--track", required=True, help="Track slug from data.json")
    parser.add_argument("--run", help="Analysis run directory name (default: latest completed run)")
    parser.add_argument("--analysis-root", type=Path, default=ANALYSIS_ROOT, help=argparse.SUPPRESS)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    compare_parser = commands.add_parser("compare", help="Create an editable project comparison")
    _common(compare_parser)
    compare_parser.add_argument("--threshold", type=_ratio, default=0.4)

    report_parser = commands.add_parser("report", help="Summarize an existing comparison")
    _common(report_parser)

    merge_parser = commands.add_parser("merge", help="Merge auto-add and approved comparison changes")
    _common(merge_parser)
    merge_parser.add_argument("--dry-run", action="store_true", help="Show changes without writing project files")
    merge_parser.add_argument("--allow-stale", action="store_true", help="Bypass source hash checks (unsafe)")
    merge_parser.add_argument("--backup-root", type=Path, default=BACKUP_ROOT, help=argparse.SUPPRESS)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    dispatch = {"compare": compare, "report": report, "merge": merge}
    dispatch[args.command](args)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
