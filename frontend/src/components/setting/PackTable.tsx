import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Trash2 } from "lucide-react";
import { getInstalled, getPacks, installPack, uninstallPack } from "../../api";
import PackModal from "./PackModal";
import type { InstalledPack } from "../util/LanguageSelect";
import Button from "../util/Button";
import { isCapacitorApp } from "../../platform";
import { invalidateInstalledLanguagesCache } from "../util/LanguageSelect";

export const HIDDEN_PACK_VERSIONS = new Set(["1.0.0"]);

export type Pack = {
  lang: string;
  version: string;
  lemma_filename: string;
  ngram_filename: string;
  tag: string;
  corpus: {
    "Data source"?: string;
    "Corpora used"?: string;
  }[];
};

type SelectedInstall = {
  lang: string;
  version: string;
  filename: string;
  assetKind: "lemma" | "ngram";
};

export const LANG_MAP: Record<string, string> = {
  ru: "Russian",
  de: "German",
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese",
  fr: "French",
  es: "Spanish",
  sr: "Serbian",
  mk: "Macedonian",
  sq: "Albanian",
};

export function normalizePacksForTargetRelease(packs: Pack[]): Pack[] {
  return packs
    .sort((a, b) => {
      const langOrder = a.lang.localeCompare(b.lang, undefined, {
        sensitivity: "base",
      });

      if (langOrder !== 0) {
        return langOrder;
      }

      return b.version.localeCompare(a.version, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export default function PackTable() {
  const mobileApp = isCapacitorApp();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedInstall, setSelectedInstall] = useState<SelectedInstall | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const expandedPointerDownRef = useRef<{
    x: number;
    y: number;
    shouldIgnoreClick: boolean;
  } | null>(null);

  async function refreshInstalled() {
    const data = await getInstalled();
    invalidateInstalledLanguagesCache();
    setInstalled(data);
  }

  async function refreshPacks() {
    const data = await getPacks();
    setPacks(normalizePacksForTargetRelease(data));
  }

  useEffect(() => {
    refreshPacks();
    refreshInstalled();
  }, []);

  function getInstallState(pack: Pack) {
    return (
      installed.find(
        (item) => item.lang === pack.lang && item.version === pack.version,
      ) ?? {
        lang: pack.lang,
        version: pack.version,
        installed: false,
        lemma_installed: false,
        ngram_installed: false,
        model_installed: false,
      }
    );
  }

  function renderDesktopStatus(state: InstalledPack) {
    const chips: string[] = [];

    if (state.lemma_installed) {
      chips.push("C");
    }

    if (state.ngram_installed) {
      chips.push("W");
    }

    if (chips.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <div
            key={chip}
            className="bg-green-200 text-green-700/80 text-xs px-1.5 rounded-full"
          >
            {chip}
          </div>
        ))}
      </div>
    );
  }

  function renderHeaderStatus(state: InstalledPack) {
    if (mobileApp) {
      if (!state.installed) {
        return null;
      }

      return (
        <div className="bg-green-200 text-green-700/80 text-xs px-2 rounded-full">
          Activated
        </div>
      );
    }

    return renderDesktopStatus(state);
  }

  async function handleActivate(pack: Pack) {
    const key = `${pack.lang}-${pack.version}`;

    try {
      setErrorMap((prev) => ({
        ...prev,
        [key]: "",
      }));

      await installPack({
        lang: pack.lang,
        version: pack.version,
        filename: pack.lemma_filename,
        asset_kind: "lemma",
      });

      await refreshInstalled();
    } catch {
      setErrorMap((prev) => ({
        ...prev,
        [key]: "Failed to activate language.",
      }));
    }
  }

  async function handleUninstall(pack: Pack) {
    const key = `${pack.lang}-${pack.version}`;

    try {
      setErrorMap((prev) => ({
        ...prev,
        [key]: "",
      }));

      await uninstallPack({
        lang: pack.lang,
        version: pack.version,
      });

      await refreshInstalled();
    } catch {
      setErrorMap((prev) => ({
        ...prev,
        [key]: mobileApp
          ? "Failed to deactivate language."
          : "Failed to uninstall pack.",
      }));
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, Pack[]> = {};

    for (const pack of packs) {
      if (!map[pack.lang]) {
        map[pack.lang] = [];
      }

      map[pack.lang].push(pack);
    }

    Object.keys(map).forEach((lang) => {
      map[lang].sort((a, b) =>
        b.version.localeCompare(a.version, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    });

    return map;
  }, [packs]);

  const groupsToRender = useMemo(() => {
    if (!mobileApp) return Object.entries(grouped);

    return Object.entries(grouped).map(([lang, langPacks]) => [
      lang,
      langPacks.slice(0, 1),
    ] as const);
  }, [grouped, mobileApp]);

  function openInstall(pack: Pack, assetKind: "lemma" | "ngram") {
    setSelectedInstall({
      lang: pack.lang,
      version: pack.version,
      filename: assetKind === "lemma" ? pack.lemma_filename : pack.ngram_filename,
      assetKind,
    });
  }

  function collapseLanguage(lang: string) {
    setExpanded((prev) => ({
      ...prev,
      [lang]: false,
    }));
  }

  function handleExpandedPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    expandedPointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      shouldIgnoreClick: false,
    };
  }

  function handleExpandedPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const pointerDown = expandedPointerDownRef.current;

    if (!pointerDown) {
      return;
    }

    const movedX = Math.abs(event.clientX - pointerDown.x);
    const movedY = Math.abs(event.clientY - pointerDown.y);

    if (movedX > 5 || movedY > 5) {
      pointerDown.shouldIgnoreClick = true;
    }
  }

  function handleExpandedClick(lang: string) {
    const pointerDown = expandedPointerDownRef.current;

    if (pointerDown?.shouldIgnoreClick || window.getSelection()?.toString()) {
      expandedPointerDownRef.current = null;
      return;
    }

    expandedPointerDownRef.current = null;
    collapseLanguage(lang);
  }

  return (
    <>
      <div className="flex flex-col">
        {groupsToRender.map(([lang, langPacks]) => {
          const open = expanded[lang];
          const label = LANG_MAP[lang] || lang;
          const currentPack = langPacks[0];
          const currentState = currentPack ? getInstallState(currentPack) : null;

          return (
            <div
              key={lang}
              className="overflow-hidden border-t border-neutral-300 hover:bg-neutral-100 transition-colors"
            >
              <button
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [lang]: !prev[lang],
                  }))
                }
                className="w-full flex items-center px-4 py-3 transition gap-3"
              >
                <span className="font-medium">
                  {label} ({lang})
                </span>
                {currentState ? renderHeaderStatus(currentState) : null}
                <div className="ml-auto">
                  {open ? (
                    <ChevronUpIcon size={18} />
                  ) : (
                    <ChevronDownIcon size={18} />
                  )}
                </div>
              </button>

              {open && (
                <div
                  onPointerDown={handleExpandedPointerDown}
                  onPointerUp={handleExpandedPointerUp}
                  onClick={() => handleExpandedClick(lang)}
                >
                  {langPacks.map((pack) => {
                    const state = getInstallState(pack);
                    const key = `${pack.lang}-${pack.version}`;
                    const isHiddenVersion = HIDDEN_PACK_VERSIONS.has(pack.version);
                    const shouldDisableRemove =
                      isHiddenVersion || (!state.lemma_installed && !state.ngram_installed);

                    return (
                      <div
                        key={key}
                        className={`flex flex-col px-4 py-3 border-b border-neutral-200 last:border-b-0 transition-opacity ${
                          isHiddenVersion ? "opacity-30" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-sm flex-1">
                            {pack.lang} v{pack.version}
                          </div>

                          <div className="text-sm flex-[2] flex flex-col">
                            <p>{pack.corpus[0]["Data source"]}</p>
                            <p>{pack.corpus[1]["Corpora used"]}</p>
                          </div>

                          <div className="flex-1">
                            {mobileApp ? (
                              state.installed ? (
                                <Button
                                  onClick={() => handleUninstall(pack)}
                                  text="Deactivate"
                                  black
                                  fit
                                  disabled={isHiddenVersion}
                                />
                              ) : (
                                <Button
                                  onClick={() => handleActivate(pack)}
                                  text="Activate"
                                  fit
                                  disabled={isHiddenVersion}
                                />
                              )
                            ) : (
                              <div
                                className="flex items-start justify-end gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openInstall(pack, "lemma")}
                                    disabled={isHiddenVersion || state.lemma_installed}
                                    className={`rounded-sm px-3 py-2 text-xs transition-colors ${
                                      state.lemma_installed
                                        ? "bg-green-200 text-green-600"
                                        : "border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                                    }`}
                                  >
                                    {state.lemma_installed ? "Core installed" : "Install Core"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openInstall(pack, "ngram")}
                                    disabled={isHiddenVersion || !state.lemma_installed || state.ngram_installed}
                                    className={`rounded-sm px-3 py-2 text-xs transition-colors ${
                                      state.ngram_installed
                                        ? "bg-green-200 text-green-600"
                                        : "border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-300 disabled:opacity-40 disabled:pointer-events-none"
                                    }`}
                                  >
                                    {state.ngram_installed
                                      ? "Writing Assistant installed"
                                      : "Install Writing Assistant"}
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleUninstall(pack)}
                                  disabled={shouldDisableRemove}
                                  className="rounded-sm p-2 text-neutral-600 transition-colors hover:bg-neutral-200 disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-transparent disabled:hover:text-neutral-600"
                                  title="Remove Core and Writing Assistant"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {errorMap[key] ? (
                          <div className="text-red-500 text-xs mt-2">
                            {errorMap[key]}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!mobileApp && selectedInstall ? (
        <PackModal
          lang={selectedInstall.lang}
          version={selectedInstall.version}
          filename={selectedInstall.filename}
          assetKind={selectedInstall.assetKind}
          onClose={() => setSelectedInstall(null)}
          onInstalled={async () => {
            await refreshInstalled();
            await refreshPacks();
          }}
        />
      ) : null}
    </>
  );
}
