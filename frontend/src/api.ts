import type { Annotation, PageSource, TextAnalysisResult } from "./components/pageTypes"
import type { TimelineItem, User } from "./types";
import {
  clearStoredSession,
  getOfflineSessionUser,
  getStoredToken,
  hasStoredSession,
  isTokenExpired,
  storeVerifiedSession,
} from "./authSession";
import {
  readPackCatalogSnapshot,
  writePackCatalogSnapshot,
} from "./packCatalogSnapshot";
import {
  cacheAnnotationsSnapshot,
  cacheFavoriteLemmaKeys,
  cacheNotebooksSnapshot,
  cachePageDetailSnapshot,
  cachePagesSnapshot,
  getOfflineAnnotationsFeed,
  getOfflineFavoriteKeys,
  getOfflineNotebooks,
  getOfflinePageDetail,
  getOfflinePages,
  queueOfflineAnnotationCreate,
  queueOfflineFavoriteToggle,
  queueOfflinePageCreate,
} from "./offlineData";
import { getAppPlatform, isCapacitorApp, isElectronApp } from "./platform";
import {
  disableMobileLanguage,
  enableMobileLanguage,
  getEnabledMobileLanguages,
} from "./mobilePacks";
import { centralFetch } from "./network";

const DEFAULT_CENTRAL_API = "https://nautilus.solmi.wiki/api";
const DEFAULT_ELECTRON_LOCAL_API = "http://localhost:8010/api";
const DEFAULT_WEB_LOCAL_API = "http://localhost:8000/api";

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

function resolveLocalApi(centralApi: string) {
  const platform = getAppPlatform();

  if (platform === "electron") {
    return trimTrailingSlash(
      import.meta.env.VITE_ELECTRON_LOCAL_API
        ?? import.meta.env.VITE_LOCAL_API
        ?? DEFAULT_ELECTRON_LOCAL_API,
    );
  }

  if (platform === "mobile") {
    return trimTrailingSlash(
      import.meta.env.VITE_MOBILE_LOCAL_API
        ?? `${centralApi}/mobile`,
    );
  }

  return trimTrailingSlash(
    import.meta.env.VITE_WEB_LOCAL_API
      ?? import.meta.env.VITE_LOCAL_API
      ?? DEFAULT_WEB_LOCAL_API,
  );
}

export const CENTRAL_API = resolveCentralApi();
export const LOCAL_API = resolveLocalApi(CENTRAL_API);

export type LatestVersionPlatform = "desktop" | "android";

type ApiErrorDetailObject = {
  code?: string;
  message?: string;
};

export type ApiErrorDetail =
  | string
  | ApiErrorDetailObject
  | Array<{ msg?: string }>
  | undefined;

function resolveLatestVersionPlatform(): LatestVersionPlatform {
  return getAppPlatform() === "mobile" ? "android" : "desktop";
}

export type AnalyzeBlockInput = {
  text: string;
};

const MOBILE_ANALYZE_BATCH_SIZE = 8;

function compareVersionsDesc(a: string, b: string) {
  return b.localeCompare(a, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function isNewerVersion(latest: string, current: string) {
  return compareVersionsDesc(latest, current) < 0;
}

export type LatestVersionInfo = {
  platform: LatestVersionPlatform;
  version: string;
  download_url: string;
  notes: string[];
};

export async function getLatestVersionInfo() {
  const platform = resolveLatestVersionPlatform();
  const res = await centralFetch(`${CENTRAL_API}/latest-version?platform=${platform}`);

  if (!res.ok) {
    throw new Error(`latest version fetch failed (${res.status})`);
  }

  return res.json() as Promise<LatestVersionInfo>;
}

export async function signup(email: string, password: string, name: string) {
  const res = await centralFetch(CENTRAL_API+"/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  return res.json();
}

export async function login(email:string,password:string){
  return centralFetch(CENTRAL_API+"/login",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({email,password})
  }).then(r=>r.json())
}

export async function requestReset(email:string){
  return centralFetch(CENTRAL_API+"/request-password-reset",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({email})
  }).then(r=>r.json())
}

export async function resetPassword(token:string,new_password:string){
  return centralFetch(CENTRAL_API+"/reset-password",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({token,new_password})
  }).then(r=>r.json())
}

export function parseApiErrorDetail(detail: ApiErrorDetail): {
  code?: string;
  message: string;
} | null {
  if (!detail) {
    return null;
  }

  if (Array.isArray(detail)) {
    return {
      message: detail[0]?.msg || "error",
    };
  }

  if (typeof detail === "string") {
    return {
      message: detail,
    };
  }

  return {
    code: detail.code,
    message: detail.message || "error",
  };
}

export function authHeaders() {
  const token = getStoredToken();
  if (!token) return null

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  }
}

export async function verifyToken({
  throwOnNetworkError = false,
}: {
  throwOnNetworkError?: boolean;
} = {}) {
  const token = getStoredToken();

  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    clearStoredSession();
    return null;
  }

  const headers = authHeaders();

  if (!headers) {
    return null;
  }

  try {
    const res = await centralFetch(CENTRAL_API + "/me", {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearStoredSession();
        return null;
      }

      return hasStoredSession() ? getOfflineSessionUser() : null;
    }

    const data = await res.json() as User;
    storeVerifiedSession(token, data);
    return data;
  } catch (error) {
    if (throwOnNetworkError) {
      throw error;
    }
    return getOfflineSessionUser();
  }
}

export async function updateName(name: string) {
  const headers = authHeaders()
  if (!headers) return false

  const res = await centralFetch(CENTRAL_API+"/me/name", {
    method: "PUT",
    headers,
    body: JSON.stringify({ name })
  });

  return res.json();
}

export async function deleteAccount() {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await centralFetch(CENTRAL_API + "/me", {
    method: "DELETE",
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
    throw new Error(error || "delete account failed");
  }

  return data;
}

async function analyzeBlocksBatch(
  blocks: AnalyzeBlockInput[],
  language: string,
) {
  const res = await fetch(`${LOCAL_API}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocks,
      language,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `analyze failed (${res.status})`);
  }

  return res.json() as Promise<{
    blocks: Array<{
      text: string;
      tokens?: TextAnalysisResult["blocks"][number]["tokens"];
    }>;
  }>;
}

export async function analyzeBlocks(
  blocks: AnalyzeBlockInput[],
  language: string,
) {
  const shouldBatch =
    isCapacitorApp() && blocks.length > MOBILE_ANALYZE_BATCH_SIZE;

  if (!shouldBatch) {
    return analyzeBlocksBatch(blocks, language);
  }

  const analyzedBlocks: Array<{
    text: string;
    tokens?: TextAnalysisResult["blocks"][number]["tokens"];
  }> = [];

  for (let start = 0; start < blocks.length; start += MOBILE_ANALYZE_BATCH_SIZE) {
    const batch = blocks.slice(start, start + MOBILE_ANALYZE_BATCH_SIZE);
    const result = await analyzeBlocksBatch(batch, language);
    analyzedBlocks.push(...result.blocks);
  }

  return {
    blocks: analyzedBlocks,
  };
}

// ----------- pages_router -------------

export type SavePageProgress = "saving";

export async function savePage(
  result: TextAnalysisResult,
  name: string,
  notebookId: number | null,
  language: string,
  options?: {
    source?: PageSource;
    metadata?: string[];
    onProgress?: (stage: SavePageProgress) => void;
  },
) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const payload = {
    result,
    name,
    notebook_id: notebookId,
    language,
    source: options?.source ?? "user",
    metadata: options?.metadata ?? [],
  };

  let res: Response;

  try {
    options?.onProgress?.("saving");
    res = await centralFetch(CENTRAL_API + "/pages", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return queueOfflinePageCreate({
      result,
      name,
      notebookId,
      language,
      source: options?.source ?? "user",
      metadata: options?.metadata ?? [],
    });
  }

  if (res.status === 401) {
    throw new Error("unauthorized");
  } else if (!res.ok) {
    throw new Error("save failed");
  }

  const data = await res.json();
  return data.id;
}

export async function addPageMetadata(pageId: number, value: string) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await centralFetch(`${CENTRAL_API}/pages/${pageId}/metadata`, {
    method: "POST",
    headers,
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    throw new Error("metadata save failed");
  }

  return res.json() as Promise<{ metadata: string[] }>;
}

export async function updatePageMetadata(
  pageId: number,
  metadataIndex: number,
  value: string,
) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await centralFetch(`${CENTRAL_API}/pages/${pageId}/metadata/${metadataIndex}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    throw new Error("metadata update failed");
  }

  return res.json() as Promise<{ metadata: string[] }>;
}

export async function deletePageMetadata(pageId: number, metadataIndex: number) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await centralFetch(`${CENTRAL_API}/pages/${pageId}/metadata/${metadataIndex}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    throw new Error("metadata delete failed");
  }

  return res.json() as Promise<{ metadata: string[] }>;
}

export async function fetchPages () {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  try {
    const res = await centralFetch(CENTRAL_API + "/pages", { headers });
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("pages response was not an array");
    }

    if (isElectronApp()) {
      await cachePagesSnapshot(data);
      return getOfflinePages();
    }

    return data;
  } catch (error) {
    if (isElectronApp()) {
      return getOfflinePages();
    }
    throw error;
  }
};

export async function fetchNotebooks() {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  try {
    const res = await centralFetch(CENTRAL_API + "/notebooks", { headers });
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("notebooks response was not an array");
    }

    if (isElectronApp()) {
      await cacheNotebooksSnapshot(data);
    }
    return data;
  } catch (error) {
    if (isElectronApp()) {
      return getOfflineNotebooks();
    }
    throw error;
  }
}

export async function fetchPageDetail(pageId: number) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  try {
    const [pageRes, annRes] = await Promise.all([
      centralFetch(`${CENTRAL_API}/pages/${pageId}`, { headers }),
      centralFetch(`${CENTRAL_API}/pages/${pageId}/annotations`, { headers }),
    ]);

    if (!pageRes.ok) {
      throw new Error("page fetch failed");
    }

    const pageData = await pageRes.json();
    const annotations = annRes.ok ? await annRes.json() : [];
    const detail = {
      id: pageId,
      name: pageData.name ?? "",
      created_at: pageData.created_at ?? new Date().toISOString(),
      notebook_id: pageData.notebook_id ?? null,
      language: pageData.language,
      source: pageData.source ?? "user",
      metadata: Array.isArray(pageData.metadata) ? pageData.metadata : [],
      result: pageData.result as TextAnalysisResult,
      annotations: Array.isArray(annotations) ? annotations : [],
    };

    await cachePageDetailSnapshot(detail);
    return detail;
  } catch {
    const offlineDetail = await getOfflinePageDetail(pageId);

    if (!offlineDetail) {
      throw new Error("page fetch failed");
    }

    return offlineDetail;
  }
}

const CYR_TO_LAT_MAP: Record<string, string> = {
  а:"a", б:"b", в:"v", г:"g", д:"d",
  ђ:"đ", е:"e", ж:"ž", з:"z", и:"i",
  ј:"j", к:"k", л:"l", љ:"lj", м:"m",
  н:"n", њ:"nj", о:"o", п:"p", р:"r",
  с:"s", т:"t", ћ:"ć", у:"u", ф:"f",
  х:"h", ц:"c", ч:"č", џ:"dž", ш:"š"
}

function normalizeSr(lemma: string) {
  return lemma
    .toLowerCase()
    .split("")
    .map(ch => CYR_TO_LAT_MAP[ch] ?? ch)
    .join("")
}

export async function lemmaLookup(
  items: { lemma: string; pos: string }[],
  language: string
) {
  const headers = authHeaders() ?? {}

  const normalizedItems =
    language === "sr"
      ? items.map(i => ({
          ...i,
          lemma: normalizeSr(i.lemma),
        }))
      : items

  const res = await fetch(`${LOCAL_API}/lookup_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      items: normalizedItems,
      language,
    }),
  })

  if (!res.ok) throw new Error("lookup_batch failed")

  return res.json()
}

export async function lemmaLookupOne(
  item: { lemma:string; pos:string; },
  language: string
) {
  const headers = authHeaders() ?? {}

  const res = await fetch(`${LOCAL_API}/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({...item, language})
  })

  if (!res.ok) throw new Error("lookup failed")

  return res.json()
}

export async function setFavorite(
  key: string,
  next: boolean
) {
  const headers = authHeaders();

  if (!headers) {
    throw new Error("not authenticated");
  }

  let res: Response;

  try {
    res = await centralFetch(`${CENTRAL_API}/lemma/favorite`, {
      method: next ? "POST" : "DELETE",
      headers,
      body: JSON.stringify({ key })
    });
  } catch {
    await queueOfflineFavoriteToggle(key, next);
    return { ok: true, offline: true };
  }

  if (!res.ok) {
    throw new Error("favorite request failed");
  }

  return res.json();
}

export async function getFavorites(): Promise<string[]> {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  try {
    const res = await centralFetch(`${CENTRAL_API}/lemma/favorites`, {
      method: "GET",
      headers
    })

    if (!res.ok) throw new Error("fetch favorites failed")

    const data = await res.json()
    const items = data.items as string[];
    if (isElectronApp()) {
      await cacheFavoriteLemmaKeys(items);
      return getOfflineFavoriteKeys();
    }
    return items;
  } catch (error) {
    if (isElectronApp()) {
      return getOfflineFavoriteKeys();
    }
    throw error;
  }
}

export async function deleteAnnotation(id: number) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await centralFetch(`${CENTRAL_API}/annotations/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("delete failed");
  return true;
}

export async function updateAnnotation(id: number, content: string) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await centralFetch(`${CENTRAL_API}/annotations/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("update failed");
  return res.json();
}

// get all annotations

export type AnnotationItem = {
  id: number;
  type: "link" | "memo" | "emoji";
  content: string;
  page_id: number;
  page_name: string;
  source: string;
  created_at: string;
  user: User
};

export type AnnotationCursor = {
  created_at: string;
  id: number;
} | null;

export async function fetchAnnotations(cursor: AnnotationCursor) {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");

  const params = new URLSearchParams();
  params.append("limit", "20");

  if (cursor) {
    params.append("cursor_created_at", cursor.created_at);
    params.append("cursor_id", String(cursor.id));
  }

  try {
    const res = await centralFetch(`${CENTRAL_API}/annotations?${params.toString()}`, {
      headers,
    });

    if (!res.ok) throw new Error("fetch failed");

    const data = await res.json() as {
      items: TimelineItem[];
      next_cursor: AnnotationCursor;
    };

    if (!cursor) {
      await cacheAnnotationsSnapshot(data.items);
    } else {
      await cacheAnnotationsSnapshot([
        ...(await getOfflineAnnotationsFeed()),
        ...data.items,
      ]);
    }

    return {
      ...data,
      offline: false,
    };
  } catch {
    return {
      items: await getOfflineAnnotationsFeed(),
      next_cursor: null,
      offline: true,
    };
  }
}

export async function createAnnotation(annotation: Annotation) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  try {
    const response = await centralFetch(`${CENTRAL_API}/annotations`, {
      method: "POST",
      headers,
      body: JSON.stringify(annotation),
    });

    if (!response.ok) {
      throw new Error("annotation create failed");
    }

    return await response.json() as Annotation;
  } catch {
    return queueOfflineAnnotationCreate(annotation);
  }
}

// packs 목록
export async function getPacks() {
  const res = await centralFetch(`${CENTRAL_API}/lang/packs`);

  if (!res.ok) {
    throw new Error("pack fetch failed");
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    writePackCatalogSnapshot(data);
    return data;
  }

  return [];
}

// 설치 상태
export async function getInstalled() {
  if (isCapacitorApp()) {
    const enabledLangs = await getEnabledMobileLanguages();
    let packs = readPackCatalogSnapshot();

    try {
      packs = await getPacks();
    } catch {
      // Fallback to the last known pack catalog so mobile can keep showing enabled languages offline.
    }

    const latestByLang = new Map<string, any>();

    for (const pack of packs) {
      const existing = latestByLang.get(pack.lang);

      if (!existing || compareVersionsDesc(existing.version, pack.version) > 0) {
        latestByLang.set(pack.lang, pack);
      }
    }

    return Array.from(latestByLang.values()).map((pack) => ({
      lang: pack.lang,
      version: pack.version,
      installed: enabledLangs.includes(pack.lang),
      lemma_installed: enabledLangs.includes(pack.lang),
    }));
  }

  return fetch(`${LOCAL_API}/lang/installed`).then(r => r.json());
}

// 설치
export async function installPack(pack: {
  lang: string;
  version: string;
  filename: string;
  download_url?: string;
}) {
  if (isCapacitorApp()) {
    await enableMobileLanguage(pack.lang);

    return {
      status: "ok",
      lang: pack.lang,
      version: pack.version,
      installed: true,
    };
  }

  return fetch(`${LOCAL_API}/lang/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pack)
  }).then(r => r.json());
}

// 삭제
export async function uninstallPack(pack: {
  lang: string;
  version: string;
}) {
  if (isCapacitorApp()) {
    await disableMobileLanguage(pack.lang);

    return {
      status: "ok",
      lang: pack.lang,
      version: pack.version,
      installed: false,
    };
  }

  return fetch(`${LOCAL_API}/lang/uninstall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pack)
  }).then(r => r.json());
}

// progress
export async function getProgress(taskId: string) {
  return fetch(`${LOCAL_API}/lang/progress/${taskId}`).then(r => r.json());
}
