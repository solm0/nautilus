import type { Annotation, TextAnalysisResult } from "./components/pageTypes";
import type { TimelineItem } from "./types";
import { getStoredToken, getStoredUser } from "./authSession";
import { getAppPlatform, isElectronApp } from "./platform";
import { centralFetch } from "./network";

export type OfflinePageListItem = {
  id: number;
  name: string;
  created_at: string;
  notebook_id?: number | null;
  language: string;
  source?: string;
  metadata?: string[];
  pending_sync?: boolean;
};

export type OfflineNotebook = {
  id: number;
  name: string;
  created_at: string;
  parent_id?: number | null;
  pending_sync?: boolean;
};

export type OfflinePageDetail = {
  id: number;
  name: string;
  created_at: string;
  notebook_id?: number | null;
  language: string;
  source?: string;
  metadata?: string[];
  result: TextAnalysisResult;
  annotations: Annotation[];
  pending_sync?: boolean;
};

type PendingFavoriteToggle = {
  id: number;
  key: string;
  next: boolean;
  created_at: string;
};

type OfflineState = {
  nextLocalId: number;
  snapshot: {
    pages: OfflinePageListItem[];
    notebooks: OfflineNotebook[];
    pageDetails: Record<string, OfflinePageDetail>;
    annotations: TimelineItem[];
    favoriteLemmaKeys: string[];
    syncedAt: string | null;
  };
  outbox: {
    createNotebooks: OfflineNotebook[];
    createPages: OfflinePageDetail[];
    createAnnotations: Annotation[];
    favoriteToggles: PendingFavoriteToggle[];
  };
};

const DEFAULT_STATE: OfflineState = {
  nextLocalId: -1,
  snapshot: {
    pages: [],
    notebooks: [],
    pageDetails: {},
    annotations: [],
    favoriteLemmaKeys: [],
    syncedAt: null,
  },
  outbox: {
    createNotebooks: [],
    createPages: [],
    createAnnotations: [],
    favoriteToggles: [],
  },
};

let stateCache: OfflineState | null = null;

const DEFAULT_CENTRAL_API = "https://nautilus.solmi.wiki/api";
export const OFFLINE_SYNC_EVENT = "nautilus:offline-sync";

let syncPromise: Promise<boolean> | null = null;

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

  return trimTrailingSlash(
    import.meta.env.VITE_WEB_CENTRAL_API
      ?? import.meta.env.VITE_CENTRAL_API
      ?? DEFAULT_CENTRAL_API,
  );
}

const CENTRAL_API = resolveCentralApi();

function canUseOfflineData() {
  return isElectronApp() && typeof window !== "undefined";
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function loadState() {
  if (!canUseOfflineData()) {
    return cloneState(DEFAULT_STATE);
  }

  if (stateCache) {
    return cloneState(stateCache);
  }

  const loaded = await window.electronAPI?.readOfflineState?.();
  stateCache = loaded ? { ...cloneState(DEFAULT_STATE), ...loaded } as OfflineState : cloneState(DEFAULT_STATE);
  stateCache.snapshot = {
    ...DEFAULT_STATE.snapshot,
    ...stateCache.snapshot,
    pageDetails: {
      ...DEFAULT_STATE.snapshot.pageDetails,
      ...(stateCache.snapshot?.pageDetails ?? {}),
    },
  };
  stateCache.outbox = {
    ...DEFAULT_STATE.outbox,
    ...stateCache.outbox,
  };
  return cloneState(stateCache);
}

async function saveState(state: OfflineState) {
  stateCache = cloneState(state);

  if (!canUseOfflineData()) {
    return;
  }

  await window.electronAPI?.writeOfflineState?.(stateCache);
}

function issueLocalId(state: OfflineState) {
  const nextId = state.nextLocalId;
  state.nextLocalId -= 1;
  return nextId;
}

function sortByCreatedDesc<T extends { created_at: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime(),
  );
}

function sortAnnotations(items: Annotation[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  );
}

function mergeFavoriteKeys(base: string[], toggles: PendingFavoriteToggle[]) {
  const set = new Set(base);

  for (const toggle of toggles) {
    if (toggle.next) {
      set.add(toggle.key);
    } else {
      set.delete(toggle.key);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function buildAnnotationFeedItem(annotation: Annotation): TimelineItem {
  return {
    id: annotation.id ?? 0,
    content: annotation.content,
    created_at: annotation.created_at ?? new Date().toISOString(),
    pending_sync: (annotation.id ?? 0) < 0,
    user: (annotation.id ?? 0) < 0 ? getStoredUser() ?? undefined : undefined,
    page_id: annotation.page_id,
    page_name: `Offline page ${annotation.page_id}`,
    source: "user",
    type: annotation.type,
  };
}

export async function cachePagesSnapshot(pages: OfflinePageListItem[]) {
  const state = await loadState();
  state.snapshot.pages = sortByCreatedDesc(pages);
  state.snapshot.syncedAt = new Date().toISOString();
  await saveState(state);
}

export async function cacheNotebooksSnapshot(notebooks: OfflineNotebook[]) {
  const state = await loadState();
  state.snapshot.notebooks = sortByCreatedDesc(notebooks);
  await saveState(state);
}

export async function cachePageDetailSnapshot(detail: OfflinePageDetail) {
  const state = await loadState();
  state.snapshot.pageDetails[String(detail.id)] = detail;
  await saveState(state);
}

export async function cacheAnnotationsSnapshot(items: TimelineItem[]) {
  const state = await loadState();
  state.snapshot.annotations = sortByCreatedDesc(items);
  await saveState(state);
}

export async function cacheFavoriteLemmaKeys(keys: string[]) {
  const state = await loadState();
  state.snapshot.favoriteLemmaKeys = [...keys];
  await saveState(state);
}

export async function getOfflinePages() {
  const state = await loadState();
  return sortByCreatedDesc([
    ...state.snapshot.pages,
    ...state.outbox.createPages.map((page) => ({
      id: page.id,
      name: page.name,
      created_at: page.created_at,
      notebook_id: page.notebook_id ?? null,
      language: page.language,
      source: page.source,
      metadata: page.metadata ?? [],
      pending_sync: true,
    })),
  ]);
}

export async function getOfflineNotebooks() {
  const state = await loadState();
  return sortByCreatedDesc([
    ...state.snapshot.notebooks,
    ...state.outbox.createNotebooks.map((notebook) => ({
      ...notebook,
      pending_sync: true,
    })),
  ]);
}

export async function getOfflinePageDetail(pageId: number) {
  const state = await loadState();
  const pendingPage =
    state.outbox.createPages.find((page) => page.id === pageId) ?? null;

  if (pendingPage) {
    return {
      ...pendingPage,
      annotations: sortAnnotations(
        state.outbox.createAnnotations.filter((annotation) => annotation.page_id === pageId),
      ),
    };
  }

  const detail = state.snapshot.pageDetails[String(pageId)];

  if (!detail) {
    return null;
  }

  const pendingAnnotations = state.outbox.createAnnotations.filter(
    (annotation) => annotation.page_id === pageId,
  );

  return {
    ...detail,
    annotations: sortAnnotations([...detail.annotations, ...pendingAnnotations]),
  };
}

export async function getOfflineAnnotationsFeed() {
  const state = await loadState();
  const pendingItems = state.outbox.createAnnotations.map(buildAnnotationFeedItem);
  return sortByCreatedDesc([...pendingItems, ...state.snapshot.annotations]);
}

export async function getOfflineFavoriteKeys() {
  const state = await loadState();
  return mergeFavoriteKeys(
    state.snapshot.favoriteLemmaKeys,
    state.outbox.favoriteToggles,
  );
}

export async function queueOfflinePageCreate(input: {
  result: TextAnalysisResult;
  name: string;
  notebookId: number | null;
  language: string;
  source: string;
  metadata: string[];
}) {
  const state = await loadState();
  const localId = issueLocalId(state);
  const createdAt = new Date().toISOString();
  const detail: OfflinePageDetail = {
    id: localId,
    name: input.name,
    created_at: createdAt,
    notebook_id: input.notebookId,
    language: input.language,
    source: input.source,
    metadata: input.metadata,
    result: input.result,
    annotations: [],
    pending_sync: true,
  };

  state.outbox.createPages.unshift(detail);
  await saveState(state);
  return localId;
}

export async function queueOfflineNotebookCreate(name: string) {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error("invalid_name");
  }

  const state = await loadState();
  const localId = issueLocalId(state);
  state.outbox.createNotebooks.unshift({
    id: localId,
    name: nextName,
    created_at: new Date().toISOString(),
    parent_id: null,
    pending_sync: true,
  });
  await saveState(state);
  return localId;
}

export async function renamePendingNotebook(id: number, name: string) {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error("invalid_name");
  }

  const state = await loadState();
  const notebook = state.outbox.createNotebooks.find((item) => item.id === id);
  if (!notebook) {
    throw new Error("not_pending_notebook");
  }

  notebook.name = nextName;
  await saveState(state);
}

export async function deletePendingNotebook(id: number) {
  const state = await loadState();
  state.outbox.createNotebooks = state.outbox.createNotebooks.filter(
    (item) => item.id !== id,
  );
  state.outbox.createPages = state.outbox.createPages.map((page) =>
    page.notebook_id === id
      ? { ...page, notebook_id: null }
      : page,
  );
  await saveState(state);
}

export async function renamePendingPage(id: number, name: string) {
  const nextName = name.trim();
  if (!nextName) {
    throw new Error("invalid_name");
  }

  const state = await loadState();
  const page = state.outbox.createPages.find((item) => item.id === id);
  if (!page) {
    throw new Error("not_pending_page");
  }

  page.name = nextName;
  await saveState(state);
}

export async function deletePendingPage(id: number) {
  const state = await loadState();
  state.outbox.createPages = state.outbox.createPages.filter(
    (item) => item.id !== id,
  );
  state.outbox.createAnnotations = state.outbox.createAnnotations.filter(
    (item) => item.page_id !== id,
  );
  await saveState(state);
}

export async function updatePendingAnnotation(id: number, content: string) {
  const nextContent = content.trim();
  if (!nextContent) {
    throw new Error("invalid_content");
  }

  const state = await loadState();
  const annotation = state.outbox.createAnnotations.find((item) => item.id === id);
  if (!annotation) {
    throw new Error("not_pending_annotation");
  }

  annotation.content = nextContent;
  await saveState(state);
  return annotation;
}

export async function deletePendingAnnotation(id: number) {
  const state = await loadState();
  state.outbox.createAnnotations = state.outbox.createAnnotations.filter(
    (item) => item.id !== id,
  );
  await saveState(state);
}

export async function queueOfflineAnnotationCreate(
  annotation: Annotation,
) {
  const state = await loadState();
  const localId = issueLocalId(state);
  const createdAt = new Date().toISOString();
  const nextAnnotation: Annotation = {
    ...annotation,
    id: localId,
    created_at: createdAt,
  };

  state.outbox.createAnnotations.unshift(nextAnnotation);
  await saveState(state);
  return nextAnnotation;
}

export async function queueOfflineFavoriteToggle(key: string, next: boolean) {
  const state = await loadState();
  const remaining = state.outbox.favoriteToggles.filter((item) => item.key !== key);
  const snapshotFavorite = state.snapshot.favoriteLemmaKeys.includes(key);

  state.outbox.favoriteToggles = snapshotFavorite === next
    ? remaining
    : [
        ...remaining,
        {
          id: issueLocalId(state),
          key,
          next,
          created_at: new Date().toISOString(),
        },
      ];
  await saveState(state);
}

async function syncOfflineOutboxOnce() {
  if (!canUseOfflineData()) {
    return true;
  }

  if (typeof navigator === "undefined" || !navigator.onLine) {
    return false;
  }

  const token = getStoredToken();

  if (!token) {
    return true;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const state = await loadState();
  let changed = false;
  const notebookIdMap = new Map<number, number>();

  const finish = async (complete: boolean) => {
    if (changed) {
      state.snapshot.syncedAt = new Date().toISOString();
      await saveState(state);
    }

    if (changed || !complete) {
      window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT, {
        detail: { complete },
      }));
    }

    return complete;
  };

  for (const notebook of [...state.outbox.createNotebooks].reverse()) {
    const res = await centralFetch(CENTRAL_API + "/notebooks", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: notebook.name }),
    }).catch(() => null);

    if (!res?.ok) {
      return finish(false);
    }

    const data = await res.json();
    const serverId = data.id as number;
    notebookIdMap.set(notebook.id, serverId);
    state.outbox.createNotebooks = state.outbox.createNotebooks.filter(
      (item) => item.id !== notebook.id,
    );
    state.snapshot.notebooks = sortByCreatedDesc([
      {
        id: serverId,
        name: notebook.name,
        created_at: notebook.created_at,
        parent_id: notebook.parent_id ?? null,
      },
      ...state.snapshot.notebooks.filter((item) => item.id !== serverId),
    ]);
    state.outbox.createPages = state.outbox.createPages.map((page) =>
      page.notebook_id === notebook.id
        ? { ...page, notebook_id: serverId }
        : page,
    );
    changed = true;
  }

  for (const page of [...state.outbox.createPages].reverse()) {
    const res = await centralFetch(CENTRAL_API + "/pages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        result: page.result,
        name: page.name,
        notebook_id: notebookIdMap.get(page.notebook_id ?? 0) ?? page.notebook_id ?? null,
        language: page.language,
        source: page.source ?? "user",
        metadata: page.metadata ?? [],
      }),
    }).catch(() => null);

    if (!res?.ok) {
      return finish(false);
    }

    const data = await res.json();
    const serverId = data.id as number;

    state.outbox.createPages = state.outbox.createPages.filter((item) => item.id !== page.id);
    state.snapshot.pages = sortByCreatedDesc([
      {
        id: serverId,
        name: page.name,
        created_at: page.created_at,
        notebook_id: page.notebook_id ?? null,
        language: page.language,
        source: page.source,
        metadata: page.metadata ?? [],
      },
      ...state.snapshot.pages.filter((item) => item.id !== serverId),
    ]);
    state.snapshot.pageDetails[String(serverId)] = {
      ...page,
      id: serverId,
      annotations: [],
      pending_sync: false,
    };
    state.snapshot.pageDetails[String(page.id)] = {
      ...page,
      annotations: [],
      pending_sync: false,
    };

    state.outbox.createAnnotations = state.outbox.createAnnotations.map((annotation) =>
      annotation.page_id === page.id
        ? { ...annotation, page_id: serverId }
        : annotation,
    );

    changed = true;
  }

  for (const annotation of [...state.outbox.createAnnotations].reverse()) {
    const res = await centralFetch(`${CENTRAL_API}/annotations`, {
      method: "POST",
      headers,
      body: JSON.stringify(annotation),
    }).catch(() => null);

    if (!res?.ok) {
      return finish(false);
    }

    const created = await res.json() as Annotation;
    state.outbox.createAnnotations = state.outbox.createAnnotations.filter(
      (item) => item.id !== annotation.id,
    );
    state.snapshot.annotations = sortByCreatedDesc([
      buildAnnotationFeedItem(created),
      ...state.snapshot.annotations.filter((item) => item.id !== created.id),
    ]);
    const detail = state.snapshot.pageDetails[String(created.page_id)];
    if (detail) {
      detail.annotations = sortAnnotations([
        created,
        ...detail.annotations.filter((item) => item.id !== created.id),
      ]);
    }

    changed = true;
  }

  for (const toggle of [...state.outbox.favoriteToggles]) {
    const res = await centralFetch(`${CENTRAL_API}/lemma/favorite`, {
      method: toggle.next ? "POST" : "DELETE",
      headers,
      body: JSON.stringify({ key: toggle.key }),
    }).catch(() => null);

    if (!res?.ok) {
      return finish(false);
    }

    state.outbox.favoriteToggles = state.outbox.favoriteToggles.filter(
      (item) => item.id !== toggle.id,
    );
    state.snapshot.favoriteLemmaKeys = mergeFavoriteKeys(
      state.snapshot.favoriteLemmaKeys,
      [toggle],
    );
    changed = true;
  }

  return finish(true);
}

export function syncOfflineOutbox() {
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = syncOfflineOutboxOnce().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
