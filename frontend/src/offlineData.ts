import { Preferences } from "@capacitor/preferences";
import { getStoredToken, getStoredUser } from "./authSession";
import { getAppPlatform, isCapacitorApp, isElectronApp } from "./platform";
import { centralFetch } from "./network";

type PendingFavoriteToggle = {
  id: string;
  key: string;
  next: boolean;
  created_at: string;
};

type UserFavoriteState = {
  snapshot: string[];
  outbox: PendingFavoriteToggle[];
};

type FavoriteSyncState = {
  version: 2;
  users: Record<string, UserFavoriteState>;
};

const DEFAULT_STATE: FavoriteSyncState = { version: 2, users: {} };
const MOBILE_STORAGE_KEY = "lema.favorite-sync.v2";
const DEFAULT_CENTRAL_API = "https://nautilus.solmi.wiki/api";
export const FAVORITE_SYNC_EVENT = "lema:favorite-sync";

let stateCache: FavoriteSyncState | null = null;
let syncPromise: Promise<boolean> | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveCentralApi() {
  const platform = getAppPlatform();
  if (platform === "electron") {
    return trimTrailingSlash(
      import.meta.env.VITE_ELECTRON_CENTRAL_API
        ?? import.meta.env.VITE_CENTRAL_API
        ?? DEFAULT_CENTRAL_API,
    );
  }
  if (platform === "mobile") {
    return trimTrailingSlash(
      import.meta.env.VITE_MOBILE_CENTRAL_API
        ?? import.meta.env.VITE_CENTRAL_API
        ?? DEFAULT_CENTRAL_API,
    );
  }
  return trimTrailingSlash(import.meta.env.VITE_CENTRAL_API ?? DEFAULT_CENTRAL_API);
}

const CENTRAL_API = resolveCentralApi();

function currentUserId() {
  const id = getStoredUser()?.id;
  return typeof id === "number" ? String(id) : null;
}

function emptyUserState(): UserFavoriteState {
  return { snapshot: [], outbox: [] };
}

function normalizeState(value: unknown): FavoriteSyncState {
  if (!value || typeof value !== "object") return clone(DEFAULT_STATE);
  const candidate = value as Partial<FavoriteSyncState> & {
    snapshot?: { favoriteLemmaKeys?: string[] };
    outbox?: { favoriteToggles?: Array<PendingFavoriteToggle & { id: string | number }> };
  };
  if (candidate.version === 2 && candidate.users && typeof candidate.users === "object") {
    return { version: 2, users: clone(candidate.users) };
  }

  const userId = currentUserId();
  if (!userId) return clone(DEFAULT_STATE);
  return {
    version: 2,
    users: {
      [userId]: {
        snapshot: Array.isArray(candidate.snapshot?.favoriteLemmaKeys)
          ? [...candidate.snapshot.favoriteLemmaKeys]
          : [],
        outbox: Array.isArray(candidate.outbox?.favoriteToggles)
          ? candidate.outbox.favoriteToggles.map((item) => ({ ...item, id: String(item.id) }))
          : [],
      },
    },
  };
}

async function loadState(): Promise<FavoriteSyncState> {
  if (stateCache) return clone(stateCache);
  let loaded: unknown = null;
  if (isElectronApp()) {
    loaded = await window.electronAPI?.readOfflineState?.();
  } else if (isCapacitorApp()) {
    const { value } = await Preferences.get({ key: MOBILE_STORAGE_KEY });
    if (value) {
      try { loaded = JSON.parse(value); } catch { loaded = null; }
    }
  }
  stateCache = normalizeState(loaded);
  return clone(stateCache);
}

async function saveState(state: FavoriteSyncState) {
  stateCache = clone(state);
  if (isElectronApp()) {
    await window.electronAPI?.writeOfflineState?.(stateCache);
  } else if (isCapacitorApp()) {
    await Preferences.set({ key: MOBILE_STORAGE_KEY, value: JSON.stringify(stateCache) });
  }
}

function userState(state: FavoriteSyncState, userId: string) {
  state.users[userId] ??= emptyUserState();
  return state.users[userId];
}

function mergeFavoriteKeys(base: string[], toggles: PendingFavoriteToggle[]) {
  const keys = new Set(base);
  for (const toggle of toggles) {
    if (toggle.next) keys.add(toggle.key);
    else keys.delete(toggle.key);
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export async function cacheFavoriteLemmaKeys(keys: string[]) {
  const userId = currentUserId();
  if (!userId) return;
  const state = await loadState();
  userState(state, userId).snapshot = [...keys];
  await saveState(state);
}

export async function getOfflineFavoriteKeys() {
  const userId = currentUserId();
  if (!userId) return [];
  const state = await loadState();
  const favorites = userState(state, userId);
  return mergeFavoriteKeys(favorites.snapshot, favorites.outbox);
}

export async function queueOfflineFavoriteToggle(key: string, next: boolean) {
  const userId = currentUserId();
  if (!userId) throw new Error("not authenticated");
  const state = await loadState();
  const favorites = userState(state, userId);
  const remaining = favorites.outbox.filter((item) => item.key !== key);
  favorites.outbox = [...remaining, {
    id: crypto.randomUUID(),
    key,
    next,
    created_at: new Date().toISOString(),
  }];
  await saveState(state);
}

async function syncFavoriteOutboxOnce() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const userId = currentUserId();
  const token = getStoredToken();
  if (!userId || !token) return true;

  const state = await loadState();
  const favorites = userState(state, userId);
  let changed = false;
  for (const toggle of [...favorites.outbox]) {
    const response = await centralFetch(`${CENTRAL_API}/lemma/favorite`, {
      method: toggle.next ? "POST" : "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key: toggle.key }),
    }).catch(() => null);
    if (!response?.ok) return false;

    favorites.outbox = favorites.outbox.filter((item) => item.id !== toggle.id);
    favorites.snapshot = mergeFavoriteKeys(favorites.snapshot, [toggle]);
    changed = true;
  }
  if (changed) {
    await saveState(state);
    window.dispatchEvent(new CustomEvent(FAVORITE_SYNC_EVENT));
  }
  return true;
}

export function syncOfflineOutbox() {
  if (syncPromise) return syncPromise;
  syncPromise = syncFavoriteOutboxOnce().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}
