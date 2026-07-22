#!/usr/bin/env python3
"""Serve the production Jekyll output plus a safe local transcription-status API."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SITE_ROOT = REPO_ROOT / "jekyll" / "_site"
DEFAULT_STATUS = REPO_ROOT / "analysis" / "whisper-webui" / "batches" / "latest.json"
DEFAULT_ANALYSIS_ROOT = REPO_ROOT / "analysis" / "whisper-webui"


def whisper_health(url: str) -> dict[str, Any]:
    endpoint = url.rstrip("/") + "/gradio_api/info"
    try:
        with urllib.request.urlopen(endpoint, timeout=3) as response:
            payload = json.load(response)
        named = payload.get("named_endpoints", {})
        transcribe = named.get("/transcribe_file", {})
        parameters = transcribe.get("parameters", [])
        model_parameter = next((item for item in parameters if item.get("parameter_name") == "model_size"), {})
        choices = model_parameter.get("type", {}).get("enum", [])
        return {"online": True, "url": url, "transcription_api": "/transcribe_file" in named, "models": choices}
    except (OSError, ValueError, urllib.error.URLError):
        return {"online": False, "url": url, "transcription_api": False, "models": []}


def load_status(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def comparison_summary(path: Path, analysis_root: Path) -> dict[str, Any]:
    comparison = load_json(path)
    manifest = load_json(path.with_name("manifest.json"))
    summary = comparison.get("summary", {})
    alignments = comparison.get("alignments", [])
    receipts = sorted((path.parent / "merge-receipts").glob("*.json"))
    review_lines = sum(1 for item in alignments if item.get("text_action") == "review" or item.get("speaker_action") == "review")
    approved_lines = sum(1 for item in alignments if item.get("text_action") == "approved" or item.get("speaker_action") == "approved")
    run_id = path.parent.relative_to(analysis_root).as_posix()
    target = comparison.get("target", {})
    track = manifest.get("track", {})
    return {
        "id": run_id,
        "album": target.get("album") or track.get("album") or run_id.split("/")[0],
        "album_slug": target.get("album_slug") or track.get("album_slug"),
        "track": target.get("track") or track.get("track") or run_id.split("/")[-2],
        "track_slug": target.get("track_slug") or track.get("track_slug"),
        "generated_at": comparison.get("generated_at"),
        "analysis_created_at": manifest.get("created_at"),
        "model": comparison.get("source", {}).get("model") or manifest.get("request", {}).get("model"),
        "analysis_status": manifest.get("status"),
        "alignment_count": len(alignments),
        "review_lines": review_lines,
        "approved_lines": approved_lines,
        "speaker_mappings": len(comparison.get("speaker_mappings", [])),
        "metadata_proposals": sum(len(comparison.get("metadata", {}).get(key, [])) for key in ("aliases", "establishments")),
        "merged": bool(receipts),
        "merge_count": len(receipts),
        "summary": summary,
    }


def merge_index(analysis_root: Path) -> dict[str, Any]:
    runs = [comparison_summary(path, analysis_root) for path in analysis_root.glob("*/*/*/comparison.json")]
    runs.sort(key=lambda item: item.get("generated_at") or item.get("analysis_created_at") or "", reverse=True)
    receipt_count = sum(item["merge_count"] for item in runs)
    return {
        "stats": {
            "comparison_runs": len(runs),
            "tracks": len({(item["album_slug"], item["track_slug"]) for item in runs}),
            "review_lines": sum(item["review_lines"] for item in runs),
            "approved_lines": sum(item["approved_lines"] for item in runs),
            "merge_receipts": receipt_count,
            "merged_runs": sum(1 for item in runs if item["merged"]),
        },
        "runs": runs,
    }


def merge_detail(analysis_root: Path, run_id: str) -> dict[str, Any] | None:
    candidate = (analysis_root / run_id / "comparison.json").resolve()
    try:
        candidate.relative_to(analysis_root.resolve())
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    comparison = load_json(candidate)
    receipts = [load_json(path) for path in sorted((candidate.parent / "merge-receipts").glob("*.json"), reverse=True)]
    return {
        "run": comparison_summary(candidate, analysis_root),
        "speaker_mappings": comparison.get("speaker_mappings", []),
        "metadata": comparison.get("metadata", {}),
        "alignments": comparison.get("alignments", []),
        "receipts": receipts,
    }


class Handler(SimpleHTTPRequestHandler):
    status_path: Path
    whisper_url: str
    analysis_root: Path

    def send_json(self, payload: Any, status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/api/transcriptions":
            payload = {"whisper": whisper_health(self.whisper_url), "batch": load_status(self.status_path)}
            self.send_json(payload)
            return
        if parsed.path == "/api/transcription-merges":
            run_id = urllib.parse.parse_qs(parsed.query).get("run", [None])[0]
            if run_id:
                detail = merge_detail(self.analysis_root, run_id)
                self.send_json(detail or {"error": "Merge comparison not found"}, 200 if detail else 404)
            else:
                self.send_json(merge_index(self.analysis_root))
            return
        super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, default=DEFAULT_SITE_ROOT)
    parser.add_argument("--status", type=Path, default=DEFAULT_STATUS)
    parser.add_argument("--analysis-root", type=Path, default=DEFAULT_ANALYSIS_ROOT)
    parser.add_argument("--whisper-url", default="http://127.0.0.1:7861")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    site_root = args.site_root.resolve()
    if not (site_root / "index.html").is_file():
        parser.error(f"production site is not built: {site_root}")

    class ConfiguredHandler(Handler):
        status_path = args.status.resolve()
        whisper_url = args.whisper_url
        analysis_root = args.analysis_root.resolve()

        def __init__(self, *handler_args: Any, **handler_kwargs: Any):
            super().__init__(*handler_args, directory=str(site_root), **handler_kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ConfiguredHandler)
    print(f"Serving production site at http://127.0.0.1:{server.server_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
