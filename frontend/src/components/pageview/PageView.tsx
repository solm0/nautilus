import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PageContent from "./PageContent";
import {
  CENTRAL_API,
  addPageMetadata,
  deletePageMetadata,
  getInstalled,
  lemmaLookup,
  setFavorite,
  updatePageMetadata,
} from "../../api";
import type { Annotation, LemmaData, OCRResponse } from "../pageTypes";
import ResponsiveSideLayout from "../util/ResponsiveSideLayout";
import Desk from "../lemma_expansions/Desk";
import AnnotationView from "./AnnotationView";
import AnnotationNew from "./AnnotationNew";
import ArticulationPanel from "./ArticulationPanel";
import PatternPanel from "./PatternPanel";
import { useLayout } from "../RootLayout";
import { LANG_MAP, type Pack } from "../setting/PackTable";
import Button from "../util/Button";
import BlockingLoadingModal from "../util/BlockingLoadingModal";
import { isCapacitorApp } from "../../platform";
import { isTrackReferenceMatch } from "../../nowPlaying";
import { useNowPlaying } from "../lyric/useNowPlaying";
import { getActiveTimedBlockIndex } from "../lyric/spotifyLyrics";
import { getLookupMorph } from "../tokenLookup";

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
        tokens: OCRResponse["blocks"][number]["tokens"];
      };
    }
  | {
      type: "pattern";
      data: {
        start_index: number;
        end_index: number;
        tokens: OCRResponse["blocks"][number]["tokens"];
      };
    }
  | null;

export default function PageView() {
  const mobileApp = isCapacitorApp();
  const { id } = useParams();

  const [result, setResult] = useState<OCRResponse | null>(null);
  const [lemmaInfo, setLemmaInfo] = useState<Record<string, any>>({});
  const [visibleBlockRange, setVisibleBlockRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingLemma, setLoadingLemma] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageName, setPageName] = useState("");
  const [pageSource, setPageSource] = useState("user");
  const [pageMetadata, setPageMetadata] = useState<string[]>([]);

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
  const navigate = useNavigate();

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
  }, [id]);

  // FETCH PAGE DATA
  useEffect(() => {
    if (!id) return;

    const run = async () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      const token = localStorage.getItem("token");

      setLoadingPage(true);

      const res = await fetch(`${CENTRAL_API}/pages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setLoadingPage(false);
        return;
      }

      const data = await res.json();
      const resultData: OCRResponse = data.result;
      const lang = data.language;

      setResult(resultData);
      setPageName(data.name ?? "");
      setPageSource(data.source ?? "user");
      setPageMetadata(Array.isArray(data.metadata) ? data.metadata : []);
      setLanguage(lang);

      const lemmaCacheKey = `${id}:${lang}`;
      const cachedLemmaInfo = lemmaInfoCache.get(lemmaCacheKey);
      if (cachedLemmaInfo) {
        setLemmaInfo(cachedLemmaInfo);
      }

      const annRes = await fetch(`${CENTRAL_API}/pages/${id}/annotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (annRes.ok) {
        const annData = await annRes.json();
        setAnnotations(annData);
      }

      setLoadingPage(false);

      const installed = await getInstalled();
      const pack = installed.find((l: Pack) => l.lang === lang);

      if (!pack?.installed) {
        setNoPack(true);
      }
    };

    run();
  }, [id]);

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
  };

  const trackReference = result?.track_ref ?? null;
  const loadingMessage = loadingPage
    ? "Fetching page..."
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
            : panel?.type === "pattern"
              ? `pattern:${panel.data.start_index}:${panel.data.end_index}`
          : null;

  return (
    <div className="relative w-full h-full flex justify-center bg-neutral-50">
      <BlockingLoadingModal
        open={loadingMessage !== null}
        message={loadingMessage ?? ""}
      />

      {noPack && (
        <div className="absolute z-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-10 bg-neutral-50 rounded-xl shadow-lg flex flex-col gap-7">
          <p>
            {mobileApp ? "Activate " : "Install "}
            {language ? LANG_MAP[language] ?? language : null}
            {mobileApp ? " to continue." : " pack to continue."}
          </p>
          <Button text="Go to settings" onClick={()=>navigate('/setting')} fit black />
        </div>
      )}

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
            style={{
              paddingLeft:
                panelPlacement === "left" ? "min(18rem, 18vw)" : 0,
              paddingRight:
                panelPlacement === "right" ? "min(18rem, 18vw)" : 0,
              boxSizing: "border-box",
            }}
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
              onAddMetadata={handleAddMetadata}
              onUpdateMetadata={handleUpdateMetadata}
              onDeleteMetadata={handleDeleteMetadata}
              pageId={Number(id)}
              panelData={panel}
              language={language ?? ""}
              setPanelData={setPanel}
              scrollRef={(fn) => (scrollRef.current = fn)}
              setAnnotations={setAnnotations}
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
              />
            )}

            {language && panel?.type === "annotation:view" && (
              <AnnotationView
                panel={panel}
                setPanel={setPanel}
                setAnnotations={setAnnotations}
                pageLanguage={language}
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

            {language && panel?.type === "pattern" && (
              <PatternPanel
                language={language}
                tokens={panel.data.tokens ?? []}
                setPanelData={setPanel}
              />
            )}
          </ResponsiveSideLayout>

          {loadingLemma && !loadingPage && !noPack && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-50/90 px-3 py-1 text-xs text-neutral-500 shadow-sm backdrop-blur-sm">
              Fetching lemmas...
            </div>
          )}
        </>
      )}
    </div>
  );
}
