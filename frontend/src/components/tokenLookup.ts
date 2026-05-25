import type { MorphToken, Token } from "./pageTypes";

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
const DRILLDOWN_LANGUAGES = new Set(["ko", "ja", "tr"]);

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

export function getLookupKeyForMorph(morph: MorphToken, language: string) {
  if (!morph.lemma || !morph.pos || isStopPos(morph.pos, language)) {
    return null;
  }

  return `${morph.lemma}_${morph.pos}`;
}

export function getLookupKey(token: Token, language: string) {
  const morph = getLookupMorph(token, language);

  if (!morph) {
    return null;
  }

  return `${morph.lemma}_${morph.pos}`;
}

export function canDrillDownToken(token: Token, language: string) {
  if (!DRILLDOWN_LANGUAGES.has(language)) {
    return false;
  }

  return getLookupMorph(token, language) !== null;
}
