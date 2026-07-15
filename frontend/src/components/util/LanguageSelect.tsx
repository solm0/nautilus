import { useEffect, useMemo, useState } from "react";
import { getInstalled, getPacks } from "../../api";
import { isCapacitorApp } from "../../platform";
import { Link } from "react-router-dom";
import {
  normalizePacksForTargetRelease,
  type Pack,
} from "../setting/PackTable";
import PackModal from "../setting/PackModal";

export type InstalledPack = {
  lang: string;
  version: string;
  installed: boolean;
  lemma_installed: boolean;
  ngram_installed: boolean;
  model_installed?: boolean;
};

export type LanguageOption = {
  lang: string;
};

type NormalizedLanguageOption = {
  lang: string;
};

let installedPacksCache: InstalledPack[] | null = null;
let installedPacksPromise: Promise<InstalledPack[]> | null = null;

export function invalidateInstalledLanguagesCache() {
  installedPacksCache = null;
  installedPacksPromise = null;
}

function normalizeOptions(options: LanguageOption[]) {
  return options.map((option) => ({
    lang: option.lang,
  }));
}

async function loadInstalledPacks() {
  if (installedPacksCache) {
    return installedPacksCache;
  }

  if (!installedPacksPromise) {
    installedPacksPromise = getInstalled()
      .then((res: InstalledPack[]) => {
        installedPacksCache = res;
        return res;
      })
      .finally(() => {
        installedPacksPromise = null;
      });
  }

  return installedPacksPromise;
}

export default function LanguageSelect({
  language,
  setLanguage,
  handleReset,
  setAnyLangInstalled,
  background = false,
  options,
  allowUnselected = false,
  requireNgram = false,
  onNgramInstalled,
}: {
  language: string | null;
  setLanguage: (l: { lang: string } | null) => void;
  handleReset?: () => void;
  setAnyLangInstalled?: (i: boolean) => void;
  background?: boolean;
  options?: { lang: string }[];
  allowUnselected?: boolean;
  requireNgram?: boolean;
  onNgramInstalled?: (lang: string) => void;
}) {
  const mobileApp = isCapacitorApp();
  const [languages, setLanguages] = useState<NormalizedLanguageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<Pack[]>([]);
  const [installingPack, setInstallingPack] = useState<Pack | null>(null);

  useEffect(() => {
    let active = true;

    if (!installedPacksCache) {
      setLoading(true);
    }

    loadInstalledPacks()
      .then((packs) => {
        if (!active) return;
        setInstalledPacks(packs);

        if (options) {
          setLanguages(normalizeOptions(options));
        } else {
          setLanguages(
            packs
              .filter((pack) => pack.lemma_installed || pack.installed)
              .map((pack) => ({ lang: pack.lang })),
          );
        }
      })
      .catch(() => {
        if (!active) return;
        if (options) {
          setLanguages(normalizeOptions(options));
        } else {
          setLanguages([]);
        }
        setInstalledPacks([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [options]);

  useEffect(() => {
    if (!requireNgram || mobileApp) return;

    let active = true;

    getPacks()
      .then((packs: Pack[]) => {
        if (!active) return;
        setAvailablePacks(normalizePacksForTargetRelease(packs));
      })
      .catch(() => {
        if (!active) return;
        setAvailablePacks([]);
      });

    return () => {
      active = false;
    };
  }, [mobileApp, requireNgram]);

  useEffect(() => {
    setAnyLangInstalled?.(languages.length !== 0);
  }, [languages, setAnyLangInstalled]);

  useEffect(() => {
    if (allowUnselected) return;

    if (languages.length > 0 && !language) {
      setLanguage(languages[0]);
    }
  }, [allowUnselected, language, languages, setLanguage]);

  function handleLanguageChange(langObj: { lang: string }) {
    setLanguage(langObj);
    if (handleReset) handleReset();
  }

  const selectedState = useMemo(
    () => installedPacks.find((pack) => pack.lang === language) ?? null,
    [installedPacks, language],
  );

  const selectedPack = useMemo(
    () => availablePacks.find((pack) => pack.lang === language) ?? null,
    [availablePacks, language],
  );

  const shouldPromptNgramInstall = Boolean(
    requireNgram &&
      !mobileApp &&
      language &&
      selectedState?.lemma_installed &&
      !selectedState?.ngram_installed &&
      selectedPack,
  );

  return (
    <>
      <div className="flex flex-col gap-2 items-start">
        <div className={`shrink-0 flex gap-1 w-auto min-w-12 h-10 p-1 rounded-sm items-center ${background ? "bg-neutral-200/80" : "bg-neutral-50/80"}`}>
          {loading && <p className="px-2 text-sm text-neutral-400">Loading...</p>}

          {!loading && languages.length === 0 && (
            <Link to="/setting" className="px-2 text-sm text-neutral-500 border border-neutral-300 hover:bg-neutral-200 transition-colors">
              {mobileApp
                ? "Activate a language to continue."
                : "Install lemmas to continue."}
            </Link>
          )}

          {!loading && languages.map((l) => (
            <button
              key={l.lang}
              onClick={() => handleLanguageChange(l)}
              className={`
                px-2 h-full rounded text-sm transition-colors
                ${language === l.lang
                  ? "bg-neutral-900 text-neutral-50"
                  : "hover:bg-neutral-300"}
              `}
            >
              {l.lang}
            </button>
          ))}
        </div>

        {shouldPromptNgramInstall && selectedPack ? (
          <button
            type="button"
            onClick={() => setInstallingPack(selectedPack)}
            className="rounded-sm border border-neutral-300 bg-neutral-100 px-3 py-2 text-left text-xs text-neutral-600 transition-colors hover:bg-neutral-300"
          >
            Install Writing Assistant for {selectedPack.lang}
          </button>
        ) : null}
      </div>

      {installingPack ? (
        <PackModal
          lang={installingPack.lang}
          version={installingPack.version}
          filename={installingPack.ngram_filename}
          assetKind="ngram"
          onClose={() => setInstallingPack(null)}
          onInstalled={async () => {
            invalidateInstalledLanguagesCache();
            const packs = await loadInstalledPacks();
            setInstalledPacks(packs);
            onNgramInstalled?.(installingPack.lang);
          }}
        />
      ) : null}
    </>
  );
}
