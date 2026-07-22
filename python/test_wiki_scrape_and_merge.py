import importlib.util
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("wiki_scrape_and_merge.py")
SPEC = importlib.util.spec_from_file_location("wiki_scrape_and_merge", MODULE_PATH)
wiki = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(wiki)


def subtitle(index, speaker, text):
    return {
        "Index": index,
        "Start Time": "00:00:00,000",
        "End Time": "00:00:01,000",
        "Speaker": speaker,
        "Text": text,
    }


class WikitextParsingTests(unittest.TestCase):
    def test_extracts_unquoted_table_attributes(self):
        cell = '| style=width:13%; text-align:right; |Man (2):'
        self.assertEqual(wiki._extract_speaker_name(wiki._extract_cell_content(cell)), "Man (2)")

    def test_parses_styled_transcript_table(self):
        source = """
== Transcript ==
{| class="wikitable"
|-
| style=width:13%; text-align:right; |[[Caller|<span>LPC</span>]]:
| style="width:87%;" | Hello, there.
|}
== Notes ==
"""
        self.assertEqual(wiki.parse_transcript_from_wikitext(source), [("LPC", "Hello, there.")])

    def test_cleans_external_link_labels(self):
        raw = "Call [https://example.test/wiki/Person Evonne Goolagong] today."
        self.assertEqual(wiki._clean_wiki_text(raw), "Call Evonne Goolagong today.")

    def test_short_wiki_speaker_does_not_replace_existing_full_name(self):
        self.assertEqual(
            wiki._prefer_existing_specific_speaker("Alex Trebek", "Alex"),
            "Alex Trebek",
        )
        self.assertEqual(wiki._prefer_existing_specific_speaker("SPEAKER_01", "Alex"), "Alex")


class AlignmentTests(unittest.TestCase):
    def test_alignment_does_not_group_by_incorrect_diariser_code(self):
        wiki_lines = [
            ("Pam", "This is Pam, can I help you?"),
            ("LPC", "Let's talk procedure for a second."),
        ]
        entries = [
            subtitle(1, "SPEAKER_00", "Sure."),
            subtitle(2, "SPEAKER_01", "This is Pam."),
            subtitle(3, "SPEAKER_00", "Can I help you?"),
            subtitle(4, "SPEAKER_00", "Let's talk procedure for a second."),
        ]
        aligned = {item["json_index"]: item for item in wiki.align_wiki_to_json(wiki_lines, entries)}
        self.assertEqual(aligned[1]["match_type"], "unmatched_json")
        self.assertEqual(aligned[2]["wiki_speaker"], "Pam")
        self.assertEqual(aligned[3]["wiki_speaker"], "Pam")
        self.assertEqual(aligned[4]["wiki_speaker"], "LPC")

    def test_duplicate_subtitle_indices_are_rejected(self):
        entries = [subtitle(1, "SPEAKER_00", "One"), subtitle(1, "SPEAKER_00", "Two")]
        with self.assertRaisesRegex(ValueError, "duplicate Index 1"):
            wiki.align_wiki_to_json([("LPC", "One")], entries)

    def test_grouped_fragments_count_as_one_mapping_observation(self):
        alignments = [
            {
                "json_speaker": "SPEAKER_00",
                "wiki_speaker": "LPC",
                "similarity": 0.9,
                "wiki_indices": [3],
            },
            {
                "json_speaker": "SPEAKER_00",
                "wiki_speaker": "LPC",
                "similarity": 0.9,
                "wiki_indices": [3],
            },
        ]
        mapping, details = wiki.deduce_speaker_mapping_details(alignments)
        self.assertEqual(mapping, {"SPEAKER_00": "LPC"})
        self.assertEqual(details["SPEAKER_00"]["observations"], 1)

    def test_ambiguous_speaker_mapping_is_not_accepted(self):
        alignments = [
            {"json_speaker": "SPEAKER_00", "wiki_speaker": "LPC", "similarity": 0.9, "wiki_indices": [1]},
            {"json_speaker": "SPEAKER_00", "wiki_speaker": "Pam", "similarity": 0.8, "wiki_indices": [2]},
        ]
        mapping, details = wiki.deduce_speaker_mapping_details(alignments)
        self.assertEqual(mapping, {})
        self.assertFalse(details["SPEAKER_00"]["accepted"])

    def test_unclear_wiki_text_requires_review(self):
        self.assertTrue(wiki._contains_uncertainty("[unclear], this is Pam"))
        self.assertFalse(wiki._contains_uncertainty("This is Pam"))


class ArgumentTests(unittest.TestCase):
    def test_generated_data_uses_the_unified_kebab_case_layout(self):
        self.assertEqual(wiki.DATA_DIR.name, "wiki-data")
        self.assertEqual(wiki.SNAPSHOTS_DIR.relative_to(wiki.DATA_DIR), Path("scrapes"))
        self.assertEqual(wiki.COMPARE_DIR.relative_to(wiki.DATA_DIR), Path("comparisons"))
        self.assertEqual(wiki.BACKUP_DIR.relative_to(wiki.DATA_DIR), Path("merge-backups"))
        self.assertEqual(wiki.LATEST_FILE.relative_to(wiki.DATA_DIR), Path("latest-scrape"))

    def test_generated_run_id_is_a_unix_timestamp_in_milliseconds(self):
        with mock.patch.object(wiki.time, "time_ns", return_value=1_775_667_781_123_456_789):
            self.assertEqual(wiki._unix_timestamp_ms(), "1775667781123")

    def test_ratio_must_be_in_range(self):
        with self.assertRaises(Exception):
            wiki._ratio_arg("1.1")

    def test_snapshot_cannot_escape_cache_directory(self):
        with self.assertRaisesRegex(ValueError, "Snapshot IDs"):
            wiki._validate_snapshot_name("../outside")

    def test_snapshot_id_requires_a_unix_timestamp_prefix(self):
        with self.assertRaisesRegex(ValueError, "13-digit Unix timestamp"):
            wiki._validate_snapshot_name("my-label")
        self.assertEqual(
            wiki._validate_snapshot_name("1775667781123-my-label"),
            "1775667781123-my-label",
        )

    def test_album_specific_wiki_title_is_tried_first(self):
        self.assertEqual(
            wiki.candidate_wiki_titles("Brian", "longmont-potion-castle-7"),
            ["Brian (LPC 7)", "Brian"],
        )

    def test_merge_accepts_track_coverage_threshold(self):
        args = wiki.build_parser().parse_args(["merge", "--min-coverage", "0.8"])
        self.assertEqual(args.min_coverage, 0.8)

    def test_numbered_search_result_cannot_cross_match_parts(self):
        def results(query):
            if query.endswith(" 1"):
                return ["Steve's Meat Market 2"]
            return ["Steve's Meat Market 2", "Steve's Meat Market 1"]

        with mock.patch.object(wiki, "search_wiki_titles", side_effect=results):
            self.assertEqual(
                wiki.best_search_match("Steves Meat Market 1", "longmont-potion-castle-ii"),
                "Steve's Meat Market 1",
            )


class RequestTests(unittest.TestCase):
    def test_network_failure_is_not_reported_as_a_missing_page(self):
        with mock.patch.object(wiki.urllib.request, "urlopen", side_effect=wiki.urllib.error.URLError("offline")):
            with self.assertRaises(wiki.WikiRequestError):
                wiki._request_json("https://example.test/api", attempts=1)


if __name__ == "__main__":
    unittest.main()
