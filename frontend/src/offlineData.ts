import { Preferences } from "@capacitor/preferences";
import { getStoredToken, getStoredUser } from "./authSession";
import { getAppPlatform, isCapacitorApp, isElectronApp } from "./platform";
import { centralFetch } from "./network";

type PendingInterestToggle = {
  id: string;
  key: string;
  next: boolean;
  created_at: string;
};

type UserVocabularyState = {
  interestedSnapshot: string[];
  interestOutbox: PendingInterestToggle[];
};

type VocabularySyncState = {
  version: 3;
  users: Record<string, UserVocabularyState>;
};

const DEFAULT_STATE: VocabularySyncState = { version: 3, users: {} };
const MOBILE_STORAGE_KEY = "lema.vocabulary-sync.v3";
const LEGACY_MOBILE_STORAGE_KEY = "lema.favorite-sync.v2";
const DEFAULT_CENTRAL_API = "https://nautilus.solmi.wiki/api";
export const VOCABULARY_SYNC_EVENT = "lema:vocabulary-sync";

let stateCache: VocabularySyncState | null = null;
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

function emptyUserState(): UserVocabularyState {
  return { interestedSnapshot: [], interestOutbox: [] };
}

function normalizeUserState(value: unknown): UserVocabularyState {
  if (!value || typeof value !== "object") return emptyUserState();
  const candidate = value as {
    interestedSnapshot?: string[];
    interestOutbox?: PendingInterestToggle[];
    snapshot?: string[];
    outbox?: PendingInterestToggle[];
  };
  return {
    interestedSnapshot: Array.isArray(candidate.interestedSnapshot)
      ? [...candidate.interestedSnapshot]
      : Array.isArray(candidate.snapshot) ? [...candidate.snapshot] : [],
    interestOutbox: Array.isArray(candidate.interestOutbox)
      ? candidate.interestOutbox.map((item) => ({ ...item, id: String(item.id) }))
      : Array.isArray(candidate.outbox)
        ? candidate.outbox.map((item) => ({ ...item, id: String(item.id) }))
        : [],
  };
}

function normalizeState(value: unknown): VocabularySyncState {
  if (!value || typeof value !== "object") return clone(DEFAULT_STATE);
  const candidate = value as {
    version?: number;
    users?: Record<string, unknown>;
    snapshot?: { favoriteLemmaKeys?: string[] };
    outbox?: { favoriteToggles?: PendingInterestToggle[] };
  };

  if ((candidate.version === 2 || candidate.version === 3) && candidate.users) {
    return {
      version: 3,
      users: Object.fromEntries(
        Object.entries(candidate.users).map(([userId, state]) => [
          userId,
          normalizeUserState(state),
        ]),
      ),
    };
  }

  const userId = currentUserId();
  if (!userId) return clone(DEFAULT_STATE);
  return {
    version: 3,
    users: {
      [userId]: normalizeUserState({
        snapshot: candidate.snapshot?.favoriteLemmaKeys,
        outbox: candidate.outbox?.favoriteToggles,
      }),
    },
  };
}

async function loadState(): Promise<VocabularySyncState> {
  if (stateCache) return clone(stateCache);
  let loaded: unknown = null;
  if (isElectronApp()) {
    loaded = await window.electronAPI?.readOfflineState?.();
  } else if (isCapacitorApp()) {
    let stored = await Preferences.get({ key: MOBILE_STORAGE_KEY });
    if (!stored.value) stored = await Preferences.get({ key: LEGACY_MOBILE_STORAGE_KEY });
    if (stored.value) {
      try { loaded = JSON.parse(stored.value); } catch { loaded = null; }
    }
  }
  stateCache = normalizeState(loaded);
  return clone(stateCache);
}

async function saveState(state: VocabularySyncState) {
  stateCache = clone(state);
  if (isElectronApp()) {
    await window.electronAPI?.writeOfflineState?.(stateCache);
  } else if (isCapacitorApp()) {
    await Preferences.set({ key: MOBILE_STORAGE_KEY, value: JSON.stringify(stateCache) });
  }
}

function userState(state: VocabularySyncState, userId: string) {
  state.users[userId] ??= emptyUserState();
  return state.users[userId];
}

function mergeInterestedKeys(base: string[], toggles: PendingInterestToggle[]) {
  const keys = new Set(base);
  for (const toggle of toggles) {
    if (toggle.next) keys.add(toggle.key);
    else keys.delete(toggle.key);
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export async function cacheInterestedLemmaKeys(keys: string[]) {
  const userId = currentUserId();
  if (!userId) return;
  const state = await loadState();
  userState(state, userId).interestedSnapshot = [...keys];
  await saveState(state);
}

export async function getOfflineInterestedKeys() {
  const userId = currentUserId();
  if (!userId) return [];
  const state = await loadState();
  const vocabulary = userState(state, userId);
  return mergeInterestedKeys(vocabulary.interestedSnapshot, vocabulary.interestOutbox);
}

export async function queueOfflineInterestToggle(key: string, next: boolean) {
  const userId = currentUserId();
  if (!userId) throw new Error("not authenticated");
  const state = await loadState();
  const vocabulary = userState(state, userId);
  const remaining = vocabulary.interestOutbox.filter((item) => item.key !== key);
  vocabulary.interestOutbox = [...remaining, {
    id: crypto.randomUUID(),
    key,
    next,
    created_at: new Date().toISOString(),
  }];
  await saveState(state);
}

async function syncVocabularyOutboxOnce() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const userId = currentUserId();
  const token = getStoredToken();
  if (!userId || !token) return true;

  const state = await loadState();
  const vocabulary = userState(state, userId);
  let changed = false;
  for (const toggle of [...vocabulary.interestOutbox]) {
    const response = await centralFetch(`${CENTRAL_API}/lemma/interest`, {
      method: toggle.next ? "POST" : "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key: toggle.key }),
    }).catch(() => null);
    if (!response?.ok) return false;

    vocabulary.interestOutbox = vocabulary.interestOutbox.filter(
      (item) => item.id !== toggle.id,
    );
    vocabulary.interestedSnapshot = mergeInterestedKeys(
      vocabulary.interestedSnapshot,
      [toggle],
    );
    changed = true;
  }
  if (changed) {
    await saveState(state);
    window.dispatchEvent(new CustomEvent(VOCABULARY_SYNC_EVENT));
  }
  return true;
}

export function syncOfflineOutbox() {
  if (syncPromise) return syncPromise;
  syncPromise = syncVocabularyOutboxOnce().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}
