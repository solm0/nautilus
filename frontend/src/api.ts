import type { TimelineItem } from "./components/setting/Mutuals";
import type { OCRResponse, PageSource, PatternSearchResponse, Token } from "./components/pageTypes"
import type { User } from "./types";
import { getAppPlatform, isCapacitorApp } from "./platform";
import {
  disableMobileLanguage,
  enableMobileLanguage,
  getEnabledMobileLanguages,
} from "./mobilePacks";

function requireEnv(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is not configured`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveCentralApi() {
  const platform = getAppPlatform();

  if (platform === "electron") {
    return trimTrailingSlash(
      requireEnv(
        import.meta.env.VITE_ELECTRON_CENTRAL_API
          ?? import.meta.env.VITE_CENTRAL_API,
        "central api",
      ),
    );
  }

  if (platform === "mobile") {
    return trimTrailingSlash(
      requireEnv(
        import.meta.env.VITE_MOBILE_CENTRAL_API
          ?? import.meta.env.VITE_CENTRAL_API,
        "mobile central api",
      ),
    );
  }

  return trimTrailingSlash(
    requireEnv(
      import.meta.env.VITE_WEB_CENTRAL_API
        ?? import.meta.env.VITE_CENTRAL_API,
      "web central api",
    ),
  );
}

function resolveLocalApi(centralApi: string) {
  const platform = getAppPlatform();

  if (platform === "electron") {
    return trimTrailingSlash(
      import.meta.env.VITE_ELECTRON_LOCAL_API
        ?? import.meta.env.VITE_LOCAL_API
        ?? "http://localhost:8010/api",
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
      ?? "http://localhost:8000/api",
  );
}

export const CENTRAL_API = resolveCentralApi();
export const LOCAL_API = resolveLocalApi(CENTRAL_API);

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

export async function signup(email: string, password: string, name: string) {
  const res = await fetch(CENTRAL_API+"/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  return res.json();
}

export async function login(email:string,password:string){
  return fetch(CENTRAL_API+"/login",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({email,password})
  }).then(r=>r.json())
}

export async function requestReset(email:string){
  return fetch(CENTRAL_API+"/request-password-reset",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({email})
  }).then(r=>r.json())
}

export async function resetPassword(token:string,new_password:string){
  return fetch(CENTRAL_API+"/reset-password",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({token,new_password})
  }).then(r=>r.json())
}

export function authHeaders() {
  const token = localStorage.getItem("token")
  if (!token) return null

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  }
}

export async function verifyToken() {
  const headers = authHeaders()
  if (!headers) return false

  const res = await fetch(CENTRAL_API+"/me", {
    headers
  })

  if (!res.ok) return null

  const data = await res.json()
  return data   // { id, email }
}

export async function updateName(name: string) {
  const headers = authHeaders()
  if (!headers) return false

  const res = await fetch(CENTRAL_API+"/me/name", {
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

  const res = await fetch(CENTRAL_API + "/me", {
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
      tokens?: OCRResponse["blocks"][number]["tokens"];
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
    tokens?: OCRResponse["blocks"][number]["tokens"];
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

async function enrichBlocksWithIpa(
  blocks: OCRResponse["blocks"],
  language: string,
) {
  const res = await fetch(`${LOCAL_API}/ipa`, {
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
    throw new Error(detail || `ipa enrich failed (${res.status})`);
  }

  return res.json() as Promise<{
    blocks: OCRResponse["blocks"];
  }>;
}

// ----------- pages_router -------------

export async function savePage(
  result: OCRResponse,
  name: string,
  notebookId: number | null,
  language: string,
  options?: {
    source?: PageSource;
    metadata?: string[];
  },
) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const ipaData = await enrichBlocksWithIpa(result.blocks, language);
  const resultWithIpa: OCRResponse = {
    ...result,
    blocks: ipaData.blocks,
  };

  const res = await fetch(CENTRAL_API + "/pages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      result: resultWithIpa,
      name,
      notebook_id: notebookId,
      language,
      source: options?.source ?? "user",
      metadata: options?.metadata ?? [],
    }),
  });

  if (res.status === 401) {
    throw new Error("unauthorized");
  } else if (!res.ok) {
    throw new Error("save failed");
  }

  const data = await res.json();
  return data.id;
}

export type ArticulationFeature = {
  kind: string;
  symbol: string;
  base_symbol: string;
  place?: string;
  manner?: string;
  voiced?: boolean;
  height?: string;
  backness?: string;
  rounded?: boolean;
  length: string;
  secondary_articulations: string[];
  visual: {
    tongue_height: number;
    tongue_frontness: number;
    lip_closure: number;
    lip_rounding: number;
    velum: string;
    glottis: string;
    constriction: string;
    airflow: string;
  };
};

export type ArticulationDetail = {
  surface: string;
  token_surface: string;
  ipa: string;
  feature: ArticulationFeature;
  token_index: number;
  segment_index: number;
};

export async function fetchArticulation(tokens: Token[], language: string) {
  const res = await fetch(`${LOCAL_API}/articulation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tokens,
      language,
    }),
  });

  if (!res.ok) {
    throw new Error("articulation failed");
  }

  return res.json() as Promise<{
    items: ArticulationDetail[];
  }>;
}

export async function addPageMetadata(pageId: number, value: string) {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await fetch(`${CENTRAL_API}/pages/${pageId}/metadata`, {
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

  const res = await fetch(`${CENTRAL_API}/pages/${pageId}/metadata/${metadataIndex}`, {
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

  const res = await fetch(`${CENTRAL_API}/pages/${pageId}/metadata/${metadataIndex}`, {
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

  const res = await fetch(CENTRAL_API + "/pages", { headers });
  const data = await res.json();

  if (!Array.isArray(data)) return [];
  return data;
};

export async function fetchNotebooks() {
  const headers = authHeaders();
  if (!headers) {
    throw new Error("unauthorized");
  }

  const res = await fetch(CENTRAL_API + "/notebooks", { headers });
  const data = await res.json();

  if (!Array.isArray(data)) return [];
  return data;
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

export async function searchPattern(
  queryLanguage: string,
  searchLanguages: string[],
  tokens: Token[],
  limit = 20,
) {
  const res = await fetch(`${LOCAL_API}/pattern/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_language: queryLanguage,
      search_languages: searchLanguages,
      tokens,
      limit,
    }),
  });

  if (!res.ok) {
    throw new Error("pattern search failed");
  }

  return res.json() as Promise<PatternSearchResponse>;
}


export async function setFavorite(
  key: string,
  next: boolean
) {
  const headers = authHeaders();

  if (!headers) {
    throw new Error("not authenticated");
  }

  const res = await fetch(`${CENTRAL_API}/lemma/favorite`, {
    method: next ? "POST" : "DELETE",
    headers,
    body: JSON.stringify({ key })
  });

  if (!res.ok) {
    throw new Error("favorite request failed");
  }

  return res.json();
}

export async function getFavorites(): Promise<string[]> {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/lemma/favorites`, {
    method: "GET",
    headers
  })

  if (!res.ok) throw new Error("fetch favorites failed")

  const data = await res.json()
  return data.items as string[]
}

export async function deleteAnnotation(id: number) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/annotations/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("delete failed");
  return true;
}

export async function updateAnnotation(id: number, content: string) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/annotations/${id}`, {
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

  const res = await fetch(`${CENTRAL_API}/annotations?${params.toString()}`, {
    headers,
  });

  if (!res.ok) throw new Error("fetch failed");

  return res.json() as Promise<{
    items: TimelineItem[];
    next_cursor: AnnotationCursor;
  }>;
}

// ===== mutual =====
export async function requestMutual(email: string) {
  const headers = authHeaders()
  if (!headers) throw new Error("unauthorized")

  const res = await fetch(`${CENTRAL_API}/mutuals/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email })
  })

  if (res.status === 400) {
    throw new Error("You cannot send a request to yourself")
  }

  if (res.status === 404) {
    throw new Error("User not found")
  }

  if (!res.ok) {
    throw new Error("Request failed")
  }

  return res.json() as Promise<{ ok: boolean }>
}

export async function fetchMutuals() {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/mutuals`, { headers })
  if (!res.ok) throw new Error("fetch failed")

  return res.json() as Promise<{ items: User[] }>
}

export async function fetchReceived() {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/mutuals/requests`, { headers })
  if (!res.ok) throw new Error("fetch failed")

  return res.json() as Promise<{
    id: number
    user: User
  }[]>
}

export async function fetchSent() {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/mutuals/sent`, { headers })
  if (!res.ok) throw new Error("fetch failed")

  return res.json() as Promise<{ items: User[] }>
}

export async function acceptMutual(id: number) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const res = await fetch(`${CENTRAL_API}/mutuals/${id}/accept`, {
    method: "POST",
    headers
  })

  if (!res.ok) throw new Error("accept failed")
  return res.json() as Promise<{ ok: boolean }>
}

export async function fetchTimeline(cursor: AnnotationCursor) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")

  const params = new URLSearchParams()
  params.append("limit", "10")

  if (cursor) {
    params.append("cursor_created_at", cursor.created_at)
    params.append("cursor_id", String(cursor.id))
  }

  const res = await fetch(`${CENTRAL_API}/mutuals/timeline?${params.toString()}`, {
    headers
  })

  if (!res.ok) throw new Error("fetch failed")

  return res.json() as Promise<{
    items: TimelineItem[]
    next_cursor: AnnotationCursor
  }>
}


// comments

export async function getComments(annotationId: number) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")
  const res = await fetch(`${CENTRAL_API}/annotations/${annotationId}/comments`, {
    headers,
  });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function createComment(annotationId: number, payload: {
  content: string;
  parent_id?: number;
}) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")
  const res = await fetch(`${CENTRAL_API}/annotations/${annotationId}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function updateComment(id: number, content: string) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")
  const res = await fetch(`${CENTRAL_API}/comments/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error();
}

export async function deleteComment(id: number) {
  const headers = authHeaders()
  if (!headers) throw new Error("no token")
  const res = await fetch(`${CENTRAL_API}/comments/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error();
}

export async function fetchAnnotationById(id: number) {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");

  const res = await fetch(`${CENTRAL_API}/annotations/${id}`, {
    headers,
  });

  if (!res.ok) throw new Error("fetch failed");

  return res.json();
}

export async function fetchNotifications() {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");
  const res = await fetch(`${CENTRAL_API}/notifications`, {
    headers,
  });
  return res.json();
}

export async function fetchUnreadFlag() {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");
  const res = await fetch(`${CENTRAL_API}/notifications/unread`, {
    headers,
  });
  return res.json();
}

export async function readNotification(id: number) {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");
  await fetch(`${CENTRAL_API}/notifications/${id}/read`, {
    method: "POST",
    headers,
  });
}

export async function fetchMyComments(cursor?: any) {
  const headers = authHeaders();
  if (!headers) throw new Error("unauthorized");
  const params = new URLSearchParams();

  if (cursor) {
    params.append("cursor_created_at", cursor.created_at);
    params.append("cursor_id", cursor.id);
  }

  const res = await fetch(`${CENTRAL_API}/me/comments?${params.toString()}`, {
    method: "GET",
    headers,
  });
  return res.json();
}

// packs 목록
export async function getPacks() {
  return fetch(`${CENTRAL_API}/lang/packs`).then(r => r.json());
}

// 설치 상태
export async function getInstalled() {
  if (isCapacitorApp()) {
    const [packs, enabledLangs] = await Promise.all([
      getPacks(),
      getEnabledMobileLanguages(),
    ]);

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
    }));
  }

  return fetch(`${LOCAL_API}/lang/installed`).then(r => r.json());
}

// 설치
export async function installPack(pack: {
  lang: string;
  version: string;
  filename: string;
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
