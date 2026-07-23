#!/usr/bin/env python3
"""Dependency-free HTTPS client for Whisper-WebUI's REST or Gradio API."""

from __future__ import annotations

import argparse
import base64
import http.client
import json
import mimetypes
import os
import secrets
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
SECRET_KEYS = ("token", "password", "authorization", "cookie", "api_key")


class WhisperWebUIError(RuntimeError):
    pass


class HttpClient:
    def __init__(
        self,
        base_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        verify_tls: bool = True,
        timeout: float = 60.0,
    ) -> None:
        parsed = urllib.parse.urlsplit(base_url.rstrip("/"))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise WhisperWebUIError("The Whisper-WebUI URL must start with http:// or https://")
        if parsed.username is not None or parsed.password is not None:
            raise WhisperWebUIError(
                "Do not embed credentials in the URL; use WHISPER_WEBUI_USERNAME and "
                "WHISPER_WEBUI_PASSWORD instead"
            )
        self.base_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))
        self.username = username
        self.password = password or ""
        self.timeout = timeout
        self.ssl_context = ssl.create_default_context()
        if not verify_tls:
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE

    def url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    def headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.username is not None:
            token = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
            headers["Authorization"] = f"Basic {token}"
        if extra:
            headers.update(extra)
        return headers

    def request_bytes(self, method: str, url: str, body: Optional[bytes] = None,
                      headers: Optional[Dict[str, str]] = None) -> Tuple[int, bytes, Dict[str, str]]:
        request = urllib.request.Request(url, data=body, method=method, headers=self.headers(headers))
        try:
            with urllib.request.urlopen(request, timeout=self.timeout, context=self.ssl_context) as response:
                return response.status, response.read(), dict(response.headers.items())
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read(), dict(exc.headers.items())
        except OSError as exc:
            raise WhisperWebUIError(f"Could not reach Whisper-WebUI at {url}: {exc}") from exc

    def json(self, method: str, path: str, payload: Any = None) -> Tuple[int, Any]:
        body = None
        headers = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
        status, raw, _ = self.request_bytes(method, self.url(path), body, headers)
        try:
            parsed = json.loads(raw.decode("utf-8")) if raw else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            parsed = {"raw": raw.decode("utf-8", errors="replace")}
        return status, parsed

    def get_external(self, url: str) -> bytes:
        if url.startswith("/"):
            url = self.url(url)
        status, body, _ = self.request_bytes("GET", url)
        if not 200 <= status < 300:
            raise WhisperWebUIError(f"Whisper-WebUI output download failed with HTTP {status}")
        return body

    def multipart_file(self, path: str, field: str, file_path: Path,
                       query: Optional[Dict[str, Any]] = None) -> Tuple[int, Any]:
        target = self.url(path)
        if query:
            values = {key: _query_value(value) for key, value in query.items() if value is not None}
            target = f"{target}?{urllib.parse.urlencode(values)}"
        parsed = urllib.parse.urlsplit(target)
        boundary = f"----wallace-thrasher-{secrets.token_hex(12)}"
        mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        preamble = (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"{field}\"; filename=\"{file_path.name}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        ending = f"\r\n--{boundary}--\r\n".encode("ascii")
        content_length = len(preamble) + file_path.stat().st_size + len(ending)
        headers = self.headers({
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(content_length),
        })
        connection_class = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
        kwargs: Dict[str, Any] = {"timeout": self.timeout}
        if parsed.scheme == "https":
            kwargs["context"] = self.ssl_context
        connection = connection_class(parsed.hostname, parsed.port, **kwargs)
        request_path = urllib.parse.urlunsplit(("", "", parsed.path, parsed.query, ""))
        try:
            connection.putrequest("POST", request_path)
            for name, value in headers.items():
                connection.putheader(name, value)
            connection.endheaders()
            connection.send(preamble)
            with file_path.open("rb") as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    connection.send(chunk)
            connection.send(ending)
            response = connection.getresponse()
            raw = response.read()
            status = response.status
        except OSError as exc:
            raise WhisperWebUIError(f"Upload to Whisper-WebUI failed: {exc}") from exc
        finally:
            connection.close()
        try:
            return status, json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return status, {"raw": raw.decode("utf-8", errors="replace")}

    def sse(self, path: str) -> Iterable[Any]:
        request = urllib.request.Request(self.url(path), headers=self.headers({"Accept": "text/event-stream"}))
        try:
            with urllib.request.urlopen(request, timeout=self.timeout, context=self.ssl_context) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    value = line[5:].strip()
                    try:
                        yield json.loads(value)
                    except json.JSONDecodeError:
                        yield value
        except (urllib.error.URLError, OSError) as exc:
            raise WhisperWebUIError(f"Whisper-WebUI event stream failed: {exc}") from exc


class WhisperWebUIClient:
    def __init__(self, http: HttpClient) -> None:
        self.http = http

    def transcribe(
        self,
        audio_path: Path,
        model: Optional[str] = None,
        language: Optional[str] = "en",
        diarize: bool = True,
        diarization_device: str = "cpu",
        remove_background_music: bool = False,
        hf_token: Optional[str] = None,
        poll_interval: float = 3.0,
        max_wait: float = 7200.0,
    ) -> Dict[str, Any]:
        if not audio_path.is_file():
            raise WhisperWebUIError(f"Audio file does not exist: {audio_path}")
        status, spec = self.http.json("GET", "/openapi.json")
        paths = spec.get("paths", {}) if status == 200 and isinstance(spec, dict) else {}
        if "/transcription/" in paths or "/transcription" in paths:
            return self._transcribe_rest(
                audio_path, model, language, diarize, diarization_device,
                remove_background_music, hf_token, poll_interval, max_wait,
            )
        return self._transcribe_gradio(
            audio_path, model, language, diarize, diarization_device,
            remove_background_music, hf_token
        )

    def _transcribe_rest(
        self,
        audio_path: Path,
        model: Optional[str],
        language: Optional[str],
        diarize: bool,
        diarization_device: str,
        remove_background_music: bool,
        hf_token: Optional[str],
        poll_interval: float,
        max_wait: float,
    ) -> Dict[str, Any]:
        params = {
            "model_size": model,
            "lang": language,
            "is_translate": False,
            "word_timestamps": True,
            "is_diarize": diarize,
            "diarization_device": diarization_device,
            "is_separate_bgm": remove_background_music,
            "hf_token": hf_token,
            "enable_offload": True,
        }
        status, queued = self.http.multipart_file("/transcription/", "file", audio_path, params)
        if status == 404:
            status, queued = self.http.multipart_file("/transcription", "file", audio_path, params)
        if status != 201 or not isinstance(queued, dict) or not queued.get("identifier"):
            raise WhisperWebUIError(f"REST transcription request failed with HTTP {status}: {queued}")
        identifier = queued["identifier"]
        started = time.monotonic()
        history: List[Dict[str, Any]] = []
        while time.monotonic() - started <= max_wait:
            poll_status, task = self.http.json("GET", f"/task/{urllib.parse.quote(identifier)}")
            if poll_status != 200 or not isinstance(task, dict):
                raise WhisperWebUIError(f"Task poll failed with HTTP {poll_status}: {task}")
            history.append({"status": task.get("status"), "progress": task.get("progress")})
            task_status = str(task.get("status", "")).lower()
            if task_status in TERMINAL_STATUSES:
                if task_status != "completed":
                    raise WhisperWebUIError(f"Whisper-WebUI task {task_status}: {task.get('error') or task}")
                return _redact({"adapter": "rest", "queued": queued, "task": task, "poll_history": history})
            time.sleep(poll_interval)
        raise WhisperWebUIError(f"Whisper-WebUI task did not finish within {max_wait:g} seconds")

    def _transcribe_gradio(self, audio_path: Path, model: Optional[str],
                           language: Optional[str], diarize: bool,
                           diarization_device: str, remove_background_music: bool,
                           hf_token: Optional[str]) -> Dict[str, Any]:
        config = None
        for config_path in ("/config", "/gradio_api/config"):
            status, candidate = self.http.json("GET", config_path)
            if status == 200 and isinstance(candidate, dict) and candidate.get("dependencies"):
                config = candidate
                break
        if config is None:
            raise WhisperWebUIError(
                "The URL exposes neither Whisper-WebUI's REST API nor an accessible Gradio API. "
                "Use the HTTPS base URL whose /openapi.json or /config endpoint is reachable."
            )
        dependency, fn_index = _find_transcription_dependency(config)
        upload_path = None
        upload_error = None
        for candidate in ("/gradio_api/upload", "/upload"):
            status, uploaded = self.http.multipart_file(candidate, "files", audio_path)
            if 200 <= status < 300 and isinstance(uploaded, list) and uploaded:
                upload_path = uploaded[0]
                break
            upload_error = (status, uploaded)
        if upload_path is None:
            raise WhisperWebUIError(f"Gradio upload failed: {upload_error}")
        data = _gradio_input_data(
            config, dependency, audio_path, upload_path, model, language,
            diarize, diarization_device, remove_background_music, hf_token,
        )
        api_name = str(dependency.get("api_name") or "transcribe_file").lstrip("/")
        status, started = self.http.json("POST", f"/gradio_api/call/{urllib.parse.quote(api_name)}", {"data": data})
        if 200 <= status < 300 and isinstance(started, dict) and started.get("event_id"):
            result = _last_sse_result(self.http.sse(
                f"/gradio_api/call/{urllib.parse.quote(api_name)}/{urllib.parse.quote(started['event_id'])}"
            ))
            return {"adapter": "gradio-call", "event": started, "result": result,
                    "srt": _extract_gradio_srt(self.http, result)}
        session_hash = secrets.token_hex(8)
        queue_payload = {
            "data": data,
            "event_data": None,
            "fn_index": fn_index,
            "trigger_id": dependency.get("id"),
            "session_hash": session_hash,
        }
        queue_status, joined = self.http.json("POST", "/gradio_api/queue/join", queue_payload)
        if not 200 <= queue_status < 300:
            queue_status, joined = self.http.json("POST", "/queue/join", queue_payload)
        if not 200 <= queue_status < 300:
            raise WhisperWebUIError(f"Gradio transcription request failed: HTTP {queue_status}: {joined}")
        result = _last_sse_result(self.http.sse(
            f"/gradio_api/queue/data?session_hash={urllib.parse.quote(session_hash)}"
        ))
        return {"adapter": "gradio-queue", "event": joined, "result": result,
                "srt": _extract_gradio_srt(self.http, result)}


def _query_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[redacted]" if any(secret in str(key).casefold() for secret in SECRET_KEYS) else _redact(child)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [_redact(child) for child in value]
    return value


def _find_transcription_dependency(config: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    dependencies = config.get("dependencies", [])
    ranked = []
    for index, dependency in enumerate(dependencies):
        api_name = str(dependency.get("api_name") or "").lower()
        score = 0
        if api_name.strip("/") == "transcribe_file":
            score += 100
        if "transcrib" in api_name:
            score += 50
        if dependency.get("outputs") and len(dependency.get("outputs", [])) >= 2:
            score += 5
        ranked.append((score, index, dependency))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked or ranked[0][0] == 0:
        raise WhisperWebUIError("Could not find the file transcription operation in the Gradio config")
    _, index, dependency = ranked[0]
    return dependency, index


def _choice_values(props: Dict[str, Any]) -> List[Any]:
    values = []
    for choice in props.get("choices") or []:
        values.append(choice[-1] if isinstance(choice, (list, tuple)) else choice)
    return values


def _available_choice(props: Dict[str, Any], candidates: Iterable[Any]) -> Optional[Any]:
    choices = _choice_values(props)
    for candidate in candidates:
        if candidate in choices:
            return candidate
    return None


def _model_choice(props: Dict[str, Any], model: str) -> Optional[str]:
    return _available_choice(props, (model, model.rsplit("/", 1)[-1]))


def _language_choice(props: Dict[str, Any], language: str) -> Optional[str]:
    aliases = {"en": "english"}
    normalized = language.strip().lower()
    return _available_choice(props, (language, normalized, aliases.get(normalized)))


def _gradio_input_data(config: Dict[str, Any], dependency: Dict[str, Any], audio_path: Path,
                        uploaded_path: str, model: Optional[str], language: Optional[str],
                        diarize: bool, diarization_device: str,
                        remove_background_music: bool,
                        hf_token: Optional[str]) -> List[Any]:
    components = {component.get("id"): component for component in config.get("components", [])}
    values: List[Any] = []
    file_assigned = False
    in_diarization_section = False
    for component_id in dependency.get("inputs", []):
        component = components.get(component_id, {})
        props = component.get("props", {})
        label = str(props.get("label") or "").strip().lower()
        component_type = str(component.get("type") or "").lower()
        value = props.get("value")
        if not file_assigned and component_type in {"file", "files"}:
            file_data = {
                "path": uploaded_path,
                "orig_name": audio_path.name,
                "size": audio_path.stat().st_size,
                "mime_type": mimetypes.guess_type(audio_path.name)[0] or "audio/mpeg",
                "meta": {"_type": "gradio.FileData"},
            }
            value = [file_data] if component_type == "files" or props.get("file_count") == "multiple" else file_data
            file_assigned = True
        elif label == "model" and model:
            value = _model_choice(props, model) or value
        elif label == "language" and language:
            value = _language_choice(props, language) or value
        elif "enable diarization" in label:
            value = diarize
            in_diarization_section = True
        elif label == "device" and in_diarization_section:
            value = _available_choice(props, (diarization_device,)) or value
        elif "huggingface token" in label:
            value = hf_token or ""
        elif "enable background music remover" in label:
            value = remove_background_music
            in_diarization_section = False
        elif "file format" in label:
            value = "SRT"
        elif "add a timestamp" in label:
            value = False
        values.append(value)
    if not file_assigned:
        raise WhisperWebUIError("The Gradio transcription operation has no file input")
    return values


def _last_sse_result(events: Iterable[Any]) -> Any:
    last = None
    for event in events:
        last = event
        if isinstance(event, dict) and event.get("msg") == "process_completed":
            output = event.get("output", {})
            if not output.get("success", True):
                raise WhisperWebUIError(f"Gradio transcription failed: {output.get('error') or output}")
            return output.get("data", output)
    if last is None:
        raise WhisperWebUIError("Gradio returned no transcription result")
    if isinstance(last, dict) and "data" in last:
        return last["data"]
    return last


def _walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _extract_gradio_srt(http: HttpClient, result: Any) -> str:
    for value in _walk(result):
        if isinstance(value, str) and " --> " in value:
            start = value.find("1\n")
            return value[start if start >= 0 else 0:].strip() + "\n"
    for value in _walk(result):
        if not isinstance(value, dict):
            continue
        path = str(value.get("path") or "")
        url = value.get("url")
        if not (path.lower().endswith(".srt") or str(url).lower().endswith(".srt")):
            continue
        if not url and path:
            url = http.url(f"/gradio_api/file={urllib.parse.quote(path, safe='')}")
        if url:
            return http.get_external(str(url)).decode("utf-8", errors="replace")
    raise WhisperWebUIError("Gradio completed, but no SRT output was returned")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--url", default=os.environ.get("WHISPER_WEBUI_URL"), required=False)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model")
    parser.add_argument("--language", default="en")
    parser.add_argument("--diarization-device", default="cpu")
    parser.add_argument("--no-diarization", action="store_true")
    parser.add_argument("--remove-background-music", action="store_true")
    parser.add_argument("--username", default=os.environ.get("WHISPER_WEBUI_USERNAME"))
    parser.add_argument("--password", default=os.environ.get("WHISPER_WEBUI_PASSWORD"))
    parser.add_argument("--insecure", action="store_true", help="Disable HTTPS certificate verification")
    args = parser.parse_args(argv)
    if not args.url:
        parser.error("--url or WHISPER_WEBUI_URL is required")
    client = WhisperWebUIClient(HttpClient(
        args.url, args.username, args.password, verify_tls=not args.insecure,
    ))
    result = client.transcribe(
        args.audio,
        model=args.model,
        language=args.language,
        diarize=not args.no_diarization,
        diarization_device=args.diarization_device,
        remove_background_music=args.remove_background_music,
        hf_token=os.environ.get("HF_TOKEN"),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WhisperWebUIError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
