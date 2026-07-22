#!/usr/bin/env python3
"""Serve the production Jekyll output plus a safe local transcription-status API."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SITE_ROOT = REPO_ROOT / "jekyll" / "_site"
DEFAULT_STATUS = REPO_ROOT / "analysis" / "whisper-webui" / "batches" / "latest.json"


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


class Handler(SimpleHTTPRequestHandler):
    status_path: Path
    whisper_url: str

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/transcriptions":
            payload = {"whisper": whisper_health(self.whisper_url), "batch": load_status(self.status_path)}
            encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, default=DEFAULT_SITE_ROOT)
    parser.add_argument("--status", type=Path, default=DEFAULT_STATUS)
    parser.add_argument("--whisper-url", default="http://127.0.0.1:7861")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    site_root = args.site_root.resolve()
    if not (site_root / "index.html").is_file():
        parser.error(f"production site is not built: {site_root}")

    class ConfiguredHandler(Handler):
        status_path = args.status.resolve()
        whisper_url = args.whisper_url

        def __init__(self, *handler_args: Any, **handler_kwargs: Any):
            super().__init__(*handler_args, directory=str(site_root), **handler_kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ConfiguredHandler)
    print(f"Serving production site at http://127.0.0.1:{server.server_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
