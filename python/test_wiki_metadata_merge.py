import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("wiki_metadata_merge.py")
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("wiki_metadata_merge", MODULE_PATH)
metadata = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = metadata
SPEC.loader.exec_module(metadata)


ALIASES = """
== Alphabetical aliases ==
==== B ====
*'''Bart Hacker''' – ''[[Longmont Potion Castle Vol. 4|Vol. 4]]''
*'''[[Bill Murray]]''' – ''[[LPC 11]]''
== Alias usage by album ==
=== ''LPC 11'' ===
1. "[[Helicopter Cannon]]"
* '''Bill Murray'''
== Just a big list ==
ignored
"""


ORGANIZATIONS = """
== Organizations ==
=== Real world ===
* '''AT&T''' - ''[[Tour Line Live]]''
=== Created ===
* '''Best Surfaces''' – ''[[Longmont Potion Castle III|LPC 3]]''
==Organizations by album==
===''LPC 3''===
36. "[[Underbakke & Associates]]"
*'''Best Surfaces'''
==Just a big list==
Best Surfaces, the Bart Hacker Coalition, UPS.
"""


class ParsingTests(unittest.TestCase):
    def test_parses_aliases_and_album_links(self):
        records = metadata.parse_aliases(ALIASES)
        self.assertEqual(records["bart hacker"].name, "Bart Hacker")
        self.assertEqual(records["bart hacker"].albums, {"longmont-potion-castle-4"})
        self.assertEqual(records["bill murray"].albums, {"longmont-potion-castle-11"})

    def test_parses_organization_types_and_unclassified_list(self):
        records = metadata.parse_organizations(ORGANIZATIONS)
        self.assertEqual(records["at and t"].kind, "real-world")
        self.assertEqual(records["best surfaces"].kind, "created")
        self.assertEqual(records["bart hacker coalition"].kind, "unspecified")

    def test_parses_explicit_track_usage(self):
        records = metadata.parse_organizations(ORGANIZATIONS)
        usage = metadata.parse_track_usage(
            ORGANIZATIONS, "Organizations by album", records
        )
        self.assertEqual(
            usage[("longmont-potion-castle-iii", "Underbakke & Associates")],
            {"best surfaces"},
        )


class MatchingTests(unittest.TestCase):
    def test_compound_organization_can_span_title_and_transcript(self):
        record = metadata.MetadataRecord("the Bart Hacker Coalition")
        track = {"Track_Title": "Coalition 1"}
        text = metadata.normalize_name("This is Bart Hacker. I want to form a coalition.")
        self.assertTrue(metadata._organization_matches(record, track, text))

    def test_ambiguous_unclassified_organization_requires_title_match(self):
        record = metadata.MetadataRecord("The Whip", kind="unspecified")
        self.assertFalse(metadata._organization_matches(
            record, {"Track_Title": "Pill Salesmen"}, "you are talking whip"
        ))
        self.assertTrue(metadata._organization_matches(
            record, {"Track_Title": "Talkin Whip"}, "you are talking whip"
        ))

    def test_single_word_alias_requires_an_introduction(self):
        record = metadata.MetadataRecord("Bert")
        self.assertFalse(metadata._alias_matches(record, "bert called back", "bert called back"))
        self.assertTrue(metadata._alias_matches(record, "this is bert", "this is bert"))

    def test_merge_preserves_strings_and_adds_parallel_type_map(self):
        data = {
            "Albums": [{
                "Album_Slug": "album",
                "Tracks": [{
                    "Track_Slug": "track",
                    "Aliases": ["Existing"],
                    "Establishments": "Existing Place",
                }],
            }]
        }
        aliases = {"new name": metadata.MetadataRecord("New Name")}
        organizations = {
            "new place": metadata.MetadataRecord("New Place", kind="created")
        }
        metadata.merge_metadata(
            data,
            aliases,
            organizations,
            {("album", "track"): {"new name"}},
            {("album", "track"): {"new place"}},
        )
        track = data["Albums"][0]["Tracks"][0]
        self.assertEqual(track["Aliases"], ["Existing", "New Name"])
        self.assertEqual(track["Establishments"], ["Existing Place", "New Place"])
        self.assertEqual(
            track["Establishment_Types"],
            {"Existing Place": "unspecified", "New Place": "created"},
        )
        self.assertEqual(track["Talkin_Whipapedia"]["Aliases"], ["New Name"])
        self.assertEqual(track["Talkin_Whipapedia"]["Establishments"], ["New Place"])

        metadata.merge_metadata(data, aliases, organizations, {}, {})
        self.assertEqual(track["Aliases"], ["Existing"])
        self.assertEqual(track["Establishments"], ["Existing Place"])
        self.assertNotIn("Talkin_Whipapedia", track)


if __name__ == "__main__":
    unittest.main()
