import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getInstalled, lemmaLookupOne, searchPattern } from "../../api";
import type { PatternSearchResponse, Token } from "../pageTypes";
import { LANG_MAP } from "../setting/PackTable";
import { isCapacitorApp } from "../../platform";
import { TokenInLemmaExpansion } from "../lemma_expansions/TokenInLemmaExpansion";
import type { SidePanelState } from "./PageView";
import { Fingerprint, Languages } from "lucide-react";
import { getLookupMorph } from "../tokenLookup";

type PatternSketch = NonNullable<PatternSearchResponse["query"]>["sketch"];

function getPosTint(pos: string | null | undefined) {
  switch (pos) {
    case "VERB":
    case "AUX":
      return {
        fine: "bg-sky-200 text-sky-950",
        coarse: "bg-sky-100 text-sky-900",
      };
    case "NOUN":
    case "PROPN":
    case "PRON":
      return {
        fine: "bg-emerald-200 text-emerald-950",
        coarse: "bg-emerald-100 text-emerald-900",
      };
    case "ADJ":
    case "ADV":
      return {
        fine: "bg-amber-200 text-amber-950",
        coarse: "bg-amber-100 text-amber-900",
      };
    case "CCONJ":
    case "SCONJ":
    case "PART":
      return {
        fine: "bg-fuchsia-200 text-fuchsia-950",
        coarse: "bg-fuchsia-100 text-fuchsia-900",
      };
    case "ADP":
    case "DET":
      return {
        fine: "bg-violet-200 text-violet-950",
        coarse: "bg-violet-100 text-violet-900",
      };
    case "PUNCT":
      return {
        fine: "bg-neutral-200 text-neutral-700",
        coarse: "bg-neutral-100 text-neutral-500",
      };
    default:
      return {
        fine: "bg-rose-200 text-rose-950",
        coarse: "bg-rose-100 text-rose-900",
      };
  }
}

function getMatchLevel(
  index: number,
  matchStart: number,
  matchEnd: number,
  querySketch: PatternSketch,
  matchSketch: {
    fine: string[];
    pos: string[];
    coarse: string[];
    deps: string[];
    lemmas: string[];
    anchors: string[];
  },
) {
  if (index < matchStart || index > matchEnd) {
    return null;
  }

  const relativeIndex = index - matchStart;
  if (relativeIndex >= querySketch.fine.length || relativeIndex >= matchSketch.fine.length) {
    return null;
  }

  if (
    matchSketch.fine[relativeIndex] === querySketch.fine[relativeIndex] &&
    matchSketch.pos[relativeIndex] === querySketch.pos[relativeIndex] &&
    matchSketch.deps[relativeIndex] === querySketch.deps[relativeIndex]
  ) {
    return "fine";
  }

  if (matchSketch.coarse[relativeIndex] === querySketch.coarse[relativeIndex]) {
    return "coarse";
  }

  return null;
}

function isInMatchWindow(index: number, matchStart: number, matchEnd: number) {
  return index >= matchStart && index <= matchEnd;
}

function TokenColumn({
  toneClassName,
  tokenContent,
  fine,
  coarse,
  dep,
  showDebug,
}: {
  toneClassName: string;
  tokenContent: ReactNode;
  fine?: string | null;
  coarse?: string | null;
  dep?: string | null;
  showDebug: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col items-center ${toneClassName}`}>
      <div className="px-1 text-sm leading-6">{tokenContent}</div>
      {showDebug && (
        <div className="flex w-full flex-col items-center  text-[10px] leading-4">
          <span className="w-full opacity-80 text-center">{fine ?? "-"}</span>
          <span className="w-full opacity-65 text-center">{coarse ?? "-"}</span>
          <span className="w-full opacity-50 text-center">{dep ?? "-"}</span>
        </div>
      )}
    </div>
  );
}

function QueryTokens({
  tokens,
  sketch,
  showDebug,
  onSelectToken,
  language,
}: {
  tokens: Token[];
  sketch: PatternSketch | null;
  showDebug: boolean;
  onSelectToken: (token: Token, language: string) => void;
  language: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      <Fingerprint size={22} className="text-neutral-500 mr-1" />
      {tokens.map((token, index) => {
        const tint = getPosTint(token.pos);

        return (
          <TokenColumn
            key={`${token.surface}-${index}`}
            toneClassName={tint.fine}
            fine={sketch?.fine[index]}
            coarse={sketch?.coarse[index]}
            dep={sketch?.deps[index]}
            showDebug={showDebug && sketch !== null}
            tokenContent={
              <TokenInLemmaExpansion
                token={token}
                language={language}
                onSelect={() => onSelectToken(token, language)}
                inheritTextColor
              />
            }
          />
        );
      })}
    </div>
  );
}

function PatternResult({
  language,
  tokens,
  matchStart,
  matchEnd,
  score,
  querySketch,
  matchSketch,
  anchorScore,
  posScore,
  depScore,
  lemmaScore,
  structureScore,
  boundaryScore,
  onSelectToken,
  showDebug,
}: {
  language: string;
  tokens: Token[];
  matchStart: number;
  matchEnd: number;
  score: number;
  querySketch: PatternSketch;
  matchSketch: {
    fine: string[];
    pos: string[];
    coarse: string[];
    deps: string[];
    lemmas: string[];
    anchors: string[];
  };
  anchorScore: number;
  posScore: number;
  depScore: number;
  lemmaScore: number;
  structureScore: number;
  boundaryScore: number;
  onSelectToken: (token: Token, language: string) => void;
  showDebug: boolean;
}) {

  return (
    <section className="flex flex-col gap-2 ">
      <div className="flex flex-wrap gap-x-1 gap-y-2">
        {tokens.map((token, index) => {
          const matchLevel = getMatchLevel(index, matchStart, matchEnd, querySketch, matchSketch);
          const tint = getPosTint(token.pos);
          const inMatchWindow = isInMatchWindow(index, matchStart, matchEnd);
          const relativeIndex = index - matchStart;
          const fine = inMatchWindow ? matchSketch.fine[relativeIndex] : null;
          const coarse = inMatchWindow ? matchSketch.coarse[relativeIndex] : null;
          const dep = inMatchWindow ? matchSketch.deps[relativeIndex] : null;

          return (
            <TokenColumn
              key={`${token.surface}-${index}`}
              toneClassName={
                matchLevel === "fine"
                  ? tint.fine
                  : matchLevel === "coarse"
                    ? tint.coarse
                    : inMatchWindow
                      ? "bg-neutral-100 text-neutral-600"
                      : "text-neutral-700"
              }
              fine={fine}
              coarse={coarse}
              dep={dep}
              showDebug={showDebug && inMatchWindow}
              tokenContent={
                <TokenInLemmaExpansion
                  token={token}
                  language={language}
                  onSelect={() => onSelectToken(token, language)}
                  inheritTextColor
                />
              }
            />
          );
        })}
      </div>
      {showDebug && (
        <div className="grid grid-cols-3 grid-rows-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400 leading-4 pt-2">
          <span className="bg-neutral-100 text-neutral-600">
            anchor {anchorScore.toFixed(2)}
          </span>
          <span className="bg-neutral-100 text-neutral-600">
            pos {posScore.toFixed(2)}
          </span>
          <span className="bg-neutral-100 text-neutral-600">
            dep {depScore.toFixed(2)}
          </span>
          <span className="bg-neutral-100 text-neutral-600">
            lemma {lemmaScore.toFixed(2)}
          </span>
          <span className="bg-neutral-100 text-neutral-600">
            structure {structureScore.toFixed(2)}
          </span>
          <span className="bg-neutral-100 text-neutral-600">
            boundary {boundaryScore.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        <span className="w-5 pl-1">{language}</span>
        <span className={score >= 0.9 ? "font-bold" : undefined}>{score.toFixed(2)}</span>
      </div>
    </section>
  );
}

function PatternPanelSkeleton() {
  return (
    <>
      <div className="p-3 pb-2 flex items-center w-full justify-between gap-4 border-b border-neutral-300 opacity-80">
        <div className="text-xs text-neutral-400 flex gap-3 items-center">
          <Languages size={14} className="w-5" />
          <span>Match score</span>
        </div>
        <label className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
          <span>Cross-language</span>
          <input type="checkbox" disabled className="accent-neutral-300" />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <span>Debug</span>
          <input type="checkbox" disabled className="accent-neutral-300" />
        </label>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="flex flex-col gap-7 opacity-30 animate-pulse">
          {Array.from({ length: 3 }).map((_, cardIndex) => (
            <div key={`pattern-skeleton-card-${cardIndex}`} className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-x-1 gap-y-2">
                {Array.from({ length: 8 }).map((__, tokenIndex) => (
                  <div
                    key={`pattern-skeleton-card-${cardIndex}-token-${tokenIndex}`}
                    className={`h-6 bg-neutral-200 ${
                      tokenIndex % 4 === 0
                        ? "w-12"
                        : tokenIndex % 4 === 1
                          ? "w-16"
                          : tokenIndex % 4 === 2
                            ? "w-10"
                            : "w-14"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
                <div className="h-4 w-7 bg-neutral-200" />
                <div className="h-4 w-20 bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function PatternPanel({
  language,
  tokens,
  setPanelData,
}: {
  language: string;
  tokens: Token[];
  setPanelData?: (p: SidePanelState | null) => void;
}) {
  const [response, setResponse] = useState<PatternSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoadingKey, setLookupLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguageOnly, setCurrentLanguageOnly] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [installedLanguages, setInstalledLanguages] = useState<string[]>([language]);
  const languageLabel = LANG_MAP[language] ?? language;
  const mobileApp = isCapacitorApp();
  const querySketch = response?.query?.sketch ?? null;
  const queryTokens = response?.query?.tokens ?? tokens;
  const hasPreviousResults = response !== null;
  const showInitialResultsSkeleton = !hasPreviousResults && loading && !error;

  async function handleSelectToken(token: Token, tokenLanguage: string) {
    const lookup = getLookupMorph(token, tokenLanguage);

    if (!setPanelData || !lookup) {
      return;
    }

    const lookupKey = `${tokenLanguage}:${lookup.lemma}:${lookup.pos}`;
    setLookupLoadingKey(lookupKey);
    setError(null);

    try {
        const lemmaData = await lemmaLookupOne(
          {
          lemma: lookup.lemma,
          pos: lookup.pos,
          },
          tokenLanguage,
        );

      setPanelData({
        type: "lemma",
        data: lemmaData,
        language: tokenLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open lemma.");
    } finally {
      setLookupLoadingKey((current) => current === lookupKey ? null : current);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const installed = await getInstalled();

        if (cancelled) return;

        const nextLanguages = installed
          .filter((pack: { installed: boolean; lang: string }) => pack.installed)
          .map((pack: { lang: string }) => pack.lang);

        setInstalledLanguages(nextLanguages.length > 0 ? nextLanguages : [language]);
      } catch {
        if (!cancelled) {
          setInstalledLanguages([language]);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [language, mobileApp]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const searchLanguages = currentLanguageOnly
          ? [language]
          : Array.from(new Set([language, ...installedLanguages]));

        const next = await searchPattern(language, searchLanguages, tokens);

        if (!cancelled) {
          setResponse(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to search similar patterns.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [currentLanguageOnly, installedLanguages, language, tokens]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {queryTokens.length > 0 && (
        <div className="p-3">
          <QueryTokens
            tokens={queryTokens}
            sketch={querySketch}
            showDebug={showDebug}
            onSelectToken={handleSelectToken}
            language={language}
          />
        </div>
      )}

      {showInitialResultsSkeleton ? (
        <PatternPanelSkeleton />
      ) : (
        <>
          {!error && response && (
            <>
              {(response.message || response.status !== "ok") && (
                <div className="px-3 py-2 text-sm text-neutral-700">
                  {response.status === "unsupported_language"
                    ? `Pattern search is not available for ${languageLabel} yet.`
                    : response.message}
                </div>
              )}
              
              <div className="p-3 pb-2 flex items-center w-full justify-between gap-4 border-b border-neutral-400">

                <p className="text-xs text-neutral-400 flex gap-3 items-center">
                  <Languages size={14} className="w-5" />
                  <span>Match score</span>
                </p>

                <label className="ml-auto flex items-center gap-1 text-xs text-neutral-600">
                  <span>Cross-language</span>
                  <input
                    type="checkbox"
                    checked={!currentLanguageOnly}
                    onChange={(event) => setCurrentLanguageOnly(!event.target.checked)}
                    className="accent-neutral-400"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-neutral-600">
                  <span>Debug</span>
                  <input
                    type="checkbox"
                    checked={showDebug}
                    onChange={(event) => setShowDebug(event.target.checked)}
                    className="accent-neutral-400"
                  />
                </label>
              </div>

              {!loading && response.status === "ok" && response.results.length === 0 && (
                <div className="px-3 py-2 text-sm text-neutral-600">
                  No similar lines found. Try selecting a shorter part of the text.
                </div>
              )}

              {(loading || lookupLoadingKey || error) && (
                <div className="px-3 py-2 text-sm">
                  {loading && <div className="text-neutral-600 animate-pulse">Searching similar patterns...</div>}
                  {!loading && lookupLoadingKey && <div className="text-neutral-600">Opening lemma...</div>}
                  {error && <div className="text-rose-700">{error}</div>}
                </div>
              )}

              <div
                className={`flex-1 min-h-0 overflow-y-auto p-3 transition-opacity duration-200 ${
                  loading ? "opacity-50" : "opacity-100"
                }`}
              >
                <div className="flex flex-col gap-8">
                  {querySketch
                    ? response.results.map((result) => (
                        <PatternResult
                          key={`${result.line_id}-${result.match_start}-${result.match_end}`}
                          language={result.language}
                          tokens={result.tokens}
                          matchStart={result.match_start}
                          matchEnd={result.match_end}
                          score={result.score}
                          querySketch={querySketch}
                          matchSketch={result.match_sketch}
                          anchorScore={result.anchor_score}
                          posScore={result.pos_score}
                          depScore={result.dep_score}
                          lemmaScore={result.lemma_score}
                          structureScore={result.structure_score}
                          boundaryScore={result.boundary_score}
                          onSelectToken={handleSelectToken}
                          showDebug={showDebug}
                        />
                      ))
                    : null}
                </div>
              </div>
            </>
          )}

          {error && !response && (
            <div className="px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
        </>
      )}
    </div>
  );
}
