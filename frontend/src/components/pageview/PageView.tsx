import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import PageContent from "./PageContent";
import {
  addPageMetadata,
  deletePageMetadata,
  fetchPageDetail,
  getFavorites,
  getInstalled,
  lemmaLookup,
  setFavorite,
  updatePageMetadata,
} from "../../api";
import type { Annotation, LemmaData, TextAnalysisResult } from "../pageTypes";
import ResponsiveSideLayout from "../util/ResponsiveSideLayout";
import Desk from "../lemma_expansions/Desk";
import AnnotationView from "./AnnotationView";
import AnnotationNew from "./AnnotationNew";
import ArticulationPanel from "./ArticulationPanel";
import { useLayout } from "../RootLayout";
import { type Pack } from "../setting/PackTable";
import BlockingLoadingModal from "../util/BlockingLoadingModal";
import { isTrackReferenceMatch } from "../../nowPlaying";
import { useNowPlaying } from "../lyric/useNowPlaying";
import { getActiveTimedBlockIndex } from "../lyric/spotifyLyrics";
import { getLookupMorph } from "../tokenLookup";
import { useI18n } from "../../i18n";
import { isNetworkError } from "../../network";
import LanguagePackRequiredModal from "../util/LanguagePackRequiredModal";
import OfflineState from "../util/OfflineState";

const lemmaInfoCache = new Map<string, Record<string, LemmaData>>();
const lemmaAttemptedKeysCache = new Map<string, Set<string>>();
const LEMMA_PREFETCH_BLOCK_MARGIN = 8;

export type SidePanelState =
  | { type: "lemma"; data: LemmaData; language?: string }
  | { type: "annotation:new"; data: Annotation }
  | { type: "annotation:view"; data: Annotation }
  | {
      type: "articulation";
      data: {
        start_index: number;
        end_index: number;
        tokens: TextAnalysisResult["blocks"][number]["tokens"];
      };
    }
  | null;

export default function PageView() {
  const { t } = useI18n();
  const { id } = useParams();

  const [result, setResult] = useState<TextAnalysisResult | null>(null);
  const [lemmaInfo, setLemmaInfo] = useState<Record<string, any>>({});
  const [visibleBlockRange, setVisibleBlockRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingLemma, setLoadingLemma] = useState(false);
  const [offline, setOffline] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageName, setPageName] = useState("");
  const [pageSource, setPageSource] = useState("user");
  const [pageMetadata, setPageMetadata] = useState<string[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());

  const [panel, setPanel] = useState<SidePanelState>(null);
  const [panelPlacement, setPanelPlacement] = useState<
    "left" | "right" | null
  >(null);
  const [language, setLanguage] = useState<string | null>(null);

  const scrollRef = useRef<null | ((startIndex: number) => void)>(null);
  const location = useLocation();
  const annotationId = location.state?.annotationId;

  const { setTitlebarAction, setPanelOpen } = useLayout();

  const [noPack, setNoPack] = useState(false);
  const fetchedRef = useRef(false);
  const inflightLemmaKeysRef = useRef(new Set<string>());
  const activeLemmaPageKeyRef = useRef<string | null>(null);

  const lastPanelRef = useRef<SidePanelState>(null);
  const { progressMs, track } = useNowPlaying({
    enabled: Boolean(result?.blocks?.some((block) => block.timestamp_ms != null)),
  });

  useEffect(() => {
    if (panel) {
      lastPanelRef.current = panel;
    }
    setPanelOpen(panel !== null);
  }, [panel]);

  useEffect(() => {
    setTitlebarAction(() => {
      setPanel((prev) => {
        if (prev) return null;
        return lastPanelRef.current;
      });
    });

    return () => {
      setTitlebarAction(null);
    };
  }, []);

  // RESET ON PAGE CHANGE
  useEffect(() => {
    setResult(null);
    setLemmaInfo({});
    setAnnotations([]);
    setPageName("");
    setPageSource("user");
    setPageMetadata([]);
    setPanel(null);
    setLanguage(null);
    setNoPack(false);
    setVisibleBlockRange(null);
    setLoadingPage(true);
    setLoadingLemma(false);
    inflightLemmaKeysRef.current.clear();
    fetchedRef.current = false;
  }, [id, reloadTick]);

  // FETCH PAGE DATA
  useEffect(() => {
    if (!id) return;
    let active = true;
    const requestedPageId = Number(id);

    const run = async () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      setLoadingPage(true);
      setOffline(false);
      let lang = "";

      try {
        const detail = await fetchPageDetail(requestedPageId);
        if (!active) return;
        const resultData: TextAnalysisResult = detail.result;
        lang = detail.language;

        setResult(resultData);
        setPageName(detail.name ?? "");
        setPageSource(detail.source ?? "user");
        setPageMetadata(Array.isArray(detail.metadata) ? detail.metadata : []);
        setLanguage(lang);
        setAnnotations(
          Array.isArray(detail.annotations)
            ? detail.annotations.filter(
                (annotation) => annotation.page_id === requestedPageId,
              )
            : [],
        );
        setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
        const favorites = await getFavorites();
        if (!active) return;
        setFavoriteKeys(new Set(favorites));
      } catch (error) {
        if (!active) return;
        setOffline(isNetworkError(error));
        setLoadingPage(false);
        return;
      }

      const lemmaCacheKey = `${id}:${lang}`;
      const cachedLemmaInfo = lemmaInfoCache.get(lemmaCacheKey);
      if (cachedLemmaInfo) {
        setLemmaInfo(cachedLemmaInfo);
      }

      setLoadingPage(false);

      const installed = await getInstalled();
      if (!active) return;
      const pack = installed.find((l: Pack) => l.lang === lang);

      if (!pack?.lemma_installed) {
        setNoPack(true);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [id, reloadTick]);

  useEffect(() => {
    activeLemmaPageKeyRef.current =
      id && language ? `${id}:${language}` : null;
  }, [id, language]);

  useEffect(() => {
    if (!id || !result || !language || noPack || !visibleBlockRange) return;

    const lemmaCacheKey = `${id}:${language}`;
    const attemptedKeys =
      lemmaAttemptedKeysCache.get(lemmaCacheKey) ?? new Set<string>();

    if (!lemmaAttemptedKeysCache.has(lemmaCacheKey)) {
      lemmaAttemptedKeysCache.set(lemmaCacheKey, attemptedKeys);
    }

    const start = Math.max(0, visibleBlockRange.start - LEMMA_PREFETCH_BLOCK_MARGIN);
    const end = Math.min(
      result.blocks.length - 1,
      visibleBlockRange.end + LEMMA_PREFETCH_BLOCK_MARGIN,
    );

    const pendingItems: { lemma: string; pos: string }[] = [];
    const pendingKeys = new Set<string>();

    for (let blockIndex = start; blockIndex <= end; blockIndex += 1) {
      const block = result.blocks[blockIndex];

      block?.tokens?.forEach((token) => {
        const lookup = getLookupMorph(token, language);
        if (!lookup) return;

        const key = `${lookup.lemma}_${lookup.pos}`;
        if (lemmaInfo[key]) return;
        if (attemptedKeys.has(key)) return;
        if (inflightLemmaKeysRef.current.has(key)) return;
        if (pendingKeys.has(key)) return;

        pendingKeys.add(key);
        pendingItems.push(lookup);
      });
    }

    if (pendingItems.length === 0) return;

    pendingKeys.forEach((key) => inflightLemmaKeysRef.current.add(key));
    setLoadingLemma(true);

    void lemmaLookup(pendingItems, language)
      .then((lookupData) => {
        pendingKeys.forEach((key) => attemptedKeys.add(key));
        const cached = lemmaInfoCache.get(lemmaCacheKey) ?? {};
        const next = { ...cached, ...lookupData };
        lemmaInfoCache.set(lemmaCacheKey, next);

        if (activeLemmaPageKeyRef.current === lemmaCacheKey) {
          setLemmaInfo((prev) => ({ ...prev, ...lookupData }));
        }
      })
      .catch(() => {
        // Keep keys retriable on request failure.
      })
      .finally(() => {
        pendingKeys.forEach((key) => inflightLemmaKeysRef.current.delete(key));
        if (activeLemmaPageKeyRef.current === lemmaCacheKey) {
          setLoadingLemma(inflightLemmaKeysRef.current.size > 0);
        }
      });
  }, [id, language, lemmaInfo, noPack, result, visibleBlockRange]);

  // ANNOTATION SCROLL + PANEL
  useEffect(() => {
    if (!id) return;
    if (!annotationId) return;
    if (annotations.length === 0) return;

    const ann = annotations.find((a) => a.id === annotationId);
    if (!ann) return;

    if (ann.type !== "emoji") {
      setPanel({
        type: "annotation:view",
        data: ann,
      });
    }

    requestAnimationFrame(() => {
      scrollRef.current?.(ann.start_index);
    });
  }, [id, annotationId, annotations]);

  const onFavoriteClick = async (key: string, next: boolean) => {
    await setFavorite(key, next);
    setFavoriteKeys(new Set(await getFavorites()));
  };

  const trackReference = result?.track_ref ?? null;
  const loadingMessage = loadingPage
    ? t("Fetching page...")
    : null;
  const shouldSyncTimedBlocks =
    Boolean(trackReference) &&
    Boolean(track?.is_playing) &&
    isTrackReferenceMatch(trackReference, track);
  const lyricMotionActive =
    pageSource === "lrclib" && shouldSyncTimedBlocks;

  const activeLyricBlockIndex = getActiveTimedBlockIndex(
    result?.blocks ?? [],
    lyricMotionActive ? progressMs : null
  );

  const handleAddMetadata = async (value: string) => {
    if (!id) return;
    const data = await addPageMetadata(Number(id), value);
    setPageMetadata(data.metadata);
  };

  const handleUpdateMetadata = async (metadataIndex: number, value: string) => {
    if (!id) return;
    const data = await updatePageMetadata(Number(id), metadataIndex, value);
    setPageMetadata(data.metadata);
  };

  const handleDeleteMetadata = async (metadataIndex: number) => {
    if (!id) return;
    const data = await deletePageMetadata(Number(id), metadataIndex);
    setPageMetadata(data.metadata);
  };

  const panelRestoreKey =
    panel?.type === "lemma"
      ? `lemma:${panel.data.key}`
      : panel?.type === "annotation:view"
        ? `annotation:view:${panel.data.id ?? "unknown"}`
      : panel?.type === "annotation:new"
        ? `annotation:new:${panel.data.type}:${panel.data.start_index}:${panel.data.end_index}`
        : panel?.type === "articulation"
          ? `articulation:${panel.data.start_index}:${panel.data.end_index}`
          : null;

  return (
    <div className="relative w-full h-full flex justify-center bg-neutral-50">
      <BlockingLoadingModal
        open={loadingMessage !== null}
        message={loadingMessage ?? ""}
        usePortal={false}
      />

      {offline && !result ? (
        <OfflineState onRetry={() => {
          fetchedRef.current = false;
          setLoadingPage(true);
          setOffline(false);
          setReloadTick((prev) => prev + 1);
        }} />
      ) : null}

      {offline && result ? (
        <div className="absolute left-3 top-3 z-40 text-xs text-neutral-400 md:left-6">
          {t("You're offline.")}
        </div>
      ) : null}

      <LanguagePackRequiredModal
        language={language ?? ""}
        open={noPack && language !== null}
        onClose={() => setNoPack(false)}
      />

      {result && (
        <>
          <div
            className="absolute w-full h-12 z-30 inset-0 backdrop-blur-lg"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.4) 70%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.4) 70%, transparent 100%)",
            }}
          />

          <div
            className="relative flex h-full w-full min-h-0 overflow-hidden transition-[padding] duration-300 ease-out"
            // style={{
            //   paddingLeft:
            //     panelPlacement === "left" ? PAGE_VIEW_PANEL_EDGE_PADDING : 0,
            //   paddingRight:
            //     panelPlacement === "right" ? PAGE_VIEW_PANEL_EDGE_PADDING : 0,
            //   boxSizing: "border-box",
            // }}
          >
            <PageContent
              key={id}
              blocks={result.blocks}
              activeLyricBlockIndex={activeLyricBlockIndex}
              syncPlaybackActive={lyricMotionActive}
              lemmaInfo={lemmaInfo}
              onVisibleBlockRangeChange={setVisibleBlockRange}
              annotations={annotations}
              pageName={pageName}
              pageSource={pageSource}
              pageMetadata={pageMetadata}
              onAddMetadata={offline || Number(id) < 0 ? undefined : handleAddMetadata}
              onUpdateMetadata={offline || Number(id) < 0 ? undefined : handleUpdateMetadata}
              onDeleteMetadata={offline || Number(id) < 0 ? undefined : handleDeleteMetadata}
              pageId={Number(id)}
              panelData={panel}
              language={language ?? ""}
              setPanelData={setPanel}
              scrollRef={(fn) => (scrollRef.current = fn)}
              setAnnotations={setAnnotations}
              offline={offline}
              horizontalAlign={
                panelPlacement === "left"
                  ? "right"
                  : panelPlacement === "right"
                    ? "left"
                    : "center"
              }
            />
          </div>

          <ResponsiveSideLayout
            open={panel !== null}
            onClose={() => setPanel(null)}
            restoreKey={panelRestoreKey}
            onDesktopPlacementChange={setPanelPlacement}
          >
            {panel?.type === "lemma" && language && (
              <Desk
                key={panel.data.key}
                initialLemma={panel.data}
                onToggleFavorite={onFavoriteClick}
                language={panel.language ?? language}
                lemmaInfo={lemmaInfo}
                favoriteKeys={favoriteKeys}
              />
            )}

            {language && panel?.type === "annotation:view" && (
              <AnnotationView
                panel={panel}
                setPanel={setPanel}
                setAnnotations={setAnnotations}
                pageLanguage={language}
                offline={offline}
              />
            )}

            {language && panel?.type === "annotation:new" && (
              <AnnotationNew
                panel={panel}
                setAnnotations={setAnnotations}
                setPanelData={setPanel}
                pageLanguage={language}
              />
            )}

            {language && panel?.type === "articulation" && (
              <ArticulationPanel
                language={language}
                tokens={panel.data.tokens ?? []}
              />
            )}
          </ResponsiveSideLayout>

          {loadingLemma && !loadingPage && !noPack && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-50/90 px-3 py-1 text-xs text-neutral-500 shadow-sm backdrop-blur-sm">
              {t("Fetching lemmas...")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
