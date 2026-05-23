import type { LemmaData, OCRBlock, OCRResponse } from "../src/components/pageTypes";

const DEFAULT_INSTALL_URL = "https://nautilus.solmi.wiki";
const DEFAULT_LOCAL_API = "http://localhost:8000/api";
const DEFAULT_CENTRAL_API = "https://nautilus.solmi.wiki/api";
const DEFAULT_DEEPLINK_BASE = "nautilus://page/";
const TOKEN_STORAGE_KEY = "nautilus_extension_token";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getEnv(name: string, fallback: string) {
  const value = import.meta.env[name];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const EXTENSION_INSTALL_URL = getEnv(
  "VITE_EXTENSION_INSTALL_URL",
  DEFAULT_INSTALL_URL,
);

export const EXTENSION_LOCAL_API = trimTrailingSlash(
  getEnv("VITE_EXTENSION_LOCAL_API", DEFAULT_LOCAL_API),
);

export const EXTENSION_CENTRAL_API = trimTrailingSlash(
  getEnv("VITE_EXTENSION_CENTRAL_API", DEFAULT_CENTRAL_API),
);

export const EXTENSION_DEEPLINK_BASE = getEnv(
  "VITE_EXTENSION_DEEPLINK_BASE",
  DEFAULT_DEEPLINK_BASE,
);

type ExtensionResponse = {
  ok: boolean;
  status: number;
  text: string;
};

export type InstalledPack = {
  lang: string;
  version: string;
  installed: boolean;
  ocr_supported: boolean;
};

async function sendMessage<T>(message: unknown) {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function parseResponse<T>(response: ExtensionResponse) {
  if (!response.ok) {
    throw new Error(response.text || `request failed (${response.status})`);
  }

  if (!response.text) {
    return null as T;
  }

  return JSON.parse(response.text) as T;
}

async function getToken() {
  const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
  const token = result[TOKEN_STORAGE_KEY];
  return typeof token === "string" && token.length > 0 ? token : null;
}

async function authHeaders() {
  const token = await getToken();
  if (!token) return {} as Record<string, string>;

  return {
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;
}

export async function isAuthenticated() {
  const token = await getToken();
  return Boolean(token);
}

export async function loginWithPassword(email: string, password: string) {
  const response = await extensionFetch<{ access_token?: string; detail?: string | Array<{ msg?: string }> }>(
    `${EXTENSION_CENTRAL_API}/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );

  if (!response?.access_token) {
    const detail = response?.detail;
    const message = Array.isArray(detail) ? detail[0]?.msg : detail;
    throw new Error(message || "login failed");
  }

  await chrome.storage.local.set({
    [TOKEN_STORAGE_KEY]: response.access_token,
  });

  return response.access_token;
}

export async function signupWithPassword(name: string, email: string, password: string) {
  const response = await extensionFetch<{ detail?: string | Array<{ msg?: string }> }>(
    `${EXTENSION_CENTRAL_API}/signup`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    },
  );

  if (response?.detail) {
    const message = Array.isArray(response.detail)
      ? response.detail[0]?.msg
      : response.detail;
    throw new Error(message || "signup failed");
  }

  return true;
}

export async function logoutExtensionAuth() {
  await chrome.storage.local.remove(TOKEN_STORAGE_KEY);
}

export async function probeLocalApi() {
  const result = await sendMessage<{ ok: boolean }>({
    type: "nautilus:probe-local",
    input: {
      localApi: EXTENSION_LOCAL_API,
    },
  });

  return result.ok;
}

export async function extensionFetch<T>(url: string, init?: RequestInit) {
  const response = await sendMessage<ExtensionResponse>({
    type: "nautilus:request",
    input: {
      url,
      init,
    },
  });

  return parseResponse<T>(response);
}

export async function analyzeElementText(text: string, language: string) {
  return extensionFetch<{ blocks: OCRBlock[] }>(`${EXTENSION_LOCAL_API}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocks: [{ text }],
      language,
    }),
  });
}

export async function analyzeTextBlocks(blocks: string[], language: string) {
  return extensionFetch<{ blocks: OCRBlock[] }>(`${EXTENSION_LOCAL_API}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocks: blocks.map((text) => ({ text })),
      language,
    }),
  });
}

export async function enrichBlocksWithIpa(
  blocks: OCRResponse["blocks"],
  language: string,
) {
  return extensionFetch<{ blocks: OCRResponse["blocks"] }>(`${EXTENSION_LOCAL_API}/ipa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocks,
      language,
    }),
  });
}

export async function getInstalledLanguages() {
  return extensionFetch<InstalledPack[]>(`${EXTENSION_LOCAL_API}/lang/installed`, {
    method: "GET",
  });
}

export async function lookupBatch(blocks: OCRBlock[], language: string) {
  const seen = new Set<string>();
  const items: Array<{ lemma: string; pos: string }> = [];

  blocks.forEach((block) => {
    block.tokens?.forEach((token) => {
      if (!token.lemma || !token.pos) return;

      const key = `${token.lemma}_${token.pos}`;
      if (seen.has(key)) return;

      seen.add(key);
      items.push({
        lemma: token.lemma,
        pos: token.pos,
      });
    });
  });

  if (items.length === 0) {
    return {} as Record<string, LemmaData>;
  }

  return extensionFetch<Record<string, LemmaData>>(`${EXTENSION_LOCAL_API}/lookup_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      items,
      language,
    }),
  });
}

export async function lookupLemma(lemma: string, pos: string, language: string) {
  return extensionFetch<LemmaData>(`${EXTENSION_LOCAL_API}/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      lemma,
      pos,
      language,
    }),
  });
}

export async function saveAnalyzedPage(
  result: OCRResponse,
  name: string,
  language: string,
  sourceUrl: string,
) {
  return extensionFetch<{ id: number }>(`${EXTENSION_CENTRAL_API}/pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      result,
      name,
      notebook_id: null,
      language,
      source: "chrome",
      metadata: sourceUrl ? [sourceUrl] : [],
    }),
  });
}

export async function setFavorite(globalKey: string, next: boolean) {
  return extensionFetch(`${EXTENSION_CENTRAL_API}/lemma/favorite`, {
    method: next ? "POST" : "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      key: globalKey,
    }),
  });
}

export async function openInstallPage() {
  await sendMessage({
    type: "nautilus:open-url",
    input: {
      url: EXTENSION_INSTALL_URL,
    },
  });
}

function openDeepLinkInPage(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.style.display = "none";
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function openSavedPage(pageId: number) {
  const url = `${EXTENSION_DEEPLINK_BASE}${pageId}`;

  try {
    openDeepLinkInPage(url);
  } catch {
    await sendMessage({
      type: "nautilus:open-url",
      input: {
        url,
      },
    });
  }
}
