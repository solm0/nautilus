import { registerPlugin } from "@capacitor/core";

import { getAppPlatform, isCapacitorApp, isElectronApp } from "./platform";
import type { TrackReference } from "./components/pageTypes";

export type NowPlayingLyrics = {
  provider: string;
  is_synced: boolean;
  plain: string | null;
  synced: string | null;
  language: string | null;
};

export type NowPlayingTrack = {
  available: boolean;
  source: string;
  is_playing: boolean;
  progress_ms: number | null;
  duration_ms: number | null;
  timestamp: number | null;
  track: {
    id: string | null;
    uri: string | null;
    name: string | null;
    artists: string[];
    album: string | null;
    image_url: string | null;
    external_url: string | null;
    isrc: string | null;
  } | null;
  device: {
    name: string | null;
    type: string | null;
  } | null;
  source_query: {
    primary: string | null;
    fallbacks: string[];
  };
  lyrics: NowPlayingLyrics | null;
};

export type NowPlayingPermissionStatus = {
  platform: string;
  supported: boolean;
  granted: boolean;
  needs_user_action: boolean;
};

const lyricsCache = new Map<string, NowPlayingLyrics | null>();
const lyricsInflight = new Map<string, Promise<NowPlayingLyrics | null>>();

function cleanTrackTitle(title: string) {
  return title
    .replace(/\s*[\(\[][^)\]]*(remaster|live|mono|stereo|version|edit|feat\.?|featuring)[^)\]]*[\)\]]/gi, "")
    .replace(/\s*-\s*(remaster(?:ed)?|live|mono|stereo|radio edit|edit|version)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentityText(value: string | null | undefined) {
  if (!value) return "";

  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtistName(value: string | null | undefined) {
  return normalizeIdentityText(value);
}

function durationBucket(durationMs: number | null | undefined) {
  if (durationMs == null) return "";
  return String(Math.round(durationMs / 1000));
}

function getTrackIdentityKey(track: NowPlayingTrack) {
  if (!track.track) return `${track.source}:unavailable`;

  const isrc = normalizeIdentityText(track.track.isrc);
  if (isrc) {
    return `${track.source}:isrc:${isrc}`;
  }

  const uri = track.track.uri?.trim();
  if (uri) {
    return `${track.source}:uri:${uri}`;
  }

  const providerTrackId = track.track.id?.trim();
  if (providerTrackId) {
    return `${track.source}:id:${providerTrackId}`;
  }

  return [
    track.source,
    cleanTrackTitle(track.track.name ?? ""),
    normalizeArtistName(track.track.artists[0] ?? ""),
    durationBucket(track.duration_ms),
  ].join("|");
}

function getLyricsCacheKey(track: NowPlayingTrack) {
  if (!track.track) return null;

  const primaryArtist = normalizeArtistName(track.track.artists[0] ?? "");
  const cleanedTitle = cleanTrackTitle(track.track.name ?? "");

  if (!primaryArtist || !cleanedTitle) return null;

  return [
    getTrackIdentityKey(track),
    normalizeIdentityText(track.track.album ?? ""),
    durationBucket(track.duration_ms),
  ].join("|");
}

export function buildTrackReference(
  track: NowPlayingTrack | null | undefined
): TrackReference | null {
  if (!track?.track?.name) return null;

  return {
    source: track.source,
    provider_track_id: track.track.id ?? null,
    uri: track.track.uri ?? null,
    isrc: track.track.isrc ?? null,
    title_normalized: normalizeIdentityText(cleanTrackTitle(track.track.name)),
    artists_normalized: track.track.artists
      .map((artist) => normalizeArtistName(artist))
      .filter(Boolean),
    duration_ms: track.duration_ms ?? null,
  };
}

export function isTrackReferenceMatch(
  reference: TrackReference | null | undefined,
  track: NowPlayingTrack | null | undefined
) {
  if (!reference || !track?.track) return false;

  const liveRef = buildTrackReference(track);
  if (!liveRef) return false;

  const referenceIsrc = normalizeIdentityText(reference.isrc);
  const liveIsrc = normalizeIdentityText(liveRef.isrc);
  if (referenceIsrc && liveIsrc) {
    return referenceIsrc === liveIsrc;
  }

  if (reference.uri && liveRef.uri) {
    return reference.uri === liveRef.uri;
  }

  if (reference.provider_track_id && liveRef.provider_track_id) {
    return (
      reference.source === liveRef.source &&
      reference.provider_track_id === liveRef.provider_track_id
    );
  }

  const sameTitle = reference.title_normalized === liveRef.title_normalized;
  const samePrimaryArtist =
    (reference.artists_normalized[0] ?? "") ===
    (liveRef.artists_normalized[0] ?? "");
  const durationClose =
    reference.duration_ms == null ||
    liveRef.duration_ms == null ||
    Math.abs(reference.duration_ms - liveRef.duration_ms) <= 3000;

  return sameTitle && samePrimaryArtist && durationClose;
}

function buildLyricsQueries(trackName: string, artists: string[], albumName: string | null) {
  const primaryArtist = artists[0] ?? "";
  const cleanedTitle = cleanTrackTitle(trackName);
  const primary = `${primaryArtist} - ${cleanedTitle}`.trim().replace(/^-|-$/g, "").trim();
  const candidates = [
    primary,
    primaryArtist && trackName ? `${primaryArtist} - ${trackName}` : null,
    cleanedTitle && artists.length > 1 ? `${artists.slice(0, 2).join(", ")} - ${cleanedTitle}` : null,
    cleanedTitle && albumName ? `${primaryArtist} - ${cleanedTitle} (${albumName})` : null,
    cleanedTitle || null,
  ].filter((value): value is string => Boolean(value));

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    if (!seen.has(item)) {
      seen.add(item);
      deduped.push(item);
    }
  }

  return {
    primary: deduped[0] ?? null,
    fallbacks: deduped.slice(1),
  };
}

type AndroidNowPlayingPlugin = {
  getCurrentTrack(): Promise<unknown>;
  getPermissionStatus(): Promise<NowPlayingPermissionStatus>;
  openPermissionSettings(): Promise<void>;
};

const AndroidNowPlaying = registerPlugin<AndroidNowPlayingPlugin>("NowPlaying");

function debugAndroidNowPlayingBridge() {
  if (!isCapacitorApp()) return;

  const bridge = window.Capacitor?.Plugins?.NowPlaying;
  console.log("[now-playing][android] capacitor plugin bridge:", bridge);
}

function lyricsFromPayload(payload: any): NowPlayingLyrics | null {
  if (!payload || typeof payload !== "object") return null;

  const plain = payload.plainLyrics ?? payload.plain_lyrics ?? null;
  const synced = payload.syncedLyrics ?? payload.synced_lyrics ?? null;

  if (!plain && !synced) return null;

  return {
    provider: "lrclib",
    is_synced: Boolean(synced),
    plain,
    synced,
    language: payload.lang ?? null,
  };
}

async function fetchLyricsFromLrclib(
  trackName: string,
  artists: string[],
) {
  const base = "https://lrclib.net/api";
  const primaryArtist = artists[0];
  const cleanedTitle = cleanTrackTitle(trackName);

  if (!primaryArtist || !cleanedTitle) {
    return null;
  }

  const requests = [
    {
      track_name: cleanedTitle,
      artist_name: primaryArtist,
    },
    {
      track_name: trackName,
      artist_name: primaryArtist,
    },
    {
      track_name: cleanedTitle,
      artist_name: primaryArtist,
    },
  ];

  for (const params of requests) {
    const url = new URL(`${base}/get`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value != null) {
        url.searchParams.set(key, String(value));
      }
    });

    try {
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const lyrics = lyricsFromPayload(data);
      if (lyrics) return lyrics;
    } catch {}
  }

  try {
    const searchUrl = new URL(`${base}/search`);
    searchUrl.searchParams.set("query", `${primaryArtist} ${cleanedTitle}`.trim());
    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    for (const item of data) {
      const lyrics = lyricsFromPayload(item);
      if (lyrics) return lyrics;
    }
  } catch {}

  return null;
}

function withLyrics(track: NowPlayingTrack, lyrics: NowPlayingLyrics | null): NowPlayingTrack {
  return {
    ...track,
    lyrics,
  };
}

export async function enrichNowPlayingWithLyrics(track: NowPlayingTrack): Promise<NowPlayingTrack> {
  if (!track.track?.name || !track.track.artists.length) {
    return withLyrics(track, null);
  }

  const cacheKey = getLyricsCacheKey(track);

  if (!cacheKey) {
    return withLyrics(track, null);
  }

  if (lyricsCache.has(cacheKey)) {
    return withLyrics(track, lyricsCache.get(cacheKey) ?? null);
  }

  const inflight = lyricsInflight.get(cacheKey);
  if (inflight) {
    return withLyrics(track, await inflight);
  }

  const request = fetchLyricsFromLrclib(
    track.track.name,
    track.track.artists,
  )
    .then((lyrics) => {
      lyricsCache.set(cacheKey, lyrics);
      lyricsInflight.delete(cacheKey);
      return lyrics;
    })
    .catch(() => {
      lyricsInflight.delete(cacheKey);
      return null;
    });

  lyricsInflight.set(cacheKey, request);

  return withLyrics(track, await request);
}

function buildUnavailableTrack(source: string): NowPlayingTrack {
  return {
    available: false,
    source,
    is_playing: false,
    progress_ms: null,
    duration_ms: null,
    timestamp: null,
    track: null,
    device: null,
    source_query: {
      primary: null,
      fallbacks: [],
    },
    lyrics: null,
  };
}

function normalizeNativeTrack(payload: any, source: string): NowPlayingTrack {
  const trackName = payload?.track?.name ?? null;
  const artists = Array.isArray(payload?.track?.artists) ? payload.track.artists.filter(Boolean) : [];
  const album = payload?.track?.album ?? null;

  return {
    available: Boolean(trackName),
    source: payload?.source ?? source,
    is_playing: Boolean(payload?.is_playing),
    progress_ms: typeof payload?.progress_ms === "number" ? payload.progress_ms : null,
    duration_ms: typeof payload?.duration_ms === "number" ? payload.duration_ms : null,
    timestamp: typeof payload?.timestamp === "number" ? payload.timestamp : null,
    track: trackName
      ? {
          id: payload?.track?.id ?? null,
          uri: payload?.track?.uri ?? null,
          name: trackName,
          artists,
          album,
          image_url: payload?.track?.image_url ?? null,
          external_url: payload?.track?.external_url ?? null,
          isrc: payload?.track?.isrc ?? null,
        }
      : null,
    device: payload?.device ?? {
      name: null,
      type: source,
    },
    source_query: trackName
      ? buildLyricsQueries(trackName, artists, album)
      : { primary: null, fallbacks: [] },
    lyrics: null,
  };
}

export async function getNowPlayingPermissionStatus(): Promise<NowPlayingPermissionStatus> {
  const platform = getAppPlatform();

  if (isCapacitorApp()) {
    debugAndroidNowPlayingBridge();
    try {
      return await AndroidNowPlaying.getPermissionStatus();
    } catch (error) {
      console.error("[now-playing][android] getPermissionStatus failed:", error);
      return {
        platform,
        supported: false,
        granted: false,
        needs_user_action: false,
      };
    }
  }

  return {
    platform,
    supported: platform === "electron",
    granted: true,
    needs_user_action: false,
  };
}

export async function openNowPlayingPermissionSettings() {
  if (isCapacitorApp()) {
    try {
      await AndroidNowPlaying.openPermissionSettings();
    } catch (error) {
      console.error("[now-playing][android] openPermissionSettings failed:", error);
    }
  }
}

export async function getNowPlayingBasic(): Promise<NowPlayingTrack> {
  if (isElectronApp()) {
    const payload = await window.electronAPI?.getNowPlaying?.();
    if (!payload) {
      return buildUnavailableTrack("electron");
    }
    return normalizeNativeTrack(payload, "electron");
  }

  if (isCapacitorApp()) {
    debugAndroidNowPlayingBridge();
    let payload: unknown;

    try {
      payload = await AndroidNowPlaying.getCurrentTrack();
    } catch (error) {
      console.error("[now-playing][android] getCurrentTrack failed:", error);
      return buildUnavailableTrack("android");
    }

    if (!payload) {
      return buildUnavailableTrack("android");
    }
    return normalizeNativeTrack(payload, "android");
  }

  return buildUnavailableTrack("web");
}

export async function getNowPlaying(): Promise<NowPlayingTrack> {
  const track = await getNowPlayingBasic();
  return enrichNowPlayingWithLyrics(track);
}
