import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("lpc_whisper_analysis.py")
SPEC = importlib.util.spec_from_file_location("lpc_whisper_analysis", MODULE_PATH)
analysis = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analysis)

CLIENT_SPEC = importlib.util.spec_from_file_location("whisper_client", analysis.CLIENT_PATH)
client_module = importlib.util.module_from_spec(CLIENT_SPEC)
CLIENT_SPEC.loader.exec_module(client_module)


class FakeWhisperHttp:
    def json(self, method, path, payload=None):
        if method == "GET" and path == "/openapi.json":
            return 200, {"paths": {"/transcription/": {"post": {}}}}
        if method == "GET" and path == "/task/test-task":
            return 200, {
                "identifier": "test-task",
                "status": "completed",
                "progress": 1.0,
                "result": [{"start": 0.0, "end": 1.0, "text": "SPEAKER_00|Hello"}],
                "task_params": {"diarization": {"hf_token": "secret"}},
            }
        return 404, {"detail": "not found"}

    def multipart_file(self, path, field, file_path, query=None):
        if path == "/transcription/" and field == "file" and file_path.is_file():
            return 201, {"identifier": "test-task", "status": "queued", "message": "queued"}
        return 404, {"detail": "not found"}


class LpcWhisperAnalysisTests(unittest.TestCase):
    def test_default_model_is_workflow_configuration_not_track_metadata(self):
        args = analysis.build_parser().parse_args([
            "analyze",
            "--album", "album-one",
            "--track", "track-one",
            "--audio", "/tmp/track.mp3",
            "--url", "http://127.0.0.1:7860",
        ])
        self.assertEqual(args.model, "distil-large-v3")

    def test_parse_diarized_srt(self):
        content = """1
00:00:00,000 --> 00:00:02,500
SPEAKER_00|Hello there.

2
00:00:02.500 --> 00:00:03.750
SPEAKER_01|General Kenobi.
"""
        segments = analysis.parse_srt(content)
        self.assertEqual(segments[0]["speaker"], "SPEAKER_00")
        self.assertEqual(segments[1]["text"], "General Kenobi.")
        self.assertEqual(segments[1]["start"], 2.5)

    def test_usb_resolver_handles_punctuation_variants(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            album = root / "LPC USB" / "2024 – Best Before ‘24"
            album.mkdir(parents=True)
            audio = album / "TRACK ONE.MP3"
            audio.write_bytes(b"audio")
            resolved = analysis.resolve_usb_audio(root, "2024 - Best Before '24", "Track One.mp3")
            self.assertEqual(resolved, audio.resolve())

    def test_speaker_mapping_uses_time_overlap(self):
        generated = [
            {"start": 0.0, "end": 2.0, "speaker": "SPEAKER_00", "text": "Hi"},
            {"start": 2.0, "end": 4.0, "speaker": "SPEAKER_01", "text": "Hello"},
        ]
        current = [
            {"start": 0.0, "end": 2.0, "speaker": "LPC"},
            {"start": 2.0, "end": 4.0, "speaker": "Clerk"},
        ]
        mappings = analysis.suggest_speaker_mapping(generated, current)
        by_raw = {item["diarized_speaker"]: item for item in mappings}
        self.assertEqual(by_raw["SPEAKER_00"]["suggested_catalog_speaker"], "LPC")
        self.assertEqual(by_raw["SPEAKER_01"]["suggested_catalog_speaker"], "Clerk")

    def test_secret_fields_are_redacted_recursively(self):
        value = {"task_params": {"hf_token": "secret"}, "result": [{"text": "safe"}]}
        sanitized = analysis.sanitize(value)
        self.assertEqual(sanitized["task_params"]["hf_token"], "[redacted]")
        self.assertEqual(sanitized["result"][0]["text"], "safe")

    def test_import_srt_writes_complete_review_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            srt = root / "brian.srt"
            srt.write_text(
                "1\n00:00:00,000 --> 00:00:01,000\nSPEAKER_00|Hello Brian.\n",
                encoding="utf-8",
            )
            args = argparse.Namespace(
                album="longmont-potion-castle",
                track="brian",
                analysis_root=root / "analysis",
                srt=srt,
            )
            run_dir = analysis.import_srt(args)
            manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["status"], "completed")
            self.assertTrue((run_dir / "candidate-subtitles.json").is_file())
            self.assertTrue((run_dir / "review.json").is_file())
            self.assertTrue((run_dir / "transcript.srt").is_file())

    def test_rest_client_uploads_and_polls(self):
        with tempfile.TemporaryDirectory() as temporary:
            audio = Path(temporary) / "track.mp3"
            audio.write_bytes(b"fake mp3")
            client = client_module.WhisperWebUIClient(FakeWhisperHttp())
            result = client.transcribe(audio, poll_interval=0, max_wait=1)
            self.assertEqual(result["adapter"], "rest")
            self.assertEqual(result["task"]["result"][0]["text"], "SPEAKER_00|Hello")
            self.assertEqual(result["task"]["task_params"]["diarization"]["hf_token"], "[redacted]")


if __name__ == "__main__":
    unittest.main()
