import { authHeaders, CENTRAL_API } from "./api";
import { Preferences } from "@capacitor/preferences";
import { getStoredUser } from "./authSession";
import type { Annotation, TextAnalysisResult } from "./components/pageTypes";
import {
  getLocalLibraryMeta,
  mergeLibraryBundle,
  setLocalLibraryMeta,
  type LibraryBundle,
} from "./localLibrary";
import { centralFetch } from "./network";
import { isCapacitorApp, isElectronApp } from "./platform";

const CENTRAL_MIGRATION_VERSION = 1;
const PINNED_STORAGE_KEY = "pages.sidebar.pinned";

function centralMarker(userId: number) {
  return `central_migration_v${CENTRAL_MIGRATION_VERSION}_user_${userId}`;
}

async function migratePinnedPageIds(idMap: Map<number, string>) {
  let raw: string | null = null;
  if (isCapacitorApp()) {
    raw = (await Preferences.get({ key: PINNED_STORAGE_KEY })).value;
  } else if (typeof window !== "undefined") {
    raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
  }
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    const migrated = parsed.flatMap((value) => {
      if (typeof value === "string") {
        const legacyId = /^-?\d+$/.test(value) ? Number(value) : null;
        return legacyId !== null && idMap.has(legacyId) ? [idMap.get(legacyId)!] : [value];
      }
      if (typeof value === "number" && idMap.has(value)) return [idMap.get(value)!];
      return [];
    });
    const value = JSON.stringify(Array.from(new Set(migrated)));
    if (isCapacitorApp()) await Preferences.set({ key: PINNED_STORAGE_KEY, value });
    else window.localStorage.setItem(PINNED_STORAGE_KEY, value);
  } catch {
    // Invalid legacy UI state does not block the library migration.
  }
}

export async function migrateCentralLibraryOnce() {
  const user = getStoredUser();
  const headers = authHeaders();
  if (!user || !headers) return null;

  const marker = centralMarker(user.id);
  if (await getLocalLibraryMeta(marker)) return null;

  const response = await centralFetch(`${CENTRAL_API}/library/export`, { headers });
  if (!response.ok) throw new Error(`central library export failed (${response.status})`);
  const bundle = await response.json() as LibraryBundle;
  const result = await mergeLibraryBundle(bundle);
  await migratePinnedPageIds(new Map(
    bundle.pages.flatMap((item) =>
      typeof item.legacy_id === "number" && typeof item.id === "string"
        ? [[item.legacy_id, item.id] as const]
        : [],
    ),
  ));
  await setLocalLibraryMeta(marker, new Date().toISOString());
  window.dispatchEvent(new CustomEvent("lema:library-changed", { detail: result }));
  return result;
}

type LegacyOfflineState = {
  snapshot?: {
    favoriteLemmaKeys?: string[];
  };
  outbox?: {
    createNotebooks?: Array<{ id: number; name: string; created_at: string }>;
    createPages?: Array<{
      id: number;
      name: string;
      created_at: string;
      notebook_id?: number | null;
      language: string;
      source?: string;
      metadata?: string[];
      result: TextAnalysisResult;
    }>;
    createAnnotations?: Array<Annotation & { id: number; page_id: number }>;
  };
};

export async function migrateLegacyElectronOfflineLibraryOnce() {
  if (!isElectronApp()) return null;
  const marker = "legacy_nautilus_offline_library_v1";
  if (await getLocalLibraryMeta(marker)) return null;

  const legacy = await window.electronAPI?.readOfflineState?.() as LegacyOfflineState | null;
  const oldNotebooks = legacy?.outbox?.createNotebooks ?? [];
  const oldPages = legacy?.outbox?.createPages ?? [];
  const oldAnnotations = legacy?.outbox?.createAnnotations ?? [];

  const notebookMap = new Map(oldNotebooks.map((item) => [item.id, crypto.randomUUID()]));
  const pageMap = new Map(oldPages.map((item) => [item.id, crypto.randomUUID()]));
  const now = new Date().toISOString();
  const bundle: LibraryBundle = {
    format: "lema-library",
    version: 1,
    library_id: "legacy-nautilus-electron-outbox",
    exported_at: now,
    notebooks: oldNotebooks.map((item) => ({
      id: notebookMap.get(item.id),
      name: item.name,
      created_at: item.created_at,
      updated_at: item.created_at,
    })),
    pages: oldPages.map((item) => ({
      id: pageMap.get(item.id),
      notebook_id: item.notebook_id == null ? null : notebookMap.get(item.notebook_id) ?? null,
      name: item.name,
      result: item.result,
      language: item.language,
      source: item.source ?? "user",
      metadata: item.metadata ?? [],
      created_at: item.created_at,
      updated_at: item.created_at,
    })),
    annotations: oldAnnotations.flatMap((item) => {
      const pageId = pageMap.get(item.page_id);
      if (!pageId) return [];
      return [{
        id: crypto.randomUUID(),
        page_id: pageId,
        type: item.type,
        content: item.content,
        start_index: item.start_index,
        end_index: item.end_index,
        created_at: item.created_at ?? now,
        updated_at: item.created_at ?? now,
      }];
    }),
  };

  const result = bundle.pages.length || bundle.notebooks.length || bundle.annotations.length
    ? await mergeLibraryBundle(bundle)
    : { pages: 0, notebooks: 0, annotations: 0, conflicts: 0 };
  await migratePinnedPageIds(pageMap);
  await setLocalLibraryMeta(marker, now);
  if (result.pages || result.notebooks || result.annotations) {
    window.dispatchEvent(new CustomEvent("lema:library-changed", { detail: result }));
  }
  return result;
}
