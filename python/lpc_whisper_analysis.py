#!/usr/bin/env python3
"""Analyze an LPC USB track with Whisper-WebUI and build a local review bundle."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys
import unicodedata
import urllib.parse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


REPO_ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = REPO_ROOT / "jekyll" / "assets" / "json" / "data.json"
DEFAULT_ANALYSIS_ROOT = REPO_ROOT / "analysis" / "whisper-webui"
CLIENT_PATH = REPO_ROOT / "pinokio_agent" / "skills" / "api" / "whisper-webui.git" / "clients" / "transcribe.py"
SPEAKER_PREFIX = re.compile(r"^\s*([^|\n]{1,64})\|(.*)$", re.DOTALL)
SRT_TIMING = re.compile(
    r"(?P<start>\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*"
    r"(?P<end>\d{1,2}:\d{2}:\d{2}[,.]\d{3})"
)
SECRET_KEYS = ("token", "password", "authorization", "cookie", "api_key")


def load_repo_env(path: Path = REPO_ROOT / ".env") -> None:
    """Load simple KEY=VALUE secrets without overriding the caller's environment."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def _load_client_module():
    spec = importlib.util.spec_from_file_location("wallace_thrasher_whisper_client", CLIENT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load Whisper-WebUI client: {CLIENT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_catalog(path: Path = CATALOG_PATH) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def find_track(catalog: Dict[str, Any], album_slug: str, track_slug: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    album = next((item for item in catalog.get("Albums", []) if item.get("Album_Slug") == album_slug), None)
    if album is None:
        raise ValueError(f"Unknown album slug: {album_slug}")
    track = next((item for item in album.get("Tracks", []) if item.get("Track_Slug") == track_slug), None)
    if track is None:
        raise ValueError(f"Unknown track slug {track_slug!r} in album {album_slug!r}")
    return album, track


def normalize_name(value: str, loose: bool = False) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.translate(str.maketrans({"‘": "'", "’": "'", "‛": "'", "–": "-", "—": "-", "‑": "-"}))
    text = " ".join(text.strip().casefold().split())
    return re.sub(r"[^a-z0-9]", "", text) if loose else text


def resolve_usb_audio(usb_root: Path, album_directory: str, filename: str) -> Path:
    candidates = [
        usb_root / album_directory / filename,
        usb_root / "LPC USB" / album_directory / filename,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    matches: List[Path] = []
    for candidate in usb_root.rglob("*"):
        if not candidate.is_file() or candidate.suffix.casefold() != ".mp3":
            continue
        if normalize_name(candidate.parent.name) == normalize_name(album_directory) and normalize_name(candidate.name) == normalize_name(filename):
            matches.append(candidate)
    if not matches:
        for candidate in usb_root.rglob("*"):
            if not candidate.is_file() or candidate.suffix.casefold() != ".mp3":
                continue
            if normalize_name(candidate.parent.name, True) == normalize_name(album_directory, True) and normalize_name(candidate.name, True) == normalize_name(filename, True):
                matches.append(candidate)
    if len(matches) == 1:
        return matches[0].resolve()
    if len(matches) > 1:
        rendered = "\n".join(f"  - {path}" for path in matches)
        raise ValueError(f"The USB track match is ambiguous:\n{rendered}")
    raise FileNotFoundError(f"Could not find {album_directory}/{filename} beneath {usb_root}")


def parse_timestamp(value: str) -> float:
    hours, minutes, seconds = value.replace(",", ".").split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def format_timestamp(value: float) -> str:
    milliseconds = max(0, round(float(value) * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def split_speaker(text: str) -> Tuple[str, str]:
    match = SPEAKER_PREFIX.match(text)
    if not match:
        return "None", text.strip()
    return match.group(1).strip() or "None", match.group(2).strip()


def parse_srt(content: str) -> List[Dict[str, Any]]:
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    blocks = re.split(r"\n\s*\n", normalized) if normalized else []
    segments: List[Dict[str, Any]] = []
    for block in blocks:
        lines = [line.rstrip() for line in block.split("\n")]
        timing_index = next((index for index, line in enumerate(lines) if SRT_TIMING.search(line)), None)
        if timing_index is None:
            continue
        timing = SRT_TIMING.search(lines[timing_index])
        if timing is None:
            continue
        raw_text = " ".join(lines[timing_index + 1:]).strip()
        speaker, text = split_speaker(raw_text)
        start = parse_timestamp(timing.group("start"))
        end = parse_timestamp(timing.group("end"))
        segments.append({
            "index": len(segments) + 1,
            "start": start,
            "end": end,
            "speaker": speaker,
            "text": text,
        })
    if not segments:
        raise ValueError("The SRT did not contain any recognizable subtitle blocks")
    return segments


def segments_from_api(response: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str]:
    if response.get("adapter") == "rest":
        raw_segments = response.get("task", {}).get("result") or []
        segments = []
        for raw in raw_segments:
            speaker, text = split_speaker(str(raw.get("text") or ""))
            segments.append({
                "index": len(segments) + 1,
                "start": float(raw.get("start") or 0),
                "end": float(raw.get("end") or raw.get("start") or 0),
                "speaker": speaker,
                "text": text,
            })
        return segments, render_srt(segments)
    srt = str(response.get("srt") or "")
    return parse_srt(srt), srt


def render_srt(segments: Sequence[Dict[str, Any]]) -> str:
    blocks = []
    for index, segment in enumerate(segments, 1):
        speaker = str(segment.get("speaker") or "None")
        text = str(segment.get("text") or "").strip()
        rendered_text = f"{speaker}|{text}" if speaker != "None" else text
        blocks.append(
            f"{index}\n{format_timestamp(float(segment['start']))} --> "
            f"{format_timestamp(float(segment['end']))}\n{rendered_text}"
        )
    return "\n\n".join(blocks) + "\n"


def repo_segments(segments: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{
        "Index": index,
        "Start Time": format_timestamp(float(segment["start"])),
        "End Time": format_timestamp(float(segment["end"])),
        "Speaker": str(segment.get("speaker") or "None"),
        "Text": str(segment.get("text") or "").strip(),
    } for index, segment in enumerate(segments, 1)]


def load_current_subtitles(album_slug: str, track: Dict[str, Any]) -> List[Dict[str, Any]]:
    path = REPO_ROOT / "jekyll" / "assets" / "json" / album_slug / track["Track_JSONPath"]
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def current_numeric_segments(subtitles: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    output = []
    for item in subtitles:
        try:
            output.append({
                "start": parse_timestamp(str(item["Start Time"])),
                "end": parse_timestamp(str(item["End Time"])),
                "speaker": str(item.get("Speaker") or "None"),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return output


def suggest_speaker_mapping(segments: Sequence[Dict[str, Any]], current: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    scores: Dict[str, Counter] = defaultdict(Counter)
    for generated in segments:
        raw_speaker = str(generated.get("speaker") or "None")
        if raw_speaker == "None":
            continue
        for existing in current:
            overlap = max(0.0, min(float(generated["end"]), float(existing["end"])) -
                          max(float(generated["start"]), float(existing["start"])))
            if overlap:
                scores[raw_speaker][existing["speaker"]] += overlap
    suggestions = []
    all_raw = sorted({str(segment.get("speaker") or "None") for segment in segments})
    for raw_speaker in all_raw:
        counter = scores.get(raw_speaker, Counter())
        total = sum(counter.values())
        best = counter.most_common(1)[0] if counter else (None, 0.0)
        suggestions.append({
            "diarized_speaker": raw_speaker,
            "suggested_catalog_speaker": best[0],
            "overlap_seconds": round(best[1], 3),
            "confidence": round(best[1] / total, 4) if total else 0.0,
        })
    return suggestions


def track_values(track: Dict[str, Any], key: str) -> List[str]:
    values = list(track.get(key) or [])
    wiki = track.get("Talkin_Whipapedia") or {}
    values.extend(wiki.get(key) or [])
    return sorted({str(value).strip() for value in values if str(value).strip()}, key=str.casefold)


def all_catalog_values(catalog: Dict[str, Any], key: str) -> List[str]:
    values = set()
    for album in catalog.get("Albums", []):
        for track in album.get("Tracks", []):
            values.update(track_values(track, key))
    return sorted(values, key=str.casefold)


def normalize_text(value: str) -> str:
    return " " + re.sub(r"[^a-z0-9]+", " ", normalize_name(value)).strip() + " "


def matched_catalog_terms(text: str, catalog_values: Iterable[str], existing: Iterable[str]) -> List[str]:
    haystack = normalize_text(text)
    existing_normalized = {normalize_text(value).strip() for value in existing}
    matches = []
    for value in catalog_values:
        needle = normalize_text(value).strip()
        if len(needle) >= 3 and needle not in existing_normalized and f" {needle} " in haystack:
            matches.append(value)
    return matches


def proper_name_candidates(segments: Sequence[Dict[str, Any]], known_values: Iterable[str]) -> List[Dict[str, Any]]:
    known = {normalize_text(value).strip() for value in known_values}
    counts: Counter = Counter()
    pattern = re.compile(r"\b(?:[A-Z][A-Za-z0-9'’-]{2,})(?:\s+[A-Z][A-Za-z0-9'’-]{2,}){0,3}\b")
    stop = {"The", "This", "That", "Thank", "Yeah", "Okay", "Well", "What", "When", "Where", "Hello", "None"}
    for segment in segments:
        for candidate in pattern.findall(str(segment.get("text") or "")):
            if candidate in stop or normalize_text(candidate).strip() in known:
                continue
            counts[candidate] += 1
    return [{"text": text, "occurrences": count} for text, count in counts.most_common(50)]


def build_review(catalog: Dict[str, Any], track: Dict[str, Any], segments: Sequence[Dict[str, Any]],
                 current_subtitles: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    transcript = "\n".join(str(segment.get("text") or "") for segment in segments)
    existing_aliases = track_values(track, "Aliases")
    existing_establishments = track_values(track, "Establishments")
    all_aliases = all_catalog_values(catalog, "Aliases")
    all_establishments = all_catalog_values(catalog, "Establishments")
    numeric_current = current_numeric_segments(current_subtitles)
    generated_speakers = Counter(str(segment.get("speaker") or "None") for segment in segments)
    current_speakers = Counter(str(item.get("Speaker") or "None") for item in current_subtitles)
    return {
        "summary": {
            "generated_subtitle_count": len(segments),
            "current_subtitle_count": len(current_subtitles),
            "generated_duration_seconds": round(max((float(item["end"]) for item in segments), default=0), 3),
            "generated_speakers": dict(generated_speakers),
            "current_speakers": dict(current_speakers),
        },
        "speaker_mapping_suggestions": suggest_speaker_mapping(segments, numeric_current),
        "metadata": {
            "current_aliases": existing_aliases,
            "current_establishments": existing_establishments,
            "known_aliases_detected_but_missing_from_track": matched_catalog_terms(transcript, all_aliases, existing_aliases),
            "known_establishments_detected_but_missing_from_track": matched_catalog_terms(
                transcript, all_establishments, existing_establishments
            ),
            "proper_name_candidates_for_manual_review": proper_name_candidates(
                segments, [*all_aliases, *all_establishments]
            ),
        },
        "notes": [
            "Speaker mappings are suggestions based on timestamp overlap with the current transcript.",
            "Alias and establishment detections are review leads, not automatic catalog edits.",
            "candidate-subtitles.json is formatted for comparison with the track JSON but is not applied automatically.",
        ],
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[redacted]" if any(secret in str(key).casefold() for secret in SECRET_KEYS) else sanitize(child)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [sanitize(child) for child in value]
    return value


def public_base_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    return urllib.parse.urlunsplit((parsed.scheme, host, parsed.path.rstrip("/"), "", ""))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def create_run_dir(root: Path, album_slug: str, track_slug: str) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = root / album_slug / track_slug / stamp
    suffix = 1
    while run_dir.exists():
        run_dir = root / album_slug / track_slug / f"{stamp}-{suffix}"
        suffix += 1
    run_dir.mkdir(parents=True)
    return run_dir


def write_summary(path: Path, album: Dict[str, Any], track: Dict[str, Any], manifest: Dict[str, Any],
                  review: Optional[Dict[str, Any]] = None) -> None:
    lines = [
        f"# {album.get('Album')} — {track.get('Track_Title')}",
        "",
        f"- Status: {manifest.get('status')}",
        f"- Created: {manifest.get('created_at')}",
        f"- Source: {manifest.get('source_type')}",
    ]
    if review:
        summary = review["summary"]
        lines.extend([
            f"- Generated subtitles: {summary['generated_subtitle_count']}",
            f"- Current subtitles: {summary['current_subtitle_count']}",
            f"- Generated speakers: {', '.join(summary['generated_speakers']) or 'none'}",
            "",
            "Review `review.json` for speaker mappings and metadata leads, then compare "
            "`candidate-subtitles.json` with the current track JSON.",
        ])
    if manifest.get("error"):
        lines.extend(["", f"Error: {manifest['error']}"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_analysis(args: argparse.Namespace) -> Path:
    catalog = load_catalog()
    album, track = find_track(catalog, args.album, args.track)
    analysis_root = args.analysis_root.resolve()
    run_dir = create_run_dir(analysis_root, args.album, args.track)
    created_at = datetime.now(timezone.utc).isoformat()
    audio_path = args.audio.resolve() if args.audio else resolve_usb_audio(
        args.usb_root.resolve(), album["USB_Directory"], track["USB_Filename"]
    )
    manifest: Dict[str, Any] = {
        "schema_version": 1,
        "status": "running",
        "created_at": created_at,
        "source_type": "whisper-webui",
        "track": {
            "album": album.get("Album"),
            "album_slug": args.album,
            "track": track.get("Track_Title"),
            "track_slug": args.track,
            "usb_directory": album.get("USB_Directory"),
            "usb_filename": track.get("USB_Filename"),
        },
        "audio": {
            "filename": audio_path.name,
            "size_bytes": audio_path.stat().st_size,
            "sha256": sha256_file(audio_path),
        },
        "request": {
            "base_url": public_base_url(args.url),
            "model": args.model or track.get("Whisper_Model"),
            "language": args.language,
            "diarization": not args.no_diarization,
            "diarization_device": args.diarization_device,
        },
    }
    write_json(run_dir / "manifest.json", manifest)
    try:
        client_module = _load_client_module()
        client = client_module.WhisperWebUIClient(client_module.HttpClient(
            args.url,
            args.username,
            args.password,
            verify_tls=not args.insecure,
            timeout=args.request_timeout,
        ))
        response = client.transcribe(
            audio_path,
            model=args.model or track.get("Whisper_Model"),
            language=args.language,
            diarize=not args.no_diarization,
            diarization_device=args.diarization_device,
            hf_token=os.environ.get("HF_TOKEN"),
            poll_interval=args.poll_interval,
            max_wait=args.max_wait,
        )
        write_json(run_dir / "api-response.json", sanitize(response))
        segments, srt = segments_from_api(response)
        if not segments:
            raise RuntimeError("Whisper-WebUI returned no transcript segments")
        return finish_bundle(run_dir, catalog, album, track, manifest, segments, srt)
    except Exception as exc:
        manifest["status"] = "failed"
        manifest["completed_at"] = datetime.now(timezone.utc).isoformat()
        manifest["error"] = f"{type(exc).__name__}: {exc}"
        write_json(run_dir / "manifest.json", manifest)
        write_json(run_dir / "error.json", {"type": type(exc).__name__, "message": str(exc)})
        write_summary(run_dir / "README.md", album, track, manifest)
        raise RuntimeError(f"Analysis failed; diagnostics were saved in {run_dir}: {exc}") from exc


def import_srt(args: argparse.Namespace) -> Path:
    catalog = load_catalog()
    album, track = find_track(catalog, args.album, args.track)
    run_dir = create_run_dir(args.analysis_root.resolve(), args.album, args.track)
    srt = args.srt.read_text(encoding="utf-8-sig")
    segments = parse_srt(srt)
    manifest = {
        "schema_version": 1,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "imported-srt",
        "track": {
            "album": album.get("Album"),
            "album_slug": args.album,
            "track": track.get("Track_Title"),
            "track_slug": args.track,
            "usb_directory": album.get("USB_Directory"),
            "usb_filename": track.get("USB_Filename"),
        },
        "source_srt": {"filename": args.srt.name, "sha256": sha256_file(args.srt)},
    }
    return finish_bundle(run_dir, catalog, album, track, manifest, segments, srt)


def finish_bundle(run_dir: Path, catalog: Dict[str, Any], album: Dict[str, Any], track: Dict[str, Any],
                  manifest: Dict[str, Any], segments: Sequence[Dict[str, Any]], srt: str) -> Path:
    current = load_current_subtitles(str(album["Album_Slug"]), track)
    review = build_review(catalog, track, segments, current)
    (run_dir / "transcript.srt").write_text(srt.strip() + "\n", encoding="utf-8")
    write_json(run_dir / "segments.json", list(segments))
    write_json(run_dir / "candidate-subtitles.json", repo_segments(segments))
    write_json(run_dir / "review.json", review)
    manifest["status"] = "completed"
    manifest["completed_at"] = datetime.now(timezone.utc).isoformat()
    manifest["artifacts"] = [
        "transcript.srt", "segments.json", "candidate-subtitles.json", "review.json", "README.md"
    ]
    write_json(run_dir / "manifest.json", manifest)
    write_summary(run_dir / "README.md", album, track, manifest, review)
    latest = run_dir.parent / "latest.json"
    write_json(latest, {"run": run_dir.name, "status": "completed", "updated_at": manifest["completed_at"]})
    return run_dir


def add_track_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--album", required=True, help="Album slug from data.json")
    parser.add_argument("--track", required=True, help="Track slug from data.json")
    parser.add_argument("--analysis-root", type=Path, default=DEFAULT_ANALYSIS_ROOT)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze = subparsers.add_parser("analyze", help="Resolve an MP3 and send it to Whisper-WebUI")
    add_track_arguments(analyze)
    source = analyze.add_mutually_exclusive_group(required=True)
    source.add_argument("--usb-root", type=Path, help="Mounted LPC USB root")
    source.add_argument("--audio", type=Path, help="Explicit audio path, useful for testing")
    analyze.add_argument("--url", default=os.environ.get("WHISPER_WEBUI_URL"))
    analyze.add_argument("--username", default=os.environ.get("WHISPER_WEBUI_USERNAME"))
    analyze.add_argument("--password", default=os.environ.get("WHISPER_WEBUI_PASSWORD"))
    analyze.add_argument("--model")
    analyze.add_argument("--language", default="en")
    analyze.add_argument("--diarization-device", default="cpu")
    analyze.add_argument("--no-diarization", action="store_true")
    analyze.add_argument("--insecure", action="store_true")
    analyze.add_argument("--poll-interval", type=float, default=3.0)
    analyze.add_argument("--max-wait", type=float, default=7200.0)
    analyze.add_argument("--request-timeout", type=float, default=120.0)
    analyze.set_defaults(handler=run_analysis)

    imported = subparsers.add_parser("import-srt", help="Build a review bundle from an existing SRT")
    add_track_arguments(imported)
    imported.add_argument("srt", type=Path)
    imported.set_defaults(handler=import_srt)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    load_repo_env()
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "analyze" and not args.url:
        parser.error("analyze requires --url or WHISPER_WEBUI_URL")
    output = args.handler(args)
    print(output)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
