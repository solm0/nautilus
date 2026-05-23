import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchArticulation, type ArticulationDetail } from "../../api";
import type { Token } from "../pageTypes";
import { AudioWaveform, Pause, Play } from "lucide-react";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const DEFAULT_VISUAL = {
  tongue_height: 0.5,
  tongue_frontness: 0.5,
  lip_closure: 0,
  lip_rounding: 0.1,
  velum: "closed",
  glottis: "neutral",
  constriction: "open",
  airflow: "oral",
};

type SvgPathShape = {
  kind: "path";
  id: string;
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

type SvgEllipseShape = {
  kind: "ellipse";
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  transform?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

type SvgShape = SvgPathShape | SvgEllipseShape;

type SvgAsset = {
  viewBox: string;
  shapes: SvgShape[];
};

type ArticulationAssets = {
  base: SvgAsset;
  jaw: Record<string, SvgAsset>;
  glottis: Record<string, SvgAsset>;
  lips: Record<string, SvgAsset>;
  tongue: Record<string, SvgAsset>;
  velum: Record<string, SvgAsset>;
};

type ParsedPathCommand = {
  command: string;
  values: number[];
};

function parsePathData(path: string): ParsedPathCommand[] {
  const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const commands: ParsedPathCommand[] = [];
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index];
    index += 1;

    if (!/[A-Za-z]/.test(command)) break;

    const values: number[] = [];
    while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
      values.push(Number(tokens[index]));
      index += 1;
    }

    commands.push({ command, values });
  }

  return commands;
}

function stringifyPathData(commands: ParsedPathCommand[]) {
  return commands
    .map(({ command, values }) =>
      values.length === 0
        ? command
        : `${command} ${values.map((value) => Number(value.toFixed(3))).join(" ")}`
    )
    .join(" ");
}

function parseClassStyles(svgText: string) {
  const styleText = svgText.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const ruleRegex = /([^{}]+)\{([^}]+)\}/g;
  const styles: Record<string, Record<string, string>> = {};
  let match: RegExpExecArray | null = null;

  while ((match = ruleRegex.exec(styleText))) {
    const classNames = Array.from(match[1].matchAll(/\.([\w-]+)/g)).map((entry) => entry[1]);
    const body = match[2];
    const declarations = Object.fromEntries(
      body
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [property, ...rest] = part.split(":");
          return [property.trim(), rest.join(":").trim()];
        }),
    );

    for (const className of classNames) {
      styles[className] = {
        ...(styles[className] ?? {}),
        ...declarations,
      };
    }
  }

  return styles;
}

function getShapeStyleValue(
  element: Element,
  classStyles: Record<string, Record<string, string>>,
  property: string,
) {
  const classNames = (element.getAttribute("class") ?? "")
    .split(/\s+/)
    .map((name) => name.trim())
    .filter(Boolean);

  for (const className of classNames) {
    const value = classStyles[className]?.[property];
    if (value) return value;
  }

  return element.getAttribute(property) ?? undefined;
}

function toNumeric(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSvgAsset(svgText: string): SvgAsset {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");
  const svg = document.querySelector("svg");
  const classStyles = parseClassStyles(svgText);
  const shapes: SvgShape[] = [];

  if (!svg) {
    throw new Error("invalid svg asset");
  }

  for (const element of Array.from(svg.children)) {
    if (element.tagName === "defs") continue;

    const fill = getShapeStyleValue(element, classStyles, "fill");
    const stroke = getShapeStyleValue(element, classStyles, "stroke");
    const strokeWidth = toNumeric(getShapeStyleValue(element, classStyles, "stroke-width"));
    const id = element.getAttribute("id") ?? `${element.tagName}-${shapes.length}`;

    if (element.tagName === "path") {
      const d = element.getAttribute("d");
      if (!d) continue;
      shapes.push({
        kind: "path",
        id,
        d,
        fill,
        stroke,
        strokeWidth,
      });
      continue;
    }

    if (element.tagName === "ellipse") {
      const cx = toNumeric(element.getAttribute("cx"));
      const cy = toNumeric(element.getAttribute("cy"));
      const rx = toNumeric(element.getAttribute("rx"));
      const ry = toNumeric(element.getAttribute("ry"));

      if (
        cx == null ||
        cy == null ||
        rx == null ||
        ry == null
      ) {
        continue;
      }

      shapes.push({
        kind: "ellipse",
        id,
        cx,
        cy,
        rx,
        ry,
        transform: element.getAttribute("transform") ?? undefined,
        fill,
        stroke,
        strokeWidth,
      });
    }
  }

  return {
    viewBox: svg.getAttribute("viewBox") ?? "0 0 404.27 496.14",
    shapes,
  };
}

async function fetchSvgAsset(path: string) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`failed to load ${path}`);
  }

  return parseSvgAsset(await response.text());
}

async function loadArticulationAssets(): Promise<ArticulationAssets> {
  const [
    base,
    jawClosed,
    jawMid,
    jawOpen,
    glottisClosed,
    glottisNeutral,
    glottisVoiced,
    glottisVoicelessSpread,
    lipsClosed,
    lipsLabiodental,
    lipsNeutral,
    lipsNeutralMidjaw,
    lipsOpen,
    lipsRoundedMedium,
    lipsRoundedMediumMidjaw,
    lipsRoundedTight,
    lipsRoundedTightMidjaw,
    tongueAlveolarApproximant,
    tongueAlveolarFricative,
    tongueAlveolarStop,
    tongueDental,
    tongueHighBackVowel,
    tongueHighFrontVowel,
    tongueMidCentralVowel,
    tongueOpenVowel,
    tonguePalatal,
    tonguePostalveolar,
    tongueRetroflex,
    tongueUvularPharyngeal,
    tongueVelar,
    velumLowered,
    velumRaised,
  ] = await Promise.all([
    fetchSvgAsset("/articulation/base.svg"),
    fetchSvgAsset("/articulation/jaw/jaw_closed.svg"),
    fetchSvgAsset("/articulation/jaw/jaw_mid.svg"),
    fetchSvgAsset("/articulation/jaw/jaw_open.svg"),
    fetchSvgAsset("/articulation/glottis/glottis_closed.svg"),
    fetchSvgAsset("/articulation/glottis/glottis_neutral.svg"),
    fetchSvgAsset("/articulation/glottis/glottis_voiced.svg"),
    fetchSvgAsset("/articulation/glottis/glottis_voiceless_spread.svg"),
    fetchSvgAsset("/articulation/lips/lips_closed.svg"),
    fetchSvgAsset("/articulation/lips/lips_labiodental.svg"),
    fetchSvgAsset("/articulation/lips/lips_neutral.svg"),
    fetchSvgAsset("/articulation/lips/lips_neutral_midjaw.svg"),
    fetchSvgAsset("/articulation/lips/lips_open.svg"),
    fetchSvgAsset("/articulation/lips/lips_rounded_medium.svg"),
    fetchSvgAsset("/articulation/lips/lips_rounded_medium_midjaw.svg"),
    fetchSvgAsset("/articulation/lips/lips_rounded_tight.svg"),
    fetchSvgAsset("/articulation/lips/lips_rounded_tight_midjaw.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_alveolar_approximant.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_alveolar_fricative.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_alveolar_stop.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_dental.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_high_back_vowel.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_high_front_vowel.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_mid_central_vowel.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_open_vowel.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_palatal.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_postalveolar.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_retroflex.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_uvular_pharyngeal.svg"),
    fetchSvgAsset("/articulation/tongue/tongue_velar.svg"),
    fetchSvgAsset("/articulation/velum/velum_lowered.svg"),
    fetchSvgAsset("/articulation/velum/velum_raised.svg"),
  ]);

  return {
    base,
    jaw: {
      jaw_closed: jawClosed,
      jaw_mid: jawMid,
      jaw_open: jawOpen,
    },
    glottis: {
      glottis_closed: glottisClosed,
      glottis_neutral: glottisNeutral,
      glottis_voiced: glottisVoiced,
      glottis_voiceless_spread: glottisVoicelessSpread,
    },
    lips: {
      lips_closed: lipsClosed,
      lips_labiodental: lipsLabiodental,
      lips_neutral: lipsNeutral,
      lips_neutral_midjaw: lipsNeutralMidjaw,
      lips_open: lipsOpen,
      lips_rounded_medium: lipsRoundedMedium,
      lips_rounded_medium_midjaw: lipsRoundedMediumMidjaw,
      lips_rounded_tight: lipsRoundedTight,
      lips_rounded_tight_midjaw: lipsRoundedTightMidjaw,
    },
    tongue: {
      tongue_alveolar_approximant: tongueAlveolarApproximant,
      tongue_alveolar_fricative: tongueAlveolarFricative,
      tongue_alveolar_stop: tongueAlveolarStop,
      tongue_dental: tongueDental,
      tongue_high_back_vowel: tongueHighBackVowel,
      tongue_high_front_vowel: tongueHighFrontVowel,
      tongue_mid_central_vowel: tongueMidCentralVowel,
      tongue_open_vowel: tongueOpenVowel,
      tongue_palatal: tonguePalatal,
      tongue_postalveolar: tonguePostalveolar,
      tongue_retroflex: tongueRetroflex,
      tongue_uvular_pharyngeal: tongueUvularPharyngeal,
      tongue_velar: tongueVelar,
    },
    velum: {
      velum_lowered: velumLowered,
      velum_raised: velumRaised,
    },
  };
}

function interpolatePathData(fromPath: string, toPath: string, t: number) {
  const fromCommands = parsePathData(fromPath);
  const toCommands = parsePathData(toPath);

  if (
    fromCommands.length !== toCommands.length ||
    fromCommands.some(
      (command, index) =>
        command.command !== toCommands[index].command ||
        command.values.length !== toCommands[index].values.length,
    )
  ) {
    return t < 0.5 ? fromPath : toPath;
  }

  return stringifyPathData(
    fromCommands.map((command, commandIndex) => ({
      command: command.command,
      values: command.values.map((value, valueIndex) =>
        lerp(value, toCommands[commandIndex].values[valueIndex], t),
      ),
    })),
  );
}

function interpolateShape(fromShape: SvgShape, toShape: SvgShape, t: number): SvgShape {
  if (fromShape.kind !== toShape.kind) {
    return t < 0.5 ? fromShape : toShape;
  }

  if (fromShape.kind === "path" && toShape.kind === "path") {
    return {
      ...toShape,
      d: interpolatePathData(fromShape.d, toShape.d, t),
      fill: t < 0.5 ? fromShape.fill : toShape.fill,
      stroke: t < 0.5 ? fromShape.stroke : toShape.stroke,
      strokeWidth: t < 0.5 ? fromShape.strokeWidth : toShape.strokeWidth,
    };
  }

  const fromEllipse = fromShape as SvgEllipseShape;
  const toEllipse = toShape as SvgEllipseShape;

  return {
    ...toEllipse,
    cx: lerp(fromEllipse.cx, toEllipse.cx, t),
    cy: lerp(fromEllipse.cy, toEllipse.cy, t),
    rx: lerp(fromEllipse.rx, toEllipse.rx, t),
    ry: lerp(fromEllipse.ry, toEllipse.ry, t),
    fill: t < 0.5 ? fromEllipse.fill : toEllipse.fill,
    stroke: t < 0.5 ? fromEllipse.stroke : toEllipse.stroke,
    strokeWidth: t < 0.5 ? fromEllipse.strokeWidth : toEllipse.strokeWidth,
    transform: t < 0.5 ? fromEllipse.transform : toEllipse.transform,
  };
}

function interpolateAsset(fromAsset: SvgAsset, toAsset: SvgAsset, t: number): SvgAsset {
  if (fromAsset.shapes.length !== toAsset.shapes.length) {
    return t < 0.5 ? fromAsset : toAsset;
  }

  return {
    viewBox: toAsset.viewBox,
    shapes: fromAsset.shapes.map((shape, index) => interpolateShape(shape, toAsset.shapes[index], t)),
  };
}

function arePathCommandsCompatible(fromPath: string, toPath: string) {
  const fromCommands = parsePathData(fromPath);
  const toCommands = parsePathData(toPath);

  if (fromCommands.length !== toCommands.length) {
    return false;
  }

  return fromCommands.every(
    (command, index) =>
      command.command === toCommands[index].command &&
      command.values.length === toCommands[index].values.length,
  );
}

function areShapesCompatible(fromShape: SvgShape, toShape: SvgShape) {
  if (fromShape.kind !== toShape.kind) {
    return false;
  }

  if (fromShape.kind === "path" && toShape.kind === "path") {
    return arePathCommandsCompatible(fromShape.d, toShape.d);
  }

  return true;
}

function areAssetsCompatible(fromAsset: SvgAsset, toAsset: SvgAsset) {
  if (fromAsset.shapes.length !== toAsset.shapes.length) {
    return false;
  }

  return fromAsset.shapes.every((shape, index) => areShapesCompatible(shape, toAsset.shapes[index]));
}

function interpolateVisual(
  from: typeof DEFAULT_VISUAL,
  to: typeof DEFAULT_VISUAL,
  t: number,
) {
  return {
    tongue_height: lerp(from.tongue_height, to.tongue_height, t),
    tongue_frontness: lerp(from.tongue_frontness, to.tongue_frontness, t),
    lip_closure: lerp(from.lip_closure, to.lip_closure, t),
    lip_rounding: lerp(from.lip_rounding, to.lip_rounding, t),
    velum: t < 0.5 ? from.velum : to.velum,
    glottis: t < 0.5 ? from.glottis : to.glottis,
    constriction: t < 0.5 ? from.constriction : to.constriction,
    airflow: t < 0.5 ? from.airflow : to.airflow,
  };
}

function splitSurfaceAffixes(surface: string) {
  const chars = Array.from(surface);
  let start = 0;
  let end = chars.length - 1;

  while (start < chars.length && !/[\p{L}\p{N}]/u.test(chars[start])) {
    start += 1;
  }

  while (end >= start && !/[\p{L}\p{N}]/u.test(chars[end])) {
    end -= 1;
  }

  return {
    prefix: chars.slice(0, start).join(""),
    core: chars.slice(start, end + 1).join(""),
    suffix: chars.slice(end + 1).join(""),
  };
}

function isMostlyLatin(text: string) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+$/u.test(text);
}

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase().split(/[-_]/)[0];
}

function getChunkPatterns(language: string) {
  const normalized = normalizeLanguage(language);

  if (normalized === "de") {
    return [
      "tsch",
      "sch",
      "dsch",
      "pf",
      "ph",
      "ch",
      "ck",
      "qu",
      "ng",
      "ie",
      "ei",
      "eu",
      "äu",
      "au",
    ];
  }

  if (normalized === "sr") {
    return ["dž", "lj", "nj"];
  }

  if (normalized === "ru" || normalized === "mk") {
    return [];
  }

  return [
    "tions",
    "eigh",
    "ough",
    "augh",
    "tion",
    "sion",
    "ture",
    "dge",
    "igh",
    "tch",
    "ph",
    "sh",
    "ch",
    "th",
    "gh",
    "ng",
    "qu",
    "ck",
    "wr",
    "wh",
    "ee",
    "oo",
    "ea",
    "oa",
    "ou",
    "ow",
    "oi",
    "oy",
    "ai",
    "ay",
    "au",
    "aw",
    "ie",
    "ei",
    "eu",
    "ue",
    "ui",
  ];
}

function chunkSurfaceCore(core: string, language: string) {
  if (!core) return [];

  const lower = core.toLowerCase();
  const chars = Array.from(core);
  const normalized = normalizeLanguage(language);

  if (normalized === "ru" || normalized === "mk") {
    return chars;
  }

  if (!isMostlyLatin(lower)) {
    return chars;
  }

  const patterns = getChunkPatterns(language);

  const out: string[] = [];
  let index = 0;

  while (index < chars.length) {
    const remaining = lower.slice(index);
    const pattern = patterns.find((candidate) => remaining.startsWith(candidate));

    if (pattern) {
      out.push(chars.slice(index, index + pattern.length).join(""));
      index += pattern.length;
      continue;
    }

    const current = chars[index];
    const next = chars[index + 1];

    if (next && current.toLowerCase() === next.toLowerCase()) {
      out.push(current + next);
      index += 2;
      continue;
    }

    out.push(current);
    index += 1;
  }

  return out;
}

function isIpaVowelSymbol(symbol: string) {
  return /[iyɨʉɯuɪʏʊeøɘɵɤoəɛœɜɞɚɝʌɔæɐaɶɑɒ]/u.test(symbol);
}

function isSurfaceVowelChunk(text: string) {
  return /[aeiouyAEIOUY]/.test(text);
}

const IPA_SPELLING_HINTS: Record<string, string[]> = {
  "θ": ["th"],
  "ð": ["th"],
  "ʃ": ["sh", "ch", "ti", "ci"],
  "ʒ": ["si", "s", "g"],
  "ŋ": ["ng", "n"],
  "ɹ": ["r", "wr"],
  "j": ["y", "i"],
  "w": ["w", "u", "oo"],
  "f": ["f", "ph"],
  "k": ["k", "c", "ck", "ch", "q", "qu", "gh"],
  "g": ["g", "gh"],
  "u": ["u", "oo", "ou", "ew", "ue", "ough"],
  "ʊ": ["u", "oo", "ou"],
  "i": ["i", "ee", "ea", "ie", "e"],
  "ɪ": ["i", "y", "e"],
  "ə": ["a", "e", "o", "u", "i"],
  "o": ["o", "oa", "ow", "oe"],
  "ɔ": ["o", "au", "aw"],
  "a": ["a", "ai", "ay"],
  "ɛ": ["e", "ea", "ai"],
};

const IPA_SPELLING_HINTS_BY_LANGUAGE: Record<string, Record<string, string[]>> = {
  de: {
    "ʁ": ["r", "rr"],
    "ɐ": ["r", "er"],
    "x": ["ch"],
    "ç": ["ch"],
    "j": ["j", "y"],
    "v": ["w"],
    "f": ["v"],
    "y": ["ü"],
    "ʏ": ["ü", "u", "y"],
    "ø": ["ö"],
    "œ": ["ö"],
    "ɔ": ["o"],
  },
  en: {
    "tʃ": ["ch", "tch"],
    "dʒ": ["j", "g", "dge"],
  },
  sr: {
    "tɕ": ["ć", "ћ"],
    "dʑ": ["đ", "ђ"],
    "tʃ": ["č", "ч"],
    "ɲ": ["nj"],
    "ʎ": ["lj"],
    "dʒ": ["dž", "џ"],
    "ts": ["c", "ц"],
  },
};

function normalizedIpaBase(segment: string) {
  return Array.from(segment)[0] ?? segment;
}

function getIpaSpellingHints(ipaSegment: string, language: string) {
  const ipaBase = normalizedIpaBase(ipaSegment);
  const baseHints = IPA_SPELLING_HINTS[ipaBase] ?? [];
  const languageHints =
    IPA_SPELLING_HINTS_BY_LANGUAGE[normalizeLanguage(language)]?.[ipaSegment] ??
    IPA_SPELLING_HINTS_BY_LANGUAGE[normalizeLanguage(language)]?.[ipaBase] ??
    [];

  return [...baseHints, ...languageHints];
}

function surfaceGroupCost(surfaceText: string, ipaSegment: string, language: string) {
  const ipaBase = normalizedIpaBase(ipaSegment);
  const hints = getIpaSpellingHints(ipaSegment, language);
  const lower = surfaceText.toLowerCase();
  const surfaceVowel = isSurfaceVowelChunk(surfaceText);
  const ipaVowel = isIpaVowelSymbol(ipaBase);

  let score = Math.abs(surfaceText.length - 1) * 0.9;
  score += surfaceVowel === ipaVowel ? -1.2 : 1.8;

  if (hints.some((hint) => lower === hint || lower.includes(hint))) {
    score -= 1.6;
  }

  if (surfaceText.length > 1 && hints.length === 0) {
    score += 0.35;
  }

  return score;
}

function ipaGroupCost(surfaceText: string, ipaGroup: string[], language: string) {
  const combined = ipaGroup.join("");
  const surfaceVowel = isSurfaceVowelChunk(surfaceText);
  const ipaVowelCount = ipaGroup.filter((item) => isIpaVowelSymbol(normalizedIpaBase(item))).length;
  const ipaMostlyVowel = ipaVowelCount >= Math.max(1, Math.ceil(ipaGroup.length / 2));
  const normalized = normalizeLanguage(language);

  let score = Math.abs(ipaGroup.length - 1) * 0.9;
  score += surfaceVowel === ipaMostlyVowel ? -1 : 1.6;

  if (surfaceText.toLowerCase() === "z" && combined === "ts") {
    score -= 3;
  }

  if (surfaceText.toLowerCase() === "x" && combined === "ks") {
    score -= 3;
  }

  if (normalized === "de" && surfaceText.toLowerCase() === "z" && combined === "ts") {
    score -= 2.5;
  }

  if (normalized === "de" && ["eu", "äu"].includes(surfaceText.toLowerCase()) && combined === "ɔʏ") {
    score -= 2.8;
  }

  if (normalized === "de" && surfaceText.toLowerCase() === "ch" && ["x", "ç"].includes(combined)) {
    score -= 2.4;
  }

  if (normalized === "de" && surfaceText.toLowerCase() === "sch" && combined === "ʃ") {
    score -= 3;
  }

  if (normalized === "sr" && surfaceText.toLowerCase() === "nj" && combined === "ɲ") {
    score -= 3;
  }

  if (normalized === "sr" && surfaceText.toLowerCase() === "lj" && combined === "ʎ") {
    score -= 3;
  }

  score += surfaceGroupCost(surfaceText, combined, language);
  return score;
}

function partitionSurfaceChunksToIpa(surfaceChunks: string[], ipaSegments: string[], language: string) {
  const m = surfaceChunks.length;
  const n = ipaSegments.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const prev = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(-1));
  dp[0][0] = 0;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= Math.min(i, n); j += 1) {
      for (let start = j - 1; start < i; start += 1) {
        const previous = dp[start][j - 1];
        if (!Number.isFinite(previous)) continue;

        const groupText = surfaceChunks.slice(start, i).join("");
        const cost = previous + surfaceGroupCost(groupText, ipaSegments[j - 1], language);

        if (cost < dp[i][j]) {
          dp[i][j] = cost;
          prev[i][j] = start;
        }
      }
    }
  }

  const groups: { start: number; end: number }[] = [];
  let i = m;
  let j = n;

  while (j > 0) {
    const start = prev[i][j];
    groups.unshift({ start, end: i });
    i = start;
    j -= 1;
  }

  return groups;
}

function partitionIpaToSurfaceChunks(surfaceChunks: string[], ipaSegments: string[], language: string) {
  const m = surfaceChunks.length;
  const n = ipaSegments.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const prev = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(-1));
  dp[0][0] = 0;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      for (let start = i - 1; start < j; start += 1) {
        const previous = dp[i - 1][start];
        if (!Number.isFinite(previous)) continue;

        const group = ipaSegments.slice(start, j);
        const cost = previous + ipaGroupCost(surfaceChunks[i - 1], group, language);

        if (cost < dp[i][j]) {
          dp[i][j] = cost;
          prev[i][j] = start;
        }
      }
    }
  }

  const groups: { start: number; end: number }[] = [];
  let i = m;
  let j = n;

  while (i > 0) {
    const start = prev[i][j];
    groups.unshift({ start, end: j });
    j = start;
    i -= 1;
  }

  return groups;
}

type SequenceCell = {
  text: string;
  span: number;
  itemIndices: number[];
  ghost?: boolean;
};

type TokenLayout = {
  tokenIndex: number;
  tokenSurface: string;
  columns: number;
  surfaceCells: SequenceCell[];
  ipaCells: SequenceCell[];
  segmentSurfaceLabels: string[];
};

function buildTokenLayout({
  token,
  tokenIndex,
  tokenItems,
  language,
}: {
  token: Token;
  tokenIndex: number;
  tokenItems: ArticulationDetail[];
  language: string;
}): TokenLayout {
  const prefixSuffix = splitSurfaceAffixes(token.surface);
  const surfaceChunks = chunkSurfaceCore(prefixSuffix.core, language);
  const ipaSegments = tokenItems.map((item) => item.ipa);
  const prefixColumns = prefixSuffix.prefix ? 1 : 0;
  const suffixColumns = prefixSuffix.suffix ? 1 : 0;

  if (ipaSegments.length === 0 || surfaceChunks.length === 0) {
    return {
      tokenIndex,
      tokenSurface: token.surface,
      columns: 1,
      surfaceCells: [{ text: token.surface, span: 1, itemIndices: [] }],
      ipaCells: [{ text: "", span: 1, itemIndices: [], ghost: true }],
      segmentSurfaceLabels: [],
    };
  }

  if (surfaceChunks.length >= ipaSegments.length) {
    const groups = partitionSurfaceChunksToIpa(surfaceChunks, ipaSegments, language);
    const segmentSurfaceLabels = groups.map((group) => surfaceChunks.slice(group.start, group.end).join(""));
    const itemIndexByChunk = surfaceChunks.map((_, chunkIndex) => {
      const groupIndex = groups.findIndex((group) => chunkIndex >= group.start && chunkIndex < group.end);
      return tokenItems[groupIndex]?.segment_index ?? groupIndex;
    });

    return {
      tokenIndex,
      tokenSurface: token.surface,
      columns: prefixColumns + surfaceChunks.length + suffixColumns,
      surfaceCells: [
        ...(prefixSuffix.prefix ? [{ text: prefixSuffix.prefix, span: 1, itemIndices: [] }] : []),
        ...surfaceChunks.map((chunk, index) => ({
          text: chunk,
          span: 1,
          itemIndices: [itemIndexByChunk[index]],
        })),
        ...(prefixSuffix.suffix ? [{ text: prefixSuffix.suffix, span: 1, itemIndices: [] }] : []),
      ],
      ipaCells: [
        ...(prefixSuffix.prefix ? [{ text: "", span: 1, itemIndices: [], ghost: true }] : []),
        ...ipaSegments.map((segment, index) => ({
          text: segment,
          span: groups[index].end - groups[index].start,
          itemIndices: [tokenItems[index].segment_index],
        })),
        ...(prefixSuffix.suffix ? [{ text: "", span: 1, itemIndices: [], ghost: true }] : []),
      ],
      segmentSurfaceLabels,
    };
  }

  const groups = partitionIpaToSurfaceChunks(surfaceChunks, ipaSegments, language);
  const segmentSurfaceLabels = ipaSegments.map((_, ipaIndex) => {
    const groupIndex = groups.findIndex((group) => ipaIndex >= group.start && ipaIndex < group.end);
    return surfaceChunks[groupIndex] ?? token.surface;
  });

  return {
    tokenIndex,
    tokenSurface: token.surface,
    columns: prefixColumns + ipaSegments.length + suffixColumns,
    surfaceCells: [
      ...(prefixSuffix.prefix ? [{ text: prefixSuffix.prefix, span: 1, itemIndices: [] }] : []),
      ...surfaceChunks.map((chunk, index) => ({
        text: chunk,
        span: groups[index].end - groups[index].start,
        itemIndices: tokenItems
          .slice(groups[index].start, groups[index].end)
          .map((item) => item.segment_index),
      })),
      ...(prefixSuffix.suffix ? [{ text: prefixSuffix.suffix, span: 1, itemIndices: [] }] : []),
    ],
    ipaCells: [
      ...(prefixSuffix.prefix ? [{ text: "", span: 1, itemIndices: [], ghost: true }] : []),
      ...ipaSegments.map((segment, index) => ({
        text: segment,
        span: 1,
        itemIndices: [tokenItems[index].segment_index],
      })),
      ...(prefixSuffix.suffix ? [{ text: "", span: 1, itemIndices: [], ghost: true }] : []),
    ],
    segmentSurfaceLabels,
  };
}

function AirParticles({
  paths,
  color,
  active,
  count = 16,
  dur = 1.15,
}: {
  paths: string[];
  color: string;
  active: boolean;
  count?: number;
  dur?: number;
}) {
  if (!active) return null;

  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const path = paths[index % paths.length];
        const begin = index * 0.06;
        const radius = 1.05 + (index % 4) * 0.38;
        const duration = dur + (index % 5) * 0.09;

        return (
          <circle key={`${path}-${index}`} r={radius} fill={color} opacity={0.88}>
            <animateMotion
              dur={`${duration}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
              path={path}
            />
            <animateTransform
              attributeName="transform"
              additive="sum"
              type="translate"
              values={`0 0; ${index % 2 === 0 ? 2.6 : -2.1} ${index % 3 === 0 ? -1.9 : 1.8}; 0 0`}
              dur={`${0.28 + (index % 4) * 0.07}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;1;0.92;0"
              dur={`${duration}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${radius};${radius * 1.35};${radius * 0.85}`}
              dur={`${duration}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </>
  );
}

type OrganPoseSelection = {
  jaw: keyof ArticulationAssets["jaw"];
  glottis: keyof ArticulationAssets["glottis"];
  lips: keyof ArticulationAssets["lips"];
  tongue: keyof ArticulationAssets["tongue"];
  velum: keyof ArticulationAssets["velum"];
};

function selectOrganPoses(feature: ArticulationDetail["feature"] | null): OrganPoseSelection {
  if (!feature) {
    return {
      jaw: "jaw_mid",
      glottis: "glottis_neutral",
      lips: "lips_neutral",
      tongue: "tongue_mid_central_vowel",
      velum: "velum_raised",
    };
  }

  if (feature.kind === "vowel") {
    const jaw =
      feature.height === "open" || feature.height === "near-open"
        ? "jaw_open"
        : feature.height === "close" || feature.height === "near-close"
          ? "jaw_closed"
          : "jaw_mid";
    let lips: keyof ArticulationAssets["lips"] =
      feature.height === "open" || feature.height === "near-open"
        ? "lips_open"
        : feature.rounded
          ? feature.backness === "back" || feature.height === "close"
            ? "lips_rounded_tight"
            : "lips_rounded_medium"
          : "lips_neutral";

    if (jaw === "jaw_mid") {
      if (lips === "lips_neutral") lips = "lips_neutral_midjaw";
      if (lips === "lips_rounded_medium") lips = "lips_rounded_medium_midjaw";
      if (lips === "lips_rounded_tight") lips = "lips_rounded_tight_midjaw";
    }
    const tongue =
      feature.height === "open" || feature.height === "near-open"
        ? "tongue_open_vowel"
        : feature.height === "close" || feature.height === "near-close"
          ? feature.backness === "back"
            ? "tongue_high_back_vowel"
            : "tongue_high_front_vowel"
          : "tongue_mid_central_vowel";

    return {
      jaw,
      glottis: "glottis_voiced",
      lips,
      tongue,
      velum: "velum_raised",
    };
  }

  const place = feature.place ?? "";
  const manner = feature.manner ?? "";

  let tongue: keyof ArticulationAssets["tongue"] = "tongue_mid_central_vowel";
  if (place === "dental") {
    tongue = "tongue_dental";
  } else if (place === "alveolar") {
    if (["fricative", "lateral_fricative"].includes(manner)) {
      tongue = "tongue_alveolar_fricative";
    } else if (["approximant", "lateral_approximant", "tap", "trill"].includes(manner)) {
      tongue = "tongue_alveolar_approximant";
    } else {
      tongue = "tongue_alveolar_stop";
    }
  } else if (place === "postalveolar") {
    tongue = "tongue_postalveolar";
  } else if (place === "retroflex") {
    tongue = "tongue_retroflex";
  } else if (place === "palatal" || place === "labial-palatal") {
    tongue = "tongue_palatal";
  } else if (place === "velar" || place === "labial-velar") {
    tongue = "tongue_velar";
  } else if (["uvular", "pharyngeal", "glottal"].includes(place)) {
    tongue = "tongue_uvular_pharyngeal";
  }

  if (feature.secondary_articulations.includes("palatalized")) {
    tongue = "tongue_palatal";
  }
  if (feature.secondary_articulations.includes("velarized")) {
    tongue = "tongue_velar";
  }
  if (feature.secondary_articulations.includes("pharyngealized")) {
    tongue = "tongue_uvular_pharyngeal";
  }

  const jaw: keyof ArticulationAssets["jaw"] =
    place === "bilabial" || place === "labiodental" || place === "dental"
      ? "jaw_closed"
      : ["uvular", "pharyngeal"].includes(place)
        ? "jaw_open"
        : "jaw_mid";

  let lips: keyof ArticulationAssets["lips"] =
    place === "bilabial"
      ? "lips_closed"
      : place === "labiodental"
        ? "lips_labiodental"
        : feature.visual.lip_rounding >= 0.72
          ? "lips_rounded_tight"
          : feature.visual.lip_rounding >= 0.32
            ? "lips_rounded_medium"
            : "lips_neutral";

  if (jaw === "jaw_mid") {
    if (lips === "lips_neutral") lips = "lips_neutral_midjaw";
    if (lips === "lips_rounded_medium") lips = "lips_rounded_medium_midjaw";
    if (lips === "lips_rounded_tight") lips = "lips_rounded_tight_midjaw";
  }

  const glottis: keyof ArticulationAssets["glottis"] =
    place === "glottal" && manner === "plosive"
      ? "glottis_closed"
      : feature.visual.glottis === "voiced"
        ? "glottis_voiced"
        : feature.visual.glottis === "spread"
          ? "glottis_voiceless_spread"
          : "glottis_neutral";

  return {
    jaw,
    glottis,
    lips,
    tongue,
    velum: feature.visual.velum === "open" ? "velum_lowered" : "velum_raised",
  };
}

function renderShape(shape: SvgShape, key: string) {
  if (shape.kind === "path") {
    return (
      <path
        key={key}
        d={shape.d}
        fill={shape.fill ?? "none"}
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        strokeMiterlimit={10}
      />
    );
  }

  return (
    <ellipse
      key={key}
      cx={shape.cx}
      cy={shape.cy}
      rx={shape.rx}
      ry={shape.ry}
      transform={shape.transform}
      fill={shape.fill ?? "none"}
      stroke={shape.stroke}
      strokeWidth={shape.strokeWidth}
      strokeMiterlimit={10}
    />
  );
}

function renderAssetShapes(asset: SvgAsset, prefix: string) {
  return asset.shapes.map((shape, index) => renderShape(shape, `${prefix}-${index}`));
}

function renderAnimatedAsset(
  layerName: string,
  fromAsset: SvgAsset,
  toAsset: SvgAsset,
  progress: number,
) {
  if (areAssetsCompatible(fromAsset, toAsset)) {
    return (
      <g key={`${layerName}-morph`}>
        {renderAssetShapes(interpolateAsset(fromAsset, toAsset, progress), layerName)}
      </g>
    );
  }

  return (
    <g key={`${layerName}-fallback`}>
      {renderAssetShapes(progress < 0.5 ? fromAsset : toAsset, layerName)}
    </g>
  );
}

function getViewBoxSize(viewBox: string) {
  const [, , width = "404.27", height = "496.14"] = viewBox.split(/[\s,]+/);
  return {
    width: Number(width) || 404.27,
    height: Number(height) || 496.14,
  };
}

function ArticulationDiagram({
  assets,
  item,
  morphSourceFeature,
  morphProgress,
  visual,
  animated,
}: {
  assets: ArticulationAssets;
  item: ArticulationDetail | null;
  morphSourceFeature: ArticulationDetail["feature"] | null;
  morphProgress: number;
  visual: typeof DEFAULT_VISUAL;
  animated: boolean;
}) {
  const oralAirPaths = [
    "M 262 422 C 258 390 250 352 240 314 C 232 274 198 238 126 244 C 88 248 58 258 32 268",
    "M 262 422 C 264 388 258 346 246 304 C 238 268 208 236 136 240 C 92 242 60 252 26 264",
    "M 262 422 C 270 388 268 344 258 300 C 250 264 216 232 146 234 C 102 236 66 246 30 258",
  ];
  const nasalAirPaths = [
    "M 262 422 C 266 354 274 286 290 224 C 300 184 282 150 226 132 C 162 112 94 114 28 132",
    "M 262 422 C 260 356 264 290 276 228 C 284 186 262 154 206 136 C 144 118 82 120 20 140",
  ];
  const itemFeature = item?.feature ?? null;
  const sourcePoses = selectOrganPoses(morphSourceFeature);
  const targetPoses = selectOrganPoses(itemFeature);
  const showAirflowPreview = animated || Boolean(itemFeature);
  const showOralAirflow = showAirflowPreview && (visual.airflow === "oral" || visual.airflow === "oral_frication");
  const showNasalAirflow = showAirflowPreview && visual.airflow === "nasal";
  const voicedGlottis =
    sourcePoses.glottis === "glottis_voiced" ||
    targetPoses.glottis === "glottis_voiced" ||
    itemFeature?.kind === "vowel" ||
    Boolean(itemFeature?.voiced);
  const { width: viewBoxWidth, height: viewBoxHeight } = getViewBoxSize(assets.base.viewBox);
  const glottisVibrationX = Number((viewBoxWidth * 0.0022).toFixed(3));
  const glottisVibrationY = Number((viewBoxHeight * 0.0012).toFixed(3));

  return (
    <div className="min-h-0 overflow-hidden relative w-full px-3 max-h-1/2">
      <svg
        viewBox={assets.base.viewBox}
        className="w-full h-full object-contain border border-neutral-300 rounded-sm"
        aria-label={item?.ipa ?? "articulation"}
      >
        {renderAssetShapes(assets.base, "base")}
        {renderAnimatedAsset("jaw", assets.jaw[sourcePoses.jaw], assets.jaw[targetPoses.jaw], morphProgress)}
        <g>
          {voicedGlottis && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0 0; ${glottisVibrationX} ${-glottisVibrationY}; ${-glottisVibrationX} ${glottisVibrationY}; 0 0`}
              dur="0.09s"
              repeatCount="indefinite"
            />
          )}
          {renderAnimatedAsset("glottis", assets.glottis[sourcePoses.glottis], assets.glottis[targetPoses.glottis], morphProgress)}
        </g>
        {renderAnimatedAsset("lips", assets.lips[sourcePoses.lips], assets.lips[targetPoses.lips], morphProgress)}
        {renderAnimatedAsset("tongue", assets.tongue[sourcePoses.tongue], assets.tongue[targetPoses.tongue], morphProgress)}
        {renderAnimatedAsset("velum", assets.velum[sourcePoses.velum], assets.velum[targetPoses.velum], morphProgress)}

        {showOralAirflow && (
          <path d={oralAirPaths[1]} fill="none" stroke="#93c5fd" strokeWidth="11" opacity={0.3} />
        )}
        {showNasalAirflow && (
          <path d={nasalAirPaths[0]} fill="none" stroke="#5eead4" strokeWidth="11" opacity="0.3" />
        )}

        <AirParticles
          paths={oralAirPaths}
          color={visual.airflow === "nasal" ? "#0891b2" : "#2563eb"}
          active={showOralAirflow}
          count={visual.airflow === "oral_frication" ? 40 : 26}
          dur={visual.airflow === "oral_frication" ? 0.72 : 0.98}
        />
        <AirParticles
          paths={nasalAirPaths}
          color="#0f766e"
          active={showNasalAirflow}
          count={18}
          dur={0.86}
        />
      </svg>
      {item && itemFeature && (
        <div className="absolute bottom-2 left-5 w-1/2 flex flex-col items-start text-sm">
          <div className="flex-1 font-semibold">{itemFeature.place ?? itemFeature.backness ?? ""} {itemFeature.manner ?? itemFeature.height ?? ""}</div>
          <div className="flex-1 flex gap-2">
            {itemFeature.kind === "vowel" || Boolean(itemFeature.voiced)
              ? <div className="flex gap-1 items-center text-red-800">voiced<AudioWaveform size={14} /></div>
              : <div className="flex gap-1 items-center">voiceless</div>
            }
            <span className="text-blue-400">{itemFeature.secondary_articulations?.join(", ") || ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArticulationPanel({
  language,
  tokens,
}: {
  language: string;
  tokens: Token[];
}) {
  const [items, setItems] = useState<ArticulationDetail[]>([]);
  const [assets, setAssets] = useState<ArticulationAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [animatedVisual, setAnimatedVisual] = useState(DEFAULT_VISUAL);
  const [morphProgress, setMorphProgress] = useState(1);
  const [morphSourceFeature, setMorphSourceFeature] = useState<ArticulationDetail["feature"] | null>(null);
  const previousFeatureRef = useRef<ArticulationDetail["feature"] | null>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const [highlightRect, setHighlightRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setAssetsLoading(true);
      setAssetsError(null);

      try {
        const loaded = await loadArticulationAssets();
        if (cancelled) return;
        setAssets(loaded);
      } catch {
        if (cancelled) return;
        setAssetsError("Articulation SVG assets could not be loaded.");
      } finally {
        if (!cancelled) {
          setAssetsLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchArticulation(tokens, language);

        if (cancelled) return;

        setItems(data.items);
        setActiveIndex(0);
      } catch {
        if (cancelled) return;
        setError("Articulation data could not be loaded.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [language, tokens]);

  useEffect(() => {
    if (!playing || items.length === 0) return;

    const stepDuration = 650 / playbackSpeed;

    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => {
        if (prev >= items.length - 1) {
          return 0;
        }

        return prev + 1;
      });
    }, stepDuration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, items.length, playbackSpeed, playing]);

  const activeItem = items[activeIndex] ?? null;
  const targetVisual = activeItem?.feature?.visual ?? DEFAULT_VISUAL;

  useEffect(() => {
    const nextFeature = activeItem?.feature ?? null;
    setMorphSourceFeature(previousFeatureRef.current ?? nextFeature);
    previousFeatureRef.current = nextFeature;
    setMorphProgress(0);

    const startVisual = animatedVisual;
    const endVisual = targetVisual;
    const start = performance.now();
    const transitionDuration = 220 / playbackSpeed;
    let frame = 0;

    function tick(now: number) {
      const raw = clamp((now - start) / transitionDuration, 0, 1);
      const eased = raw * raw * (3 - 2 * raw);
      setAnimatedVisual(interpolateVisual(startVisual, endVisual, eased));
      setMorphProgress(eased);

      if (raw < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeItem, playbackSpeed, targetVisual]);

  const focusSegment = (tokenIndex: number, segmentIndex: number) => {
    const nextIndex = items.findIndex(
      (item) =>
        item.token_index === tokenIndex &&
        item.segment_index === segmentIndex,
    );

    if (nextIndex < 0) return;
    setPlaying(false);
    setActiveIndex(nextIndex);
  };

  const tokenLayouts = useMemo(() => {
    return tokens.map((token, tokenIndex) => {
      const tokenItems = items.filter((item) => item.token_index === tokenIndex);
      return buildTokenLayout({
        token,
        tokenIndex,
        tokenItems,
        language,
      });
    });
  }, [items, language, tokens]);

  useLayoutEffect(() => {
    if (!activeItem || !sequenceRef.current) {
      setHighlightRect(null);
      return;
    }

    const nodes = Array.from(
      sequenceRef.current.querySelectorAll<HTMLElement>(
        `[data-token-index="${activeItem.token_index}"][data-segment-ids]`,
      ),
    ).filter((node) => {
      const ids = (node.dataset.segmentIds ?? "")
        .split(",")
        .filter((value) => value.trim().length > 0)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      return ids.includes(activeItem.segment_index);
    });

    if (nodes.length === 0) {
      setHighlightRect(null);
      return;
    }

    const containerRect = sequenceRef.current.getBoundingClientRect();
    const { scrollLeft, scrollTop } = sequenceRef.current;
    const rects = nodes.map((node) => node.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left)) - containerRect.left + scrollLeft;
    const right = Math.max(...rects.map((rect) => rect.right)) - containerRect.left + scrollLeft;
    const top = Math.min(...rects.map((rect) => rect.top)) - containerRect.top + scrollTop;
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) - containerRect.top + scrollTop;

    setHighlightRect({
      left,
      top,
      width: right - left,
      height: bottom - top,
    });
  }, [activeItem, tokenLayouts]);

  if (error || assetsError) {
    return <div className="p-5 text-sm text-red-600">{error ?? assetsError}</div>;
  }

  if (loading || assetsLoading || !assets) {
    return <div className="p-5 text-sm text-neutral-500">Loading articulation...</div>;
  }

  return (
    <div className="flex w-full h-full flex-col overflow-hidden">
      <div ref={sequenceRef} className="relative flex flex-wrap items-start content-start justify-start gap-y-5 gap-x-3 leading-none text-neutral-900 overflow-y-scroll py-3 px-3 min-h-1/2">
        {highlightRect && (
          <div
            className="pointer-events-none absolute rounded-sm bg-neutral-200/90 transition-all duration-200 "
            style={{
              left: highlightRect.left,
              top: highlightRect.top,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
          />
        )}
        {tokenLayouts.map((layout) => {
          return (
            <div key={`${layout.tokenIndex}-${layout.tokenSurface}`} className="relative z-10 flex items-start">
              <table className="table-fixed border-separate border-spacing-0">
                <tbody>
                  <tr>
                    {layout.surfaceCells.map((cell, cellIndex) => {
                      const active = cell.itemIndices.includes(activeItem?.segment_index ?? -1)
                        && layout.tokenIndex === activeItem?.token_index;

                      return (
                        <td
                          key={`surface-${layout.tokenIndex}-${cellIndex}-${cell.text}`}
                          colSpan={cell.span}
                          data-token-index={layout.tokenIndex}
                          data-segment-ids={cell.itemIndices.join(",")}
                          className={`px-[1px] pb-1 align-bottom text-center font-source ${
                            cell.itemIndices.length > 0 ? "cursor-pointer" : ""
                          }`}
                          onClick={() => {
                            if (cell.itemIndices.length === 0) return;
                            focusSegment(layout.tokenIndex, cell.itemIndices[0]);
                          }}
                        >
                          <span className={`inline-block px-[1px] text-base ${active ? "text-neutral-950 font-medium" : ""}`}>
                            {cell.text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    {layout.ipaCells.map((cell, cellIndex) => {
                      const active = cell.itemIndices.includes(activeItem?.segment_index ?? -1)
                        && layout.tokenIndex === activeItem?.token_index;

                      return (
                        <td
                          key={`ipa-${layout.tokenIndex}-${cellIndex}-${cell.text}`}
                          colSpan={cell.span}
                          data-token-index={layout.tokenIndex}
                          data-segment-ids={cell.itemIndices.join(",")}
                          className={`px-[1px] pt-0 align-top text-center font-source text-neutral-500 ${
                            cell.itemIndices.length > 0 ? "cursor-pointer" : ""
                          }`}
                          onClick={() => {
                            if (cell.itemIndices.length === 0) return;
                            focusSegment(layout.tokenIndex, cell.itemIndices[0]);
                          }}
                        >
                          {!cell.ghost && (
                            <span className={`inline-block rounded-sm px-[1px] text-xl ${active ? "text-neutral-900" : ""}`}>
                              {cell.text}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>


      <ArticulationDiagram
        assets={assets}
        item={activeItem}
        morphSourceFeature={morphSourceFeature}
        morphProgress={morphProgress}
        visual={animatedVisual}
        animated={playing}
      />

      <div className="flex w-full pt-3 px-3 gap-2 items-start">
        <div className="flex flex-col grow">
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            className="h-6 w-full appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-runnable-track]:h-3
              [&::-webkit-slider-runnable-track]:rounded-sm
              [&::-webkit-slider-runnable-track]:bg-neutral-300
              [&::-webkit-slider-thumb]:-mt-1
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-sm
              [&::-webkit-slider-thumb]:bg-neutral-800
              [&::-moz-range-track]:h-2
              [&::-moz-range-track]:rounded-sm
              [&::-moz-range-track]:bg-neutral-300
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:rounded-sm
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:bg-neutral-800"
          />
          <span className="text-xs opacity-50 ml-auto pb-2">{playbackSpeed.toFixed(1)}x</span>
        </div>

        <button
          onClick={() => {
            setPlaying((prev) => !prev);
          }}
          disabled={items.length === 0}
          className="px-1 py-0.5 hover:opacity-50 transition-opacity"
        >
          {playing ? <Pause size={19} fill="currentColor" stroke="none"/> : <Play size={19} fill="currentColor" stroke="none"/>}
        </button>
      </div>

    </div>
  );
}
