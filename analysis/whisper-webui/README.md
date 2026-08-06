# Whisper-WebUI analysis

This folder contains local transcription and speaker-diarization work produced through [Whisper-WebUI](https://github.com/jhj0517/Whisper-WebUI). The workflow reads tracks from the LPC USB, sends them to a locally hosted Whisper-WebUI instance, and keeps the results here for manual review before anything is merged into the site.

## Layout

- `batches/` contains batch progress and status files.
- `<album>/<track>/` contains the review bundle for an individual track. A bundle can include the original SRT, normalized segments, candidate subtitles, speaker-mapping suggestions, review leads, comparison output, and merge receipts.
- `merge-backups/` contains timestamped backups made before an approved merge changes repository data.

The directory is intentionally ignored by Git because it can contain large, machine-generated, or locally sensitive analysis artifacts. Selected metadata and review files may be retained when explicitly allowed by the repository's ignore rules.

## Workflow

Run analysis with `python/lpc_whisper_analysis.py`, then inspect the generated bundle. Use `python/whisper_compare_and_merge.py` to compare the result with the current site data and merge only changes that have been reviewed and approved. Whisper output is evidence for curation; it does not update site subtitles automatically.

See the root [README](../../README.md) for configuration, authentication, import-from-SRT, and command examples.
