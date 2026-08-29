# Preprocess Guide

## Purpose

`preprocess` contains scripts that build language-pack data from raw corpus files and write the results into release artifacts.

## Start here

- `{lang}/build_lemmas.py`: builds `lines` and `lemma_stats`
- `sqlite_pack_writer.py`: shared SQLite write helpers and manifest generation
- `run_all_builds.py`: runs all language builders for a target version with progress logs
- `publish_releases.py`: uploads generated lemma zip assets to Hugging Face

## When to use this folder

- Regenerating a language pack
- Changing which tables a preprocessing step outputs
- Adjusting corpus input files, thresholds, tokenization, or scoring
- Splitting pack artifacts into smaller downloadable units

## Usually do not read first

- `backend` unless you are verifying how the generated tables are consumed at runtime
- `central` or `frontend` unless the task is about pack download or product integration
- `releases` unless you need to inspect generated outputs

## Notes

- Each language directory builds lemma output into `lemma_pack.db`
- Use `python3 preprocess/run_all_builds.py --version 1.1.0 --jobs 2 --caffeinate` for a short one-command full rebuild with parallelism and sleep prevention
- If you change table names or required outputs here, also verify `backend/language_config/sqlite_pack.py` and install validation logic
