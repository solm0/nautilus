import type { OCRBlock } from "../pageTypes";

export type SyncedLyricLine = {
  timestamp_ms: number;
  text: string;
};

function parseTimestampToMs(raw: string) {
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ?? "0";
  const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));

  return minutes * 60_000 + seconds * 1_000 + milliseconds;
}

export function parseSyncedLyrics(source: string | null | undefined): SyncedLyricLine[] {
  if (!source) return [];

  const lines: SyncedLyricLine[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const matches = Array.from(rawLine.matchAll(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g));
    if (matches.length === 0) continue;

    const text = rawLine.replace(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g, "").trim();
    if (!text) continue;

    for (const match of matches) {
      const timestampMs = parseTimestampToMs(match[1]);
      if (timestampMs == null) continue;

      lines.push({
        timestamp_ms: timestampMs,
        text,
      });
    }
  }

  return lines.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

export function getActiveLyricIndex(lines: SyncedLyricLine[], progressMs: number | null) {
  if (!lines.length || progressMs == null) return -1;

  let activeIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].timestamp_ms <= progressMs) {
      activeIndex = i;
      continue;
    }
    break;
  }

  return activeIndex;
}

export function getActiveTimedBlockIndex(
  blocks: OCRBlock[],
  progressMs: number | null,
) {
  if (progressMs == null) return -1;

  let activeIndex = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const timestampMs = blocks[i].timestamp_ms;
    if (timestampMs == null) continue;

    if (timestampMs <= progressMs) {
      activeIndex = i;
      continue;
    }

    break;
  }

  return activeIndex;
}
