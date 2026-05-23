import { Preferences } from "@capacitor/preferences";
import { isCapacitorApp } from "./platform";

const ENABLED_PACKS_KEY = "mobile_enabled_languages";

type EnabledLanguages = {
  langs: string[];
};

function normalizeLangs(langs: string[]) {
  return Array.from(
    new Set(
      langs
        .map((lang) => lang.trim())
        .filter(Boolean),
    ),
  ).sort();
}

export async function getEnabledMobileLanguages() {
  if (!isCapacitorApp()) return [];

  const { value } = await Preferences.get({ key: ENABLED_PACKS_KEY });

  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as EnabledLanguages;
    return normalizeLangs(parsed.langs ?? []);
  } catch {
    return [];
  }
}

export async function setEnabledMobileLanguages(langs: string[]) {
  if (!isCapacitorApp()) return;

  await Preferences.set({
    key: ENABLED_PACKS_KEY,
    value: JSON.stringify({
      langs: normalizeLangs(langs),
    } satisfies EnabledLanguages),
  });
}

export async function enableMobileLanguage(lang: string) {
  const langs = await getEnabledMobileLanguages();
  await setEnabledMobileLanguages([...langs, lang]);
}

export async function disableMobileLanguage(lang: string) {
  const langs = await getEnabledMobileLanguages();
  await setEnabledMobileLanguages(langs.filter((item) => item !== lang));
}
