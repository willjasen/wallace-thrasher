# Wiki analysis

This folder stores snapshots and review files created while comparing the project's subtitle JSON with the human-curated transcripts on [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/). The workflow is implemented in `python/wiki_scrape_and_merge.py` and uses Python 3.10+ standard-library modules.

## Layout

- `scrapes/<timestamp>/` contains downloaded wiki transcript snapshots.
- `comparisons/<timestamp>/` contains alignment and proposed changes for the matching snapshot.
- `merge-backups/<timestamp>/` contains copies of source files made before an approved merge.
- `legacy-cache/` contains older flat-cache data retained for migration or reference.
- `latest-scrape` records the snapshot used by default when a command does not specify `--snapshot`.

## Workflow

Run `scrape` to create a snapshot, `compare` to align it with the local subtitles, and `report` to review the proposed changes. A `merge` should normally be tested with `--dry-run` first. Text marked `review` is not applied until it is manually checked and changed to `approved`; backups are created before a real merge writes source files.

Wiki transcript data is used as a review and reconciliation source. The repository's current subtitle files remain authoritative until an approved merge is performed.

See the root [README](../../README.md) for complete command examples and the separate metadata-import workflow.
