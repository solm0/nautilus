import type { Token } from "./pageTypes";

const BASE_STOP_POS = new Set([
  "PUNCT",
  "SYM",
  "SPACE",
  "DET",
  "CCONJ",
  "SCONJ",
  "PART",
  "PRON",
  "ADP",
]);

const LANGUAGE_STOP_POS: Record<string, Set<string>> = {
  ko: new Set([...BASE_STOP_POS, "AUX"]),
};

export function isStopPos(pos: string | null | undefined, language: string) {
  if (!pos) return false;
  return (LANGUAGE_STOP_POS[language] ?? BASE_STOP_POS).has(pos);
}

export function getLookupMorph(token: Token, language: string) {
  if (token.lemma && token.pos && !isStopPos(token.pos, language)) {
    return {
      lemma: token.lemma,
      pos: token.pos,
    };
  }

  for (const morph of token.morphs ?? []) {
    if (!morph.lemma || !morph.pos || isStopPos(morph.pos, language)) {
      continue;
    }

    return {
      lemma: morph.lemma,
      pos: morph.pos,
    };
  }

  return null;
}

export function getLookupKey(token: Token, language: string) {
  const morph = getLookupMorph(token, language);

  if (!morph) {
    return null;
  }

  return `${morph.lemma}_${morph.pos}`;
}

export function canDrillDownToken(token: Token, language: string) {
  return getLookupMorph(token, language) !== null;
}
