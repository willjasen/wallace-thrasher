#!/usr/bin/env python3
"""Run a tracked, sequential Whisper-WebUI batch for one catalog album."""

from __future__ import annotations

import argparse
import difflib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import lpc_whisper_analysis as analysis


DEFAULT_USB_ROOT = Path("/Users/willjasen/Library/Mobile Documents/com~apple~CloudDocs/Media/Longmont Potion Castle/Ultimate Session Bundle/LPC USB")
DEFAULT_MODEL = "large-v3-turbo"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_status(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def resolve_audio(usb_root: Path, album: dict[str, Any], track: dict[str, Any]) -> Path:
    try:
        return analysis.resolve_usb_audio(usb_root, album["USB_Directory"], track["USB_Filename"])
    except FileNotFoundError:
        album_dir = usb_root / album["USB_Directory"]
        choices = [path for path in album_dir.glob("*.mp3") if path.is_file()]
        wanted = analysis.normalize_name(Path(track["USB_Filename"]).stem, True)
        names = {analysis.normalize_name(path.stem, True): path for path in choices}
        matches = difflib.get_close_matches(wanted, list(names), n=2, cutoff=0.88)
        if len(matches) == 1:
            return names[matches[0]].resolve()
        raise


def build_status(album: dict[str, Any], model: str, url: str) -> dict[str, Any]:
    tracks = sorted(album["Tracks"], key=lambda item: item["Track_Number"])
    created = now()
    return {
        "schema_version": 1,
        "batch_id": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
        "album": {"title": album["Album"], "slug": album["Album_Slug"]},
        "model": model,
        "whisper_url": analysis.public_base_url(url),
        "status": "queued",
        "created_at": created,
        "updated_at": created,
        "totals": {"all": len(tracks), "pending": len(tracks), "running": 0, "completed": 0, "failed": 0},
        "tracks": [{
            "number": track["Track_Number"],
            "title": track["Track_Title"],
            "slug": track["Track_Slug"],
            "status": "pending",
        } for track in tracks],
    }


def update_totals(status: dict[str, Any]) -> None:
    counts = {name: 0 for name in ("pending", "running", "completed", "failed")}
    for track in status["tracks"]:
        counts[track["status"]] += 1
    status["totals"] = {"all": len(status["tracks"]), **counts}
    status["updated_at"] = now()


def run(args: argparse.Namespace) -> int:
    catalog = analysis.load_catalog()
    album = next((item for item in catalog["Albums"] if item["Album_Slug"] == args.album), None)
    if album is None:
        raise ValueError(f"Unknown album slug: {args.album}")
    status = build_status(album, args.model, args.url)
    batch_dir = args.analysis_root.resolve() / "batches" / status["batch_id"]
    status_path = batch_dir / "status.json"
    latest_path = args.analysis_root.resolve() / "batches" / "latest.json"
    write_status(status_path, status)
    write_status(latest_path, status)

    status["status"] = "running"
    for track_status, track in zip(status["tracks"], sorted(album["Tracks"], key=lambda item: item["Track_Number"])):
        track_status["status"] = "running"
        track_status["started_at"] = now()
        status["current_track"] = {"number": track["Track_Number"], "title": track["Track_Title"], "slug": track["Track_Slug"]}
        update_totals(status)
        write_status(status_path, status)
        write_status(latest_path, status)
        try:
            audio = resolve_audio(args.usb_root.resolve(), album, track)
            command = [
                sys.executable, str(Path(__file__).with_name("lpc_whisper_analysis.py")), "analyze",
                "--album", args.album, "--track", track["Track_Slug"], "--audio", str(audio),
                "--url", args.url, "--model", args.model, "--diarization-device", args.diarization_device,
                "--analysis-root", str(args.analysis_root.resolve()), "--max-wait", str(args.max_wait),
            ]
            result = subprocess.run(command, text=True, capture_output=True)
            if result.returncode:
                raise RuntimeError((result.stderr or result.stdout).strip()[-2000:])
            track_status["status"] = "completed"
            track_status["run"] = result.stdout.strip().splitlines()[-1]
        except Exception as exc:
            track_status["status"] = "failed"
            track_status["error"] = f"{type(exc).__name__}: {exc}"
        track_status["completed_at"] = now()
        update_totals(status)
        write_status(status_path, status)
        write_status(latest_path, status)

    status.pop("current_track", None)
    status["status"] = "completed" if status["totals"]["failed"] == 0 else "completed_with_errors"
    status["completed_at"] = now()
    update_totals(status)
    write_status(status_path, status)
    write_status(latest_path, status)
    return 0 if status["totals"]["failed"] == 0 else 1


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--album", required=True)
    result.add_argument("--usb-root", type=Path, default=DEFAULT_USB_ROOT)
    result.add_argument("--analysis-root", type=Path, default=analysis.DEFAULT_ANALYSIS_ROOT)
    result.add_argument("--url", default="http://127.0.0.1:7861")
    result.add_argument("--model", default=DEFAULT_MODEL)
    result.add_argument("--diarization-device", default="cpu")
    result.add_argument("--max-wait", type=float, default=14400.0)
    return result


if __name__ == "__main__":
    try:
        raise SystemExit(run(parser().parse_args()))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
