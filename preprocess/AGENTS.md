# Preprocess Guide

## Purpose

`preprocess` contains scripts that build language-pack data from raw corpus files and write the results into release artifacts.

## Start here

- `{lang}/build_lemmas.py`: builds `lines`, `lemma_stats`, and `lemma_graph`
- `{lang}/build_ngram.py`: builds `ngram_uni`, `ngram_bi`, and `ngram_tri`
- `{lang}/build_prefix_index.py`: builds `prefix_index`
- `sqlite_pack_writer.py`: shared SQLite write helpers and manifest generation

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

- Each language directory usually has three separate builders, but they currently write into the same `language_pack.db`
- Output responsibility is already split by table group: lemma tables, ngram tables, and prefix index
- If you change table names or required outputs here, also verify `backend/language_config/sqlite_pack.py` and install validation logic
