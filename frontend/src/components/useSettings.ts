import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  Dispatch,
  SetStateAction,
} from "react";

const STORAGE_KEY = "nautilus_settings";

export type AppSettings = {
  lemma_info: boolean;

  highlight_nsubj: boolean;
  highlight_root: boolean;
  highlight_obj: boolean;
  now_playing_notifications: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  lemma_info: false,

  highlight_nsubj: true,
  highlight_root: true,
  highlight_obj: true,
  now_playing_notifications: true,
};

let cachedSettings: AppSettings | null = null;
const listeners = new Set<
  Dispatch<SetStateAction<AppSettings>>
>();

function loadSettings(): AppSettings {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      cachedSettings = DEFAULT_SETTINGS;
      return cachedSettings ?? DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw);

    // 새 필드 추가돼도 기본값 merge
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };

    return cachedSettings ?? DEFAULT_SETTINGS;
  } catch {
    cachedSettings = DEFAULT_SETTINGS;
    return cachedSettings ?? DEFAULT_SETTINGS;
  }
}

function updateSettings(
  next:
    | AppSettings
    | ((prev: AppSettings) => AppSettings)
) {
  const resolved =
    typeof next === "function"
      ? next(loadSettings())
      : next;

  cachedSettings = resolved;

  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(resolved)
    );
  }

  listeners.forEach((listener) => {
    listener(resolved);
  });
}

export function useSettings() {
  const [settings, setSettings] =
    useState<AppSettings>(loadSettings);

  useEffect(() => {
    listeners.add(setSettings);

    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== STORAGE_KEY ||
        event.newValue == null
      ) {
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue);
        updateSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
        });
      } catch {
        updateSettings(DEFAULT_SETTINGS);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  const toggleSetting = useCallback(
    <K extends keyof AppSettings>(key: K) => {
      updateSettings((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    []
  );

  return {
    settings,
    setSettings: updateSettings,
    toggleSetting,
  };
}
