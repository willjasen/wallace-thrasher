import argparse
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("whisper_compare_and_merge.py")
SPEC = importlib.util.spec_from_file_location("whisper_compare_and_merge", MODULE_PATH)
merge_tool = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(merge_tool)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


class WhisperMergeFixture:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.json_root = self.root / "jekyll" / "assets" / "json"
        self.data_path = self.json_root / "data.json"
        self.analysis_root = self.root / "analysis" / "whisper-webui"
        self.backup_root = self.analysis_root / "merge-backups"
        self.album_slug = "album-one"
        self.track_slug = "track-one"
        self.run_name = "20260101T000000Z"
        self.run_dir = self.analysis_root / self.album_slug / self.track_slug / self.run_name
        self.subtitle_path = self.json_root / self.album_slug / "track-one.json"
        self.data = {
            "Albums": [{
                "Album": "Album One",
                "Album_Slug": self.album_slug,
                "Tracks": [{
                    "Track_Title": "Track One",
                    "Track_Slug": self.track_slug,
                    "Track_JSONPath": "track-one.json",
                    "Subtitles_Adjusted": True,
                    "Aliases": ["Existing Alias"],
                    "Establishments": ["Existing Place"],
                    "Establishment_Types": {"Existing Place": "unspecified"},
                }, {
                    "Track_Title": "Catalog Evidence",
                    "Track_Slug": "catalog-evidence",
                    "Track_JSONPath": "catalog-evidence.json",
                    "Establishments": ["Known Place"],
                    "Establishment_Types": {"Known Place": "real-world"},
                }],
            }]
        }
        self.subtitles = [{
            "Index": 1,
            "Start Time": "00:00:00,000",
            "End Time": "00:00:01,000",
            "Speaker": "LPC",
            "Text": "Hello there.",
        }]
        self.candidate = [{
            "Index": 1,
            "Start Time": "00:00:00,000",
            "End Time": "00:00:01,000",
            "Speaker": "SPEAKER_00",
            "Text": "Hello, friend.",
        }]
        self.manifest = {
            "status": "completed",
            "track": {"album_slug": self.album_slug, "track_slug": self.track_slug},
            "audio": {"sha256": "audio-hash"},
            "request": {"model": "test-model"},
        }
        self.review = {
            "speaker_mapping_suggestions": [{
                "diarized_speaker": "SPEAKER_00",
                "suggested_catalog_speaker": "LPC",
                "confidence": 0.99,
                "overlap_seconds": 1.0,
            }],
            "metadata": {
                "known_aliases_detected_but_missing_from_track": ["New Alias"],
                "known_establishments_detected_but_missing_from_track": ["Known Place"],
            },
        }
        write_json(self.data_path, self.data)
        write_json(self.subtitle_path, self.subtitles)
        write_json(self.run_dir / "candidate-subtitles.json", self.candidate)
        write_json(self.run_dir / "manifest.json", self.manifest)
        write_json(self.run_dir / "review.json", self.review)
        write_json(
            self.analysis_root / self.album_slug / self.track_slug / "latest.json",
            {"run": self.run_name, "status": "completed"},
        )

    def patches(self):
        return mock.patch.multiple(
            merge_tool,
            PROJECT_ROOT=self.root,
            JSON_ROOT=self.json_root,
            DATA_JSON=self.data_path,
            ANALYSIS_ROOT=self.analysis_root,
            BACKUP_ROOT=self.backup_root,
        )

    def args(self, dry_run=False, allow_stale=False):
        return argparse.Namespace(
            album=self.album_slug,
            track=self.track_slug,
            run=None,
            analysis_root=self.analysis_root,
            backup_root=self.backup_root,
            dry_run=dry_run,
            allow_stale=allow_stale,
        )


class WhisperComparisonTests(unittest.TestCase):
    def test_metadata_already_present_in_current_track_is_not_reproposed(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            track = fixture.data["Albums"][0]["Tracks"][0]
            track["Establishments"].append("Known Place")
            proposals = merge_tool._metadata_proposals(fixture.data, track, fixture.review)
            self.assertEqual(proposals["establishments"], [])

    def test_compare_marks_machine_text_for_review_and_known_metadata_for_auto_add(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches():
                comparison = merge_tool.build_comparison(
                    fixture.data,
                    fixture.album_slug,
                    fixture.track_slug,
                    fixture.run_dir,
                )

            self.assertEqual(comparison["alignments"][0]["text_action"], "review")
            self.assertEqual(comparison["speaker_mappings"][0]["action"], "review")
            self.assertEqual(comparison["alignments"][0]["review_action"], "initialize_from_track")
            self.assertTrue(comparison["alignments"][0]["proposed_reviewed"])
            self.assertEqual(comparison["metadata"]["aliases"][0]["action"], "auto_add")
            self.assertEqual(comparison["metadata"]["establishments"][0]["type"], "real-world")

    def test_dry_run_reports_auto_adds_without_writing_project_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches():
                comparison = merge_tool.build_comparison(
                    fixture.data, fixture.album_slug, fixture.track_slug, fixture.run_dir
                )
                write_json(fixture.run_dir / "comparison.json", comparison)
                before = fixture.data_path.read_bytes()
                with contextlib.redirect_stdout(io.StringIO()):
                    result = merge_tool.merge(fixture.args(dry_run=True))

            self.assertEqual(result["aliases_added"], 1)
            self.assertEqual(result["establishments_added"], 1)
            self.assertEqual(result["review_flags_added"], 1)
            self.assertEqual(fixture.data_path.read_bytes(), before)
            self.assertFalse(fixture.backup_root.exists())

    def test_merge_writes_metadata_provenance_and_backup(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches(), mock.patch.object(merge_tool, "_run_id", return_value="1234567890123"):
                comparison = merge_tool.build_comparison(
                    fixture.data, fixture.album_slug, fixture.track_slug, fixture.run_dir
                )
                write_json(fixture.run_dir / "comparison.json", comparison)
                with contextlib.redirect_stdout(io.StringIO()):
                    result = merge_tool.merge(fixture.args())

            data = json.loads(fixture.data_path.read_text(encoding="utf-8"))
            track = data["Albums"][0]["Tracks"][0]
            self.assertIn("New Alias", track["Aliases"])
            self.assertIn("Known Place", track["Establishments"])
            self.assertNotIn("Whisper_WebUI", track)
            subtitles = json.loads(fixture.subtitle_path.read_text(encoding="utf-8"))
            self.assertTrue(subtitles[0]["Reviewed"])
            self.assertTrue((fixture.backup_root / "1234567890123" / "jekyll" / "assets" / "json" / "data.json").is_file())
            receipt = json.loads(
                (fixture.run_dir / "merge-receipts" / "1234567890123.json").read_text(encoding="utf-8")
            )
            self.assertEqual(receipt["source"]["audio_sha256"], "audio-hash")
            self.assertEqual(receipt["source"]["model"], "test-model")
            self.assertEqual(receipt["applied"]["establishments"], ["Known Place"])
            self.assertEqual(result["text_changed"], 0)

    def test_approved_text_replaces_one_line_and_marks_it_reviewed(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches(), mock.patch.object(merge_tool, "_run_id", return_value="1234567890123"):
                comparison = merge_tool.build_comparison(
                    fixture.data, fixture.album_slug, fixture.track_slug, fixture.run_dir
                )
                comparison["alignments"][0]["text_action"] = "approved"
                write_json(fixture.run_dir / "comparison.json", comparison)
                with contextlib.redirect_stdout(io.StringIO()):
                    result = merge_tool.merge(fixture.args())

            subtitles = json.loads(fixture.subtitle_path.read_text(encoding="utf-8"))
            self.assertEqual(subtitles[0]["Text"], "Hello, friend.")
            self.assertTrue(subtitles[0]["Reviewed"])
            self.assertEqual(result["text_changed"], 1)

    def test_comparison_paths_cannot_escape_project(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches():
                with self.assertRaisesRegex(ValueError, "escapes the project"):
                    merge_tool._project_path("../outside.json")

    def test_merge_rejects_stale_target_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = WhisperMergeFixture(temporary)
            with fixture.patches():
                comparison = merge_tool.build_comparison(
                    fixture.data, fixture.album_slug, fixture.track_slug, fixture.run_dir
                )
                write_json(fixture.run_dir / "comparison.json", comparison)
                fixture.data_path.write_text("{}\n", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "data.json changed"):
                    with contextlib.redirect_stdout(io.StringIO()):
                        merge_tool.merge(fixture.args(dry_run=True))


if __name__ == "__main__":
    unittest.main()
