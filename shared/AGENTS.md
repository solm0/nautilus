# Shared Guide

## Purpose

`shared` contains Python service logic intended to be reused or mirrored between local and central server behavior.

## When to read this folder

- The same language-processing bug appears in both `backend` and `central`
- You are deduplicating or comparing service behavior across the two servers
- A server service imports or mirrors logic from here

## Usually do not start here

- If the issue is clearly local-only, begin in `backend`
- If the issue is clearly cloud/mobile-only, begin in `central`

## Start here

- `services/`: lemma, IPA, NLP, prediction, and pattern services

## Notes

- Names mirror service modules under `backend/services` and `central/services`
- Before editing, confirm whether this folder is actually imported by the target app or just kept in sync manually
