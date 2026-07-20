import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getInstalled, getPacks } from "../../api";
import { isNetworkError } from "../../network";
import { readPackCatalogSnapshot } from "../../packCatalogSnapshot";
import { isCapacitorApp } from "../../platform";
import { Link } from "react-router-dom";
import {
  normalizePacksForTargetRelease,
  type Pack,
} from "../setting/PackTable";
import PackModal from "../setting/PackModal";
import { useI18n } from "../../i18n";

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

function normalizeInstalledPacksResponse(
  res: unknown,
): InstalledPack[] {
  return Array.isArray(res) ? (res as InstalledPack[]) : [];
}

async function loadInstalledPacks() {
  if (installedPacksCache) {
    return installedPacksCache;
  }

  if (!installedPacksPromise) {
    installedPacksPromise = getInstalled()
      .then((res: InstalledPack[]) => {
        const normalized = normalizeInstalledPacksResponse(res);
        installedPacksCache = normalized;
        return normalized;
      })
      .finally(() => {
        installedPacksPromise = null;
      });
  }

  return installedPacksPromise;
}

export async function getInstalledPacksCached() {
  return loadInstalledPacks();
}

export async function hasLemmaPackInstalled(language: string) {
  const packs = await loadInstalledPacks();
  return packs.some(
    (pack) => pack.lang === language && (pack.lemma_installed || pack.installed),
  );
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
  onNgramAvailabilityChange,
  ngramInstallPromptTarget,
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
  onNgramAvailabilityChange?: (available: boolean) => void;
  ngramInstallPromptTarget?: HTMLElement | null;
}) {
  const mobileApp = isCapacitorApp();
  const { t } = useI18n();
  const [languages, setLanguages] = useState<NormalizedLanguageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<Pack[]>([]);
  const [installingPack, setInstallingPack] = useState<Pack | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    if (options) {
      setLanguages(normalizeOptions(options));
      setInstalledPacks([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    if (!installedPacksCache) {
      setLoading(true);
    }

    loadInstalledPacks()
      .then((packs) => {
        if (!active) return;
        setInstalledPacks(packs);
        setLanguages(
          packs
            .filter((pack) => pack.lemma_installed || pack.installed)
            .map((pack) => ({ lang: pack.lang })),
        );
      })
      .catch(() => {
        if (!active) return;
        setLanguages([]);
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
        setOffline(false);
        setAvailablePacks(normalizePacksForTargetRelease(packs));
      })
      .catch((error) => {
        if (!active) return;
        setAvailablePacks(
          normalizePacksForTargetRelease(
            readPackCatalogSnapshot() as Pack[],
          ),
        );
        setOffline(isNetworkError(error));
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
    onNgramAvailabilityChange?.(
      Boolean(
        installedPacks.find((pack) => pack.lang === langObj.lang)
          ?.ngram_installed,
      ),
    );
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

  const ngramAvailable = Boolean(selectedState?.ngram_installed);

  useEffect(() => {
    if (!requireNgram) return;
    onNgramAvailabilityChange?.(ngramAvailable);
  }, [ngramAvailable, onNgramAvailabilityChange, requireNgram]);

  const ngramInstallPrompt = shouldPromptNgramInstall && selectedPack ? (
    <button
      type="button"
      onClick={() => setInstallingPack(selectedPack)}
      disabled={offline}
      className="rounded-sm border border-neutral-300 bg-neutral-100 px-3 py-2 text-left text-xs text-neutral-600 transition-colors hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-40"
    >
      {t("Install Writing Assistant")} {selectedPack.lang}
    </button>
  ) : null;

  return (
    <>
      <div className="flex flex-col gap-2 items-start">
        <div className={`shrink-0 flex gap-1 w-auto min-w-12 h-10 p-1 rounded-sm items-center ${background ? "bg-neutral-200/80" : "bg-neutral-50/80"}`}>
          {loading && <p className="px-2 text-sm text-neutral-400">{t("Loading...")}</p>}

          {!loading && languages.length === 0 && (
            <Link to="/setting" className="px-2 text-sm text-neutral-500 border border-neutral-300 hover:bg-neutral-200 transition-colors">
              {mobileApp
                ? t("Activate a language to continue.")
                : t("Install languages to continue.")}
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

        {ngramInstallPromptTarget === undefined ? ngramInstallPrompt : null}
      </div>

      {ngramInstallPromptTarget && ngramInstallPrompt
        ? createPortal(ngramInstallPrompt, ngramInstallPromptTarget)
        : null}

      {installingPack ? (
        <PackModal
          lang={installingPack.lang}
          version={installingPack.version}
          filename={installingPack.ngram_filename}
          downloadUrl={installingPack.ngram_download_url}
          assetKind="ngram"
          onClose={() => setInstallingPack(null)}
          onInstalled={async () => {
            invalidateInstalledLanguagesCache();
            const packs = await loadInstalledPacks();
            setInstalledPacks(packs);
            onNgramAvailabilityChange?.(true);
            onNgramInstalled?.(installingPack.lang);
          }}
        />
      ) : null}
    </>
  );
}
