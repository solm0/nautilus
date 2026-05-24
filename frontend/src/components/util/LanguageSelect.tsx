import { useEffect, useState } from "react";
import { getInstalled } from "../../api";
import { isCapacitorApp } from "../../platform";
import { Link } from "react-router-dom";

export type InstalledPack = {
  lang: string;
  version: string;
  installed: boolean;
};

export type LanguageOption = {
  lang: string;
};

type NormalizedLanguageOption = {
  lang: string;
};

let installedLanguagesCache: NormalizedLanguageOption[] | null = null;
let installedLanguagesPromise: Promise<NormalizedLanguageOption[]> | null = null;

function normalizeOptions(options: LanguageOption[]) {
  return options.map((option) => ({
    lang: option.lang,
  }));
}

async function loadInstalledLanguages() {
  if (installedLanguagesCache) {
    return installedLanguagesCache;
  }

  if (!installedLanguagesPromise) {
    installedLanguagesPromise = getInstalled()
      .then((res: InstalledPack[]) => {
        const langs = res
          .filter((pack) => pack.installed)
          .map((pack) => ({
            lang: pack.lang,
          }));

        installedLanguagesCache = langs;
        return langs;
      })
      .finally(() => {
        installedLanguagesPromise = null;
      });
  }

  return installedLanguagesPromise;
}

export default function LanguageSelect({
  language,
  setLanguage,
  handleReset,
  setAnyLangInstalled,
  background = false,
  options,
  allowUnselected = false,
}: {
  language: string | null;
  setLanguage: (l: { lang: string } | null) => void;
  handleReset?: () => void;
  setAnyLangInstalled?: (i: boolean) => void;
  background?: boolean;
  options?: { lang: string }[];
  allowUnselected?: boolean;
}) {
  const mobileApp = isCapacitorApp();
  const [languages, setLanguages] = useState<
    NormalizedLanguageOption[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (options) {
      const normalized = normalizeOptions(options);

      if (active) {
        setLanguages(normalized);
        setLoading(false);
      }

      return () => {
        active = false;
      };
    }

    if (!installedLanguagesCache) {
      setLoading(true);
    }

    loadInstalledLanguages()
      .then((langs) => {
        if (!active) return;
        setLanguages(langs);
      })
      .catch(() => {
        if (!active) return;
        setLanguages([]);
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

  return (
    <div className={`shrink-0 flex gap-1 w-auto min-w-12 h-10 p-1 rounded-sm items-center ${background ? 'bg-neutral-200/80' : 'bg-neutral-50/80'}`}>

      {loading && <p className="px-2 text-sm text-neutral-400">Loading...</p>}

      {!loading && languages.length === 0 && (
        <Link to={'/setting'} className="px-2 text-sm text-neutral-500 border border-neutral-300 hover:bg-neutral-200 transition-colors">
          {mobileApp
            ? "Activate a language to continue."
            : "Install a language pack to continue."}
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
  );
}
