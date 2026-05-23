import type { OCRBlock, OCRResponse, Token } from "./pageTypes";

export type SelectionRange = {
  start: number;
  end: number;
};

export type TokenEntry = {
  token: Token;
  blockIndex: number;
  tokenIndex: number;
  globalIndex: number;
};

export function normalizeRange(range: SelectionRange): SelectionRange {
  return {
    start: Math.min(range.start, range.end),
    end: Math.max(range.start, range.end),
  };
}

export function mergeOverlappingRanges(ranges: SelectionRange[]): SelectionRange[] {
  if (ranges.length === 0) return [];

  const sorted = ranges
    .map(normalizeRange)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: SelectionRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

export function isRangeCoveredBySelections(
  ranges: SelectionRange[],
  target: SelectionRange
): boolean {
  const normalizedTarget = normalizeRange(target);
  let cursor = normalizedTarget.start;

  for (const range of mergeOverlappingRanges(ranges)) {
    if (range.end < cursor) continue;
    if (range.start > cursor) return false;

    cursor = Math.max(cursor, range.end + 1);
    if (cursor > normalizedTarget.end) return true;
  }

  return cursor > normalizedTarget.end;
}

export function subtractRange(
  ranges: SelectionRange[],
  target: SelectionRange
): SelectionRange[] {
  const normalizedTarget = normalizeRange(target);
  const nextRanges: SelectionRange[] = [];

  for (const range of mergeOverlappingRanges(ranges)) {
    if (range.end < normalizedTarget.start || range.start > normalizedTarget.end) {
      nextRanges.push(range);
      continue;
    }

    if (range.start < normalizedTarget.start) {
      nextRanges.push({
        start: range.start,
        end: normalizedTarget.start - 1,
      });
    }

    if (range.end > normalizedTarget.end) {
      nextRanges.push({
        start: normalizedTarget.end + 1,
        end: range.end,
      });
    }
  }

  return nextRanges;
}

export function updateSelectionRanges(
  ranges: SelectionRange[],
  target: SelectionRange
): SelectionRange[] {
  const normalizedTarget = normalizeRange(target);

  if (isRangeCoveredBySelections(ranges, normalizedTarget)) {
    return subtractRange(ranges, normalizedTarget);
  }

  return mergeOverlappingRanges([...ranges, normalizedTarget]);
}

export function flattenTokenEntries(blocks: OCRBlock[]): TokenEntry[] {
  const entries: TokenEntry[] = [];
  let globalIndex = 0;

  blocks.forEach((block, blockIndex) => {
    block.tokens?.forEach((token, tokenIndex) => {
      entries.push({
        token,
        blockIndex,
        tokenIndex,
        globalIndex,
      });
      globalIndex += 1;
    });
  });

  return entries;
}

function isSentenceBoundaryToken(token: Token) {
  return /[.!?。！？]+$/.test(token.surface.trim());
}

export type SentenceSelection = {
  sentenceTokens: Token[];
  sentenceStart: number;
  sentenceEnd: number;
  selectionStartInSentence: number;
  selectionEndInSentence: number;
};

export function getSentenceSelectionForRange(
  blocks: OCRBlock[],
  range: SelectionRange,
): SentenceSelection | null {
  const normalizedRange = normalizeRange(range);
  const entries = flattenTokenEntries(blocks);

  if (entries.length === 0 || normalizedRange.start >= entries.length) {
    return null;
  }

  let sentenceStart = normalizedRange.start;
  while (sentenceStart > 0 && !isSentenceBoundaryToken(entries[sentenceStart - 1].token)) {
    sentenceStart -= 1;
  }

  let sentenceEnd = normalizedRange.start;
  while (sentenceEnd < entries.length - 1 && !isSentenceBoundaryToken(entries[sentenceEnd].token)) {
    sentenceEnd += 1;
  }

  const clippedEnd = Math.min(normalizedRange.end, sentenceEnd);
  const sentenceEntries = entries.slice(sentenceStart, sentenceEnd + 1);

  return {
    sentenceTokens: sentenceEntries.map((entry) => entry.token),
    sentenceStart,
    sentenceEnd,
    selectionStartInSentence: normalizedRange.start - sentenceStart,
    selectionEndInSentence: clippedEnd - sentenceStart,
  };
}

export function getTokensForRange(blocks: OCRBlock[], range: SelectionRange): Token[] {
  const normalizedRange = normalizeRange(range);
  const tokens: Token[] = [];
  let globalIndex = 0;

  for (const block of blocks) {
    if (!block.tokens) continue;

    for (const token of block.tokens) {
      if (globalIndex >= normalizedRange.start && globalIndex <= normalizedRange.end) {
        tokens.push(token);
      }

      globalIndex += 1;
    }
  }

  return tokens;
}

export function getNearestTokenIndex(x: number, y: number): number | null {
  const element = document.elementFromPoint(x, y);
  const tokenElement = element?.closest("[data-idx]") as HTMLElement | null;

  if (!tokenElement) return null;

  return Number(tokenElement.dataset.idx);
}

export function getTokenRect(
  container: HTMLDivElement | null,
  index: number
): DOMRect | null {
  if (!container) return null;

  const element = container.querySelector(`[data-idx="${index}"]`) as HTMLElement | null;

  return element?.getBoundingClientRect() ?? null;
}

export function getTextForRange(blocks: OCRBlock[], range: SelectionRange): string {
  const normalizedRange = normalizeRange(range);
  const surfaces: string[] = [];
  let globalIndex = 0;

  for (const block of blocks) {
    if (!block.tokens) continue;

    for (const token of block.tokens) {
      if (globalIndex >= normalizedRange.start && globalIndex <= normalizedRange.end) {
        surfaces.push(token.surface);
      }

      globalIndex += 1;
    }
  }

  return surfaces.join(" ");
}

export function isIndexInRanges(index: number, ranges: SelectionRange[]): boolean {
  return ranges.some((range) => index >= range.start && index <= range.end);
}

export function filterOCRResponseByRanges(
  result: OCRResponse,
  ranges: SelectionRange[]
): OCRResponse {
  const mergedRanges = mergeOverlappingRanges(ranges);

  if (mergedRanges.length === 0) {
    return result;
  }

  let globalIndex = 0;
  const filteredBlocks: OCRBlock[] = [];

  for (const block of result.blocks) {
    if (!block.tokens) continue;

    const filteredTokens = block.tokens.filter(() => {
      const keep = isIndexInRanges(globalIndex, mergedRanges);
      globalIndex += 1;
      return keep;
    });

    if (filteredTokens.length === 0) {
      continue;
    }

    filteredBlocks.push({
      ...block,
      text: filteredTokens.map((token) => token.surface).join(" "),
      tokens: filteredTokens,
    });
  }

  return {
    text: filteredBlocks.map((block) => block.text).join("\n"),
    blocks: filteredBlocks,
  };
}
