#!/usr/bin/env python3
"""Merge Talkin' Whipapedia aliases and organizations into data.json.

The wiki calls the project's ``Establishments`` field "Organizations".  This
importer keeps the established project vocabulary and stores the wiki's
classification in a parallel ``Establishment_Types`` mapping.  Types are one
of ``real-world``, ``created``, or ``unspecified`` when the organization only
appears in the wiki's unclassified "Just a big list" section.

Associations explicitly listed in the wiki are preferred.  The remaining
album-level aliases and unassociated organizations are matched against local
track titles and transcript text.  Use ``--dry-run`` to inspect the result and
``--write`` to update jekyll/assets/json/data.json atomically.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field

import wiki_scrape_and_merge as wiki


ALIASES_PAGE = "The Many Names of LPC"
ORGANIZATIONS_PAGE = "The Many Organizations of LPC"
SOURCE_URL = "https://talkinwhipapedia.fandom.com/wiki/Home#Navigation"
AMBIGUOUS_UNCLASSIFIED_ORGANIZATIONS = {"rope", "whip", "good faith"}


@dataclass
class MetadataRecord:
    name: str
    albums: set[str] = field(default_factory=set)
    kind: str | None = None


def _section(source: str, start: str, end: str | None = None) -> str:
    pattern = rf"^==\s*{re.escape(start)}\s*==\s*$"
    match = re.search(pattern, source, re.MULTILINE | re.IGNORECASE)
    if not match:
        return ""
    tail = source[match.end() :]
    if end:
        stop = re.search(
            rf"^==\s*{re.escape(end)}\s*==\s*$",
            tail,
            re.MULTILINE | re.IGNORECASE,
        )
    else:
        stop = re.search(r"^==[^=].*==\s*$", tail, re.MULTILINE)
    return tail[: stop.start()] if stop else tail


def _plain_wiki_text(value: str) -> str:
    value = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = value.replace("'''", "").replace("''", "")
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", value).strip()


def _bold_label(line: str) -> str | None:
    """Return the first bold list-item label, tolerating italic nesting."""
    if not re.match(r"^\s*\*", line):
        return None
    content = line.lstrip()[1:].strip()
    # Wiki list labels consistently end at the first run of three apostrophes
    # followed by whitespace, punctuation, a parenthesis, or end-of-line.
    start = content.find("'''")
    if start < 0:
        return None
    content = content[start + 3 :]
    match = re.search(r"'''(?=\s*(?:[-–—(]|$))", content)
    if not match:
        return None
    label = _plain_wiki_text(content[: match.start()])
    return label.strip(" -–—") or None


def _linked_titles(line: str) -> list[str]:
    return [target.strip() for target, _ in re.findall(r"\[\[([^\]|]+)(\|[^\]]+)?\]\]", line)]


def album_slug_for_wiki_title(title: str) -> str | None:
    plain = _plain_wiki_text(title).strip()
    normalized = normalize_name(plain)
    fixed = {
        "longmont potion castle album": "longmont-potion-castle",
        "longmont potion castle": "longmont-potion-castle",
        "lpc i": "longmont-potion-castle",
        "longmont potion castle ii": "longmont-potion-castle-ii",
        "lpc ii": "longmont-potion-castle-ii",
        "longmont potion castle iii": "longmont-potion-castle-iii",
        "lpc iii": "longmont-potion-castle-iii",
        "longmont potion castle vol 4": "longmont-potion-castle-4",
        "vol 4": "longmont-potion-castle-4",
        "best before 24": "best-before-24",
        "tour line live": "tour-line-live",
        "alive in 25": "alive-in-25",
        "the lpc": "the-longmont-potion-castle",
        "the longmont potion castle": "the-longmont-potion-castle",
        "where in the hell is the lavender house soundtrack": "where-in-the-hell-is-the-lavender-house-soundtrack",
    }
    if normalized in fixed:
        return fixed[normalized]
    match = re.fullmatch(r"(?:longmont potion castle|lpc) (\d+)", normalized)
    if match:
        number = int(match.group(1))
        early_slugs = {
            1: "longmont-potion-castle",
            2: "longmont-potion-castle-ii",
            3: "longmont-potion-castle-iii",
            4: "longmont-potion-castle-4",
        }
        return early_slugs.get(number, f"longmont-potion-castle-{number}")
    return None


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", _plain_wiki_text(value))
    value = "".join(character for character in value if not unicodedata.combining(character))
    value = value.casefold().replace("&", " and ")
    value = re.sub(r"\b(?:www\.)?", "", value)
    value = re.sub(r"\.(?:com|org|ca)\b", "", value)
    value = re.sub(r"\ba\.?k\.?a\.?.*$", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\bthe\b", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_aliases(source: str) -> dict[str, MetadataRecord]:
    body = _section(source, "Alphabetical aliases", "Alias usage by album")
    records: dict[str, MetadataRecord] = {}
    for line in body.splitlines():
        name = _bold_label(line)
        if not name:
            continue
        albums = {
            slug
            for title in _linked_titles(line)
            if (slug := album_slug_for_wiki_title(title))
        }
        records.setdefault(normalize_name(name), MetadataRecord(name=name)).albums.update(albums)
    return records


def _parse_organization_list(source: str) -> dict[str, MetadataRecord]:
    body = _section(source, "Organizations", "Organizations by album")
    records: dict[str, MetadataRecord] = {}
    kind: str | None = None
    for line in body.splitlines():
        heading = re.match(r"^===\s*(.*?)\s*===\s*$", line)
        if heading:
            label = normalize_name(heading.group(1))
            kind = "real-world" if label == "real world" else "created" if label == "created" else None
            continue
        name = _bold_label(line)
        if not name:
            continue
        albums = {
            slug
            for title in _linked_titles(line)
            if (slug := album_slug_for_wiki_title(title))
        }
        records[normalize_name(name)] = MetadataRecord(name=name, albums=albums, kind=kind)
    return records


def _split_big_list(source: str) -> list[str]:
    body = _section(source, "Just a big list")
    text = " ".join(line.strip() for line in body.splitlines() if line.strip() and not line.startswith("[[Category:"))
    return [item.strip().rstrip(".") for item in text.split(",") if item.strip()]


def _closest_record_key(name: str, records: dict[str, MetadataRecord]) -> str | None:
    key = normalize_name(name)
    if key in records:
        return key
    match = difflib.get_close_matches(key, records.keys(), n=1, cutoff=0.88)
    return match[0] if match else None


def parse_organizations(source: str) -> dict[str, MetadataRecord]:
    records = _parse_organization_list(source)
    for name in _split_big_list(source):
        key = _closest_record_key(name, records)
        if key:
            continue
        cleaned = re.sub(r"\s+a\.?k\.?a\.?.*$", "", name, flags=re.IGNORECASE).strip()
        key = normalize_name(cleaned)
        if key:
            records[key] = MetadataRecord(name=cleaned, kind="unspecified")
    return records


def parse_track_usage(
    source: str,
    section_name: str,
    records: dict[str, MetadataRecord],
) -> dict[tuple[str, str], set[str]]:
    """Parse wiki album/track groupings into {(album, track title): names}."""
    body = _section(source, section_name, "Just a big list")
    usage: dict[tuple[str, str], set[str]] = defaultdict(set)
    album_slug: str | None = None
    track_title: str | None = None

    for line in body.splitlines():
        heading = re.match(r"^===\s*(.*?)\s*===\s*$", line)
        if heading:
            album_slug = album_slug_for_wiki_title(heading.group(1))
            track_title = None
            continue
        numbered = re.match(r'^\s*\d+\.\s*"?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]"?', line)
        if numbered:
            track_title = numbered.group(1).strip()
            continue
        name = _bold_label(line)
        if not (name and album_slug and track_title):
            continue
        record_key = _closest_record_key(name, records)
        if record_key:
            usage[(album_slug, track_title)].add(record_key)
    return usage


def _track_lookup(data: dict) -> tuple[dict[str, dict], dict[str, dict[str, dict]]]:
    albums = {album["Album_Slug"]: album for album in data.get("Albums", [])}
    tracks: dict[str, dict[str, dict]] = {}
    for album_slug, album in albums.items():
        tracks[album_slug] = {
            normalize_name(track.get("Track_Title", "")): track
            for track in album.get("Tracks", [])
        }
    return albums, tracks


def _resolve_track(tracks: dict[str, dict], title: str) -> dict | None:
    key = normalize_name(title)
    if key in tracks:
        return tracks[key]
    matches = difflib.get_close_matches(key, tracks.keys(), n=1, cutoff=0.72)
    return tracks[matches[0]] if matches else None


def _track_text(album_slug: str, track: dict) -> tuple[str, str]:
    entries = wiki.load_track_json(album_slug, track.get("Track_JSONPath", "")) or []
    all_lines: list[str] = []
    lpc_lines: list[str] = []
    for entry in entries:
        text = normalize_name(str(entry.get("Text", "")))
        if not text:
            continue
        all_lines.append(text)
        if str(entry.get("Speaker", "")).casefold() == "lpc":
            lpc_lines.append(text)
    return " ".join(all_lines), " ".join(lpc_lines)


def _contains_phrase(haystack: str, needle: str) -> bool:
    return bool(needle and re.search(rf"(?:^| )({re.escape(needle)})(?: |$)", haystack))


def _alias_matches(record: MetadataRecord, all_text: str, lpc_text: str) -> bool:
    name = normalize_name(record.name)
    words = name.split()
    if len(words) >= 2:
        # A recipient repeating the caller's unusual full name is still strong
        # evidence that the alias belongs to this track.
        return _contains_phrase(all_text, name)
    if not words or len(name) < 3:
        return False
    context = rf"(?:this is|my name is|name is|call me|i am|i m|speaking|it s) (?:\w+ ){{0,2}}{re.escape(name)}(?: |$)"
    return bool(re.search(context, lpc_text or all_text))


def _organization_matches(record: MetadataRecord, track: dict, all_text: str) -> bool:
    name = normalize_name(record.name)
    title = normalize_name(track.get("Track_Title", ""))
    if record.kind == "unspecified" and name in AMBIGUOUS_UNCLASSIFIED_ORGANIZATIONS:
        return _contains_phrase(title, name)
    if _contains_phrase(all_text, name) or name == title:
        return True
    words = [word for word in name.split() if len(word) >= 3]
    if len(words) < 2:
        return False
    combined = f"{title} {all_text}"
    present = sum(_contains_phrase(combined, word) for word in words)
    # This resolves compound descriptions such as "Bart Hacker Coalition"
    # when the title and spoken introduction contain different components.
    return present == len(words) and any(_contains_phrase(title, word) for word in words)


def build_associations(
    data: dict,
    aliases: dict[str, MetadataRecord],
    organizations: dict[str, MetadataRecord],
    alias_usage: dict[tuple[str, str], set[str]],
    organization_usage: dict[tuple[str, str], set[str]],
) -> tuple[dict[tuple[str, str], set[str]], dict[tuple[str, str], set[str]], dict[str, int]]:
    albums, track_indexes = _track_lookup(data)
    alias_matches: dict[tuple[str, str], set[str]] = defaultdict(set)
    organization_matches: dict[tuple[str, str], set[str]] = defaultdict(set)
    stats = defaultdict(int)

    for usage, destination in ((alias_usage, alias_matches), (organization_usage, organization_matches)):
        for (album_slug, title), record_keys in usage.items():
            track = _resolve_track(track_indexes.get(album_slug, {}), title)
            if track:
                destination[(album_slug, track["Track_Slug"])].update(record_keys)
                stats["explicit_associations"] += len(record_keys)
            else:
                stats["unresolved_explicit_tracks"] += 1

    text_cache: dict[tuple[str, str], tuple[str, str]] = {}
    for album_slug, album in albums.items():
        for track in album.get("Tracks", []):
            key = (album_slug, track["Track_Slug"])
            text_cache[key] = _track_text(album_slug, track)

    for record_key, record in aliases.items():
        candidate_albums = record.albums & albums.keys()
        for album_slug in candidate_albums:
            for track in albums[album_slug].get("Tracks", []):
                key = (album_slug, track["Track_Slug"])
                all_text, lpc_text = text_cache[key]
                if _alias_matches(record, all_text, lpc_text):
                    alias_matches[key].add(record_key)

    for record_key, record in organizations.items():
        candidate_albums = record.albums & albums.keys() if record.albums else albums.keys()
        for album_slug in candidate_albums:
            for track in albums[album_slug].get("Tracks", []):
                key = (album_slug, track["Track_Slug"])
                all_text, _ = text_cache[key]
                if _organization_matches(record, track, all_text):
                    organization_matches[key].add(record_key)

    stats["matched_aliases"] = len({item for values in alias_matches.values() for item in values})
    stats["matched_organizations"] = len({item for values in organization_matches.values() for item in values})
    stats["alias_track_associations"] = sum(map(len, alias_matches.values()))
    stats["organization_track_associations"] = sum(map(len, organization_matches.values()))
    return alias_matches, organization_matches, dict(stats)


def _as_string_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _append_unique(values: list[str], additions: list[str]) -> list[str]:
    seen = {normalize_name(value) for value in values}
    for addition in sorted(additions, key=str.casefold):
        key = normalize_name(addition)
        if key and key not in seen:
            values.append(addition)
            seen.add(key)
    return values


def merge_metadata(
    data: dict,
    aliases: dict[str, MetadataRecord],
    organizations: dict[str, MetadataRecord],
    alias_matches: dict[tuple[str, str], set[str]],
    organization_matches: dict[tuple[str, str], set[str]],
) -> dict[str, int]:
    stats = defaultdict(int)
    for album in data.get("Albums", []):
        album_slug = album["Album_Slug"]
        for track in album.get("Tracks", []):
            track_key = (album_slug, track["Track_Slug"])
            previous_import = track.get("Talkin_Whipapedia", {})
            if not isinstance(previous_import, dict):
                previous_import = {}
            previous_aliases = {normalize_name(value) for value in _as_string_list(previous_import.get("Aliases"))}
            previous_establishments = {
                normalize_name(value) for value in _as_string_list(previous_import.get("Establishments"))
            }
            old_aliases = [
                value for value in _as_string_list(track.get("Aliases"))
                if normalize_name(value) not in previous_aliases
            ]
            old_establishments = [
                value for value in _as_string_list(track.get("Establishments"))
                if normalize_name(value) not in previous_establishments
            ]
            new_aliases = [aliases[key].name for key in alias_matches.get(track_key, set())]
            new_establishments = [organizations[key].name for key in organization_matches.get(track_key, set())]

            merged_aliases = _append_unique(old_aliases.copy(), new_aliases)
            merged_establishments = _append_unique(old_establishments.copy(), new_establishments)
            if merged_aliases:
                track["Aliases"] = merged_aliases
            else:
                track.pop("Aliases", None)
            if merged_establishments:
                track["Establishments"] = merged_establishments
                type_map: dict[str, str] = {}
                for establishment in merged_establishments:
                    key = _closest_record_key(establishment, organizations)
                    type_map[establishment] = organizations[key].kind if key else "unspecified"
                track["Establishment_Types"] = type_map
            else:
                track.pop("Establishments", None)
                track.pop("Establishment_Types", None)

            old_alias_keys = {normalize_name(value) for value in old_aliases}
            old_establishment_keys = {normalize_name(value) for value in old_establishments}
            imported_aliases = [
                value for value in merged_aliases if normalize_name(value) not in old_alias_keys
            ]
            imported_establishments = [
                value for value in merged_establishments
                if normalize_name(value) not in old_establishment_keys
            ]
            if imported_aliases or imported_establishments:
                track["Talkin_Whipapedia"] = {
                    "Source": SOURCE_URL,
                    "Aliases": imported_aliases,
                    "Establishments": imported_establishments,
                }
            else:
                track.pop("Talkin_Whipapedia", None)

            stats["aliases_added"] += len(merged_aliases) - len(old_aliases)
            stats["establishments_added"] += len(merged_establishments) - len(old_establishments)
            if len(merged_aliases) > len(old_aliases) or len(merged_establishments) > len(old_establishments):
                stats["tracks_changed"] += 1
    return dict(stats)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--dry-run", action="store_true", help="report changes without writing data.json")
    action.add_argument("--write", action="store_true", help="merge metadata into data.json")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    aliases_page = wiki.fetch_wikitext(ALIASES_PAGE)
    organizations_page = wiki.fetch_wikitext(ORGANIZATIONS_PAGE)
    if not aliases_page or not organizations_page:
        raise wiki.WikiRequestError("required wiki metadata pages were not found")

    aliases = parse_aliases(aliases_page["wikitext"])
    organizations = parse_organizations(organizations_page["wikitext"])
    alias_usage = parse_track_usage(aliases_page["wikitext"], "Alias usage by album", aliases)
    organization_usage = parse_track_usage(
        organizations_page["wikitext"], "Organizations by album", organizations
    )
    data = wiki.load_data_json()
    alias_matches, organization_matches, association_stats = build_associations(
        data, aliases, organizations, alias_usage, organization_usage
    )
    merge_stats = merge_metadata(data, aliases, organizations, alias_matches, organization_matches)

    matched_alias_keys = {key for values in alias_matches.values() for key in values}
    matched_organization_keys = {key for values in organization_matches.values() for key in values}
    report = {
        "wiki_aliases": len(aliases),
        "wiki_organizations": len(organizations),
        **association_stats,
        **merge_stats,
        "unmatched_aliases": len(aliases) - len(matched_alias_keys),
        "unmatched_organizations": len(organizations) - len(matched_organization_keys),
    }
    print(json.dumps(report, indent=2, sort_keys=True))

    if args.write:
        wiki._write_json_atomic(wiki.DATA_JSON, data)
        print(f"Updated {wiki.DATA_JSON.relative_to(wiki.PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
