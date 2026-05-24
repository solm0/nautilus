import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { getInstalled, getPacks, installPack, uninstallPack } from "../../api";
import PackModal from "./PackModal";
import type { InstalledPack } from "../util/LanguageSelect";
import Button from "../util/Button";
import { isCapacitorApp } from "../../platform";

export type Pack = {
  lang: string;
  version: string;
  filename: string;
  tag: string;
  corpus: {
    "Data source"?: string;
    "Corpora used"?: string;
  }[];
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

export default function PackTable() {
  const mobileApp = isCapacitorApp();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Pack | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  async function refreshInstalled() {
    const data = await getInstalled();
    setInstalled(data);
  }

  async function refreshPacks() {
    const data = await getPacks();
    setPacks(data);
  }

  useEffect(() => {
    refreshPacks();
    refreshInstalled();
  }, []);

  function isInstalled(pack: Pack) {
    return installed.some(
      (i) =>
        i.lang === pack.lang &&
        i.version === pack.version &&
        i.installed
    );
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
    } catch (err) {
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
        })
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
        filename: pack.filename,
      });

      await refreshInstalled();
    } catch {
      setErrorMap((prev) => ({
        ...prev,
        [key]: "Failed to activate language.",
      }));
    }
  }

  return (
    <>
      <div className="flex flex-col">
        {groupsToRender.map(([lang, langPacks]) => {
          const open = expanded[lang];
          const label = LANG_MAP[lang] || lang;

          return (
            <div
              key={lang}
              className='overflow-hidden border-t border-neutral-300 hover:bg-neutral-200 transition-colors'
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
                <div className="bg-green-200 text-green-700/80 text-xs px-2 rounded-full">
                  {installed.find((item) => item.lang === lang)?.installed &&
                    (mobileApp ? "Activated" : "Installed")}
                </div>
                <div className="ml-auto">
                  {open ? (
                    <ChevronUpIcon size={18} />
                  ) : (
                    <ChevronDownIcon size={18} />
                  )}
                </div>
              </button>

              {open && (
                <div className="">
                  {langPacks.map((pack) => {
                    const installed = isInstalled(pack);
                    const key = `${pack.lang}-${pack.version}`;

                    return (
                      <div
                        key={key}
                        className="flex flex-col px-4 py-3 border-b border-neutral-100 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-sm flex-1">
                            {pack.lang} v{pack.version}
                          </div>

                          <div className="text-sm flex-4 flex flex-col">
                            <p>{pack.corpus[0]["Data source"]}</p>
                            <p>{pack.corpus[1]["Corpora used"]}</p>
                          </div>

                          <div className="flex-1">
                            {installed ? (
                              <Button
                                onClick={() => handleUninstall(pack)}
                                text={mobileApp ? "Deactivate" : "Uninstall"}
                                black fit
                              />
                              
                            ) : (
                              <Button
                                onClick={() => mobileApp ? handleActivate(pack) : setSelected(pack)}
                                text={mobileApp ? "Activate" : "Install"}
                                fit
                              />
                            )}
                          </div>
                        </div>

                        {errorMap[key] && (
                          <div className="text-red-500 text-xs mt-2">
                            {errorMap[key]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!mobileApp && selected && (
        <PackModal
          pack={selected}
          onClose={() => setSelected(null)}
          onInstalled={refreshInstalled}
        />
      )}
    </>
  );
}
