import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEventHandler,
  ReactNode,
  RefObject,
} from "react";
import type { Token, OCRBlock, LemmaData } from "./pageTypes";
import { useSettings, type AppSettings } from "./useSettings";
import { Check, Ellipsis, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { MiniPopup } from "./util/MiniPopup";
import { IconButton } from "./util/Button";

/* =========================================================
 CONFIG
========================================================= */

const HIGHLIGHT_CONFIG = {
  mergeGap: 14,

  blob: {
    padX: 12,
    padY: -4,
    wobbleX: 5,
    wobbleY: 5,
  },

  fill: {
    opacity: 0.34,
    blur: 5.5,
  },

  edge: {
    opacity: 0.08,
    width: 1.3,
    blur: 0.9,
  },

  metaball: {
    opacity: 0.34,
    blur: 6,
    alphaBoost: 29,
    alphaCutoff: -9,
  },
};

type TokenRenderProps = HTMLAttributes<HTMLSpanElement> & {
  className?: string;
  style?: CSSProperties;
};

type HighlightPalette = {
  fill: string;
  edge: string;
};

type HighlightBlob = {
  key: string;
  fill: string;
  edge: string;
  x: number;
  y: number;
  width: number;
  height: number;
  seed: number;
  lineCenter: number;
  right: number;
  blockIndex: number;
  syncOpacity: number;
};

const POS_HIGHLIGHTS: Record<string, HighlightPalette> = {
  root: { fill: "var(--color-nt-blue)", edge: "var(--color-nt-blue)" },
  nsubj: { fill: "var(--color-nt-teal)", edge: "var(--color-nt-teal)" },
  obj: { fill: "var(--color-nt-coral)", edge: "var(--color-nt-coral)" },
  iobj: { fill: "var(--color-nt-coral)", edge: "var(--color-nt-coral)" },
};

const DEP_SETTING_MAP = {
  nsubj: "highlight_nsubj",
  root: "highlight_root",
  obj: "highlight_obj",
  iobj: "highlight_obj",
} as const;

function getHighlightPalette(
  dep: string | null | undefined,
  settings: AppSettings
) {
  if (!dep) return null;

  const settingKey =
    DEP_SETTING_MAP[
      dep as keyof typeof DEP_SETTING_MAP
    ];

  if (!settingKey) return null;

  if (!settings[settingKey]) {
    return null;
  }

  return POS_HIGHLIGHTS[dep] ?? null;
}

function hashSeed(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function noise(seed: number, offset: number) {
  const value =
    Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function wobble(seed: number, offset: number, amplitude: number) {
  return (noise(seed, offset) - 0.5) * amplitude * 2;
}

function buildBlobPath(blob: HighlightBlob) {
  const cfg = HIGHLIGHT_CONFIG.blob;

  const padX = cfg.padX;
  const padY = cfg.padY;

  const left =
    blob.x -
    padX +
    wobble(blob.seed, 1, cfg.wobbleX);

  const right =
    blob.x +
    blob.width +
    padX +
    wobble(blob.seed, 2, cfg.wobbleX);

  const top =
    blob.y -
    padY +
    wobble(blob.seed, 3, cfg.wobbleY);

  const bottom =
    blob.y +
    blob.height +
    padY +
    wobble(blob.seed, 4, cfg.wobbleY);

  const middleX = (left + right) / 2;
  const middleY = (top + bottom) / 2;

  return `
    M ${left + 12},${top}
    Q ${middleX},${top - 3} ${right - 12},${top}
    Q ${right + 3},${middleY} ${right - 10},${bottom}
    Q ${middleX},${bottom + 3} ${left + 10},${bottom}
    Q ${left - 3},${middleY} ${left + 12},${top}
    Z
  `;
}

function mergeHighlights(highlights: HighlightBlob[]) {
  const sorted = [...highlights].sort((a, b) =>
    a.y === b.y ? a.x - b.x : a.y - b.y
  );

  const merged: HighlightBlob[] = [];

  for (const highlight of sorted) {
    const current = merged.at(-1);

    const gap = current
      ? highlight.x - current.right
      : Number.POSITIVE_INFINITY;

    const sameLine =
      current &&
      Math.abs(
        current.lineCenter - highlight.lineCenter
      ) <=
        Math.max(current.height, highlight.height) *
          0.55;

    const sameColor =
      current &&
      current.fill === highlight.fill;

    if (
      current &&
      sameLine &&
      sameColor &&
      gap <= HIGHLIGHT_CONFIG.mergeGap
    ) {
      const nextRight = Math.max(
        current.right,
        highlight.right
      );

      const nextBottom = Math.max(
        current.y + current.height,
        highlight.y + highlight.height
      );

      current.x = Math.min(current.x, highlight.x);
      current.y = Math.min(current.y, highlight.y);

      current.width = nextRight - current.x;
      current.height = nextBottom - current.y;

      current.right = nextRight;

      current.lineCenter =
        current.y + current.height / 2;

      current.key += `-${highlight.key}`;
      current.syncOpacity = Math.min(
        current.syncOpacity,
        highlight.syncOpacity
      );

      continue;
    }

    merged.push({ ...highlight });
  }

  return merged;
}

function getLyricLineVisualState(
  blockIndex: number,
  activeLyricBlockIndex: number,
  syncPlaybackActive: boolean,
  lemmaInfoOpen: boolean
) {
  if (!syncPlaybackActive || activeLyricBlockIndex < 0) {
    return {
      blockOpacity: 1,
      blockMinHeightClass: "",
      blockAlignClass: "",
      blockPaddingClass: "",
      tokenSizeClass: "",
      tokenPaddingClass: "",
      highlightOpacity: 1,
    };
  }

  const isActiveLine = blockIndex === activeLyricBlockIndex;

  if (isActiveLine) {
    return {
      blockOpacity: 1,
      blockMinHeightClass: lemmaInfoOpen ? "min-h-[7.5em]" : "min-h-[5.8em]",
      blockAlignClass: "items-center content-center",
      blockPaddingClass: lemmaInfoOpen ? "py-28" : "py-18",
      tokenSizeClass: "!text-[24px] md:!text-[28px]",
      tokenPaddingClass: "",
      highlightOpacity: 1,
    };
  }

  return {
    blockOpacity: 0.6,
    blockMinHeightClass: "",
    blockAlignClass: "",
    blockPaddingClass: "",
    tokenSizeClass: "",
    tokenPaddingClass: "",
    highlightOpacity: 0.5,
  };
}

function TokenHighlightOverlay({
  pageId,
  containerRef,
  blocks,
  activeLyricBlockIndex,
  syncPlaybackActive,
}: {
  pageId?: number;
  containerRef: RefObject<HTMLDivElement | null>;
  blocks: OCRBlock[];
  activeLyricBlockIndex: number;
  syncPlaybackActive: boolean;
}) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });
  const { settings } = useSettings();

  const [highlights, setHighlights] = useState<
    HighlightBlob[]
  >([]);

  const filterId = useId();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scheduled = false;

    const measureNow = () => {
      const containerRect =
        container.getBoundingClientRect();

      const nextHighlights = mergeHighlights(
        Array.from(
          container.querySelectorAll<HTMLSpanElement>(
            "[data-token-highlight='true']"
          )
        ).flatMap((node) => {
          const palette = getHighlightPalette(
            node.dataset.tokenDep,
            settings
          );

          if (!palette) return [];

          const rect = node.getBoundingClientRect();
          const blockNode = node.closest<HTMLElement>(
            "[data-block-index]"
          );
          const blockIndex = Number(
            blockNode?.dataset.blockIndex ?? -1
          );

          const index = Number(
            node.dataset.idx ?? -1
          );

          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            index < 0 ||
            blockIndex < 0
          ) {
            return [];
          }

          const visualState = getLyricLineVisualState(
            blockIndex,
            activeLyricBlockIndex,
            syncPlaybackActive,
            settings.lemma_info
          );

          return [
            {
              key: `${index}`,
              fill: palette.fill,
              edge: palette.edge,
              x:
                rect.left -
                containerRect.left +
                container.scrollLeft,

              y:
                rect.top -
                containerRect.top +
                container.scrollTop,
              width: rect.width,
              height: rect.height,
              seed: hashSeed(
                `${index}:${node.dataset.tokenDep}`
              ),
              lineCenter:
                rect.top -
                containerRect.top +
                rect.height / 2,
              right:
                rect.left -
                containerRect.left +
                rect.width,
              blockIndex,
              syncOpacity:
                visualState.highlightOpacity,
            },
          ];
        })
      );

      setHighlights(nextHighlights);

      setSize({
        width: Math.ceil(containerRect.width),
        height: Math.ceil(container.scrollHeight),
      });
    };

    const scheduleMeasure = () => {
      if (scheduled) return;
      scheduled = true;

      // double rAF
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {  // ← 추가
          scheduled = false;
          measureNow();
        });
      });
    };

    scheduleMeasure();

    const resizeObserver = new ResizeObserver(
      scheduleMeasure
    );

    resizeObserver.observe(container);

    const observedNodes = new Set<Element>();

    const observeTokens = () => {
      const tokenNodes =
        container.querySelectorAll<HTMLSpanElement>(
          "[data-token-highlight='true']"
        );

      tokenNodes.forEach((node) => {
        if (observedNodes.has(node)) return;

        observedNodes.add(node);
        resizeObserver.observe(node);
      });
    };

    const mutationObserver = new MutationObserver(() => {
      observeTokens();
      scheduleMeasure();
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    window.addEventListener(
      "resize",
      scheduleMeasure
    );

    if ("fonts" in document) {
      void document.fonts.ready.then(
        scheduleMeasure
      );

      document.fonts.addEventListener(
        "loadingdone",
        scheduleMeasure
      );
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();

      window.removeEventListener(
        "resize",
        scheduleMeasure
      );

      if ("fonts" in document) {
        document.fonts.removeEventListener(
          "loadingdone",
          scheduleMeasure
        );
      }
    };
  }, [pageId, blocks, containerRef.current, settings, activeLyricBlockIndex, syncPlaybackActive]);

  return (
    <svg
      aria-hidden="true"
      className="shrink-0 pointer-events-none absolute inset-0 z-0 overflow-visible -translate-y-0.5"
      style={{

    overflow: "visible",

    contain: "layout paint size",

  }}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
    >
      <defs>
        {/* metaball-ish union */}
        <filter
          id={`${filterId}-goo`}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={
              HIGHLIGHT_CONFIG.metaball.blur
            }
            result="blur"
          />

          <feColorMatrix
            in="blur"
            mode="matrix"
            values={`
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 ${HIGHLIGHT_CONFIG.metaball.alphaBoost} ${HIGHLIGHT_CONFIG.metaball.alphaCutoff}
            `}
            result="goo"
          />

          <feBlend
            in="SourceGraphic"
            in2="goo"
          />
        </filter>

        <filter
          id={`${filterId}-edge`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur
            stdDeviation={
              HIGHLIGHT_CONFIG.edge.blur
            }
          />
        </filter>
      </defs>

      {/* unified fill layer */}
      <g
        filter={`url(#${filterId}-goo)`}
        opacity={HIGHLIGHT_CONFIG.metaball.opacity}
      >
        {highlights.map((highlight) => {
          const d = buildBlobPath(highlight);

          return (
            <path
              key={highlight.key}
              d={d}
              fill={highlight.fill}
              fillOpacity={
                HIGHLIGHT_CONFIG.fill.opacity *
                highlight.syncOpacity
              }
            />
          );
        })}
      </g>

      {/* unified edge layer */}
      <g
        style={{
          mixBlendMode: "screen",
        }}
      >
        {highlights.map((highlight) => {
          const d = buildBlobPath(highlight);

          return (
            <path
              key={`${highlight.key}-edge`}
              d={d}
              fill="none"
              stroke={highlight.edge}
              strokeWidth={
                HIGHLIGHT_CONFIG.edge.width
              }
              strokeOpacity={
                HIGHLIGHT_CONFIG.edge.opacity *
                highlight.syncOpacity
              }
              filter={`url(#${filterId}-edge)`}
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

/* =========================================================
 PAGE
========================================================= */

export default function PageCore({
  pageId,
  pageName,
  pageSource,
  metadataItems,
  onAddMetadata,
  onUpdateMetadata,
  onDeleteMetadata,
  blocks,
  containerRef,
  scrollContainerRef,
  activeLyricBlockIndex = -1,
  syncPlaybackActive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  getTokenProps,
  rightAside,
  overlay,
  lemmaInfo,
  wrapperStyle,
}: {
  pageId?: number;
  pageName?: string;
  pageSource?: string;
  metadataItems?: string[];
  onAddMetadata?: (value: string) => Promise<void>;
  onUpdateMetadata?: (index: number, value: string) => Promise<void>;
  onDeleteMetadata?: (index: number) => Promise<void>;
  blocks: OCRBlock[];
  containerRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  activeLyricBlockIndex?: number;
  syncPlaybackActive?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: PointerEventHandler<HTMLDivElement>;
  lemmaInfo?: Record<string, LemmaData>;
  getTokenProps?: (args: {
    token: Token;
    index: number;
  }) => TokenRenderProps;
  rightAside?: ReactNode;
  overlay?: ReactNode;
  wrapperStyle?: CSSProperties;
}) {
  let globalIndex = 0;

  const { settings } = useSettings();
  const [openMetadataMenuId, setOpenMetadataMenuId] = useState<string | null>(null);
  const [draftMetadata, setDraftMetadata] = useState("");
  const [editingMetadataIndex, setEditingMetadataIndex] = useState<number | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const isLyricPage = pageSource === "lrclib";

  const safeMetadataItems = metadataItems ?? [];
  const canManageMetadata = Boolean(pageId && onAddMetadata && onUpdateMetadata && onDeleteMetadata);

  useEffect(() => {
    setDraftMetadata("");
    setEditingMetadataIndex(null);
    setOpenMetadataMenuId(null);
    setSavingMetadata(false);
  }, [pageId, JSON.stringify(safeMetadataItems)]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function clearMetadataLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function handleSaveMetadata() {
    if (!canManageMetadata || !pageId) return;

    const nextValue = draftMetadata.trim();
    if (!nextValue) return;

    setSavingMetadata(true);

    try {
      if (editingMetadataIndex == null || editingMetadataIndex < 0) {
        await onAddMetadata?.(nextValue);
      } else {
        await onUpdateMetadata?.(editingMetadataIndex, nextValue);
      }

      setDraftMetadata("");
      setEditingMetadataIndex(null);
      setOpenMetadataMenuId(null);
    } finally {
      setSavingMetadata(false);
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      className="relative flex h-full min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden no-scrollbar"
      style={wrapperStyle}
    >
      
      <div
        ref={containerRef}
        className={`relative flex min-h-full w-full flex-col isolate items-center ${
          pageId ? "px-4 md:px-6 pt-20 md:pt-40" : 'p-3'
        } ${settings.lemma_info ? `${syncPlaybackActive ? 'gap-y-28':'gap-y-5'}` : `${syncPlaybackActive ? 'gap-y-5':''}`}`}
        style={{
          userSelect: "none",
          overflowAnchor: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {pageId ? (
          <div
            data-page-header="true"
            className={`
              flex w-full max-w-[48em] flex-col gap-14 pb-14 select-text font-source
              ${pageSource === 'lrclib' ? 'items-start text-left' : 'items-center text-center'}
            `}
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          >

            <h1 className="w-full text-4xl select-text">
              {pageName?.trim() || "Untitled page"}
            </h1>

            {/* metadata */}
            <div className={`flex flex-col gap-2 text-sm ${pageSource === 'lrclib' ? 'items-start' : 'items-center'} `}>
              {pageSource && pageSource !== 'user' ? (
                <div className="flex flex-col gap-1 pb-6">
                  <span className="text-xs">Source</span>
                  <span className="uppercase">{pageSource}</span>
                </div>
              ) : null}

              {safeMetadataItems.map((item, index) => {
                const popupId = `metadata-${index}`;
                const isEditing = editingMetadataIndex === index;

                return (
                  <div
                    key={`${item}-${index}`}
                    className={`
                      group relative flex flex-col gap-1 py-1 transition-all
                      ${isEditing ? 'bg-neutral-200/50' : 'hover:bg-neutral-200/50'}
                      ${pageSource === 'lrclib' ? 'px-0' : 'px-2'}
                    `}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (!canManageMetadata || !isCoarsePointer || isEditing) return;

                      clearMetadataLongPress();
                      longPressTimerRef.current = window.setTimeout(() => {
                        setOpenMetadataMenuId(popupId);
                      }, 400);
                    }}
                    onPointerUp={() => clearMetadataLongPress()}
                    onPointerLeave={() => clearMetadataLongPress()}
                    onPointerCancel={() => clearMetadataLongPress()}
                  >
                    {isEditing ? (
                      <div className={`flex flex-col gap-2 px-3 py-2 ${pageSource === 'lrclib' ? 'items-start text-left' : 'items-center text-center'}`}>
                        <textarea
                          className={`min-w-[12em] bg-transparent focus:outline-none ${pageSource === 'lrclib' ? 'text-left' : 'text-center'} resize-none`}
                          value={draftMetadata}
                          onChange={(event) => setDraftMetadata(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleSaveMetadata();
                            }
                            if (event.key === "Escape") {
                              setEditingMetadataIndex(null);
                              setDraftMetadata("");
                              setOpenMetadataMenuId(null);
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <IconButton
                            icon={<Check size={14} />}
                            disabled={savingMetadata}
                            onClick={() => void handleSaveMetadata()}
                          />
                          <IconButton
                            icon={<X size={14} />}
                            disabled={savingMetadata}
                            onClick={() => {
                            setEditingMetadataIndex(null);
                            setDraftMetadata("");
                            setOpenMetadataMenuId(null);
                          }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col ${pageSource === 'lrclib' ? 'items-start text-left' : 'items-center text-center'}`}>
                        {item.startsWith('https://')
                          ? (
                            <a href={item} className="underline underline-offset-3 hover:text-neutral-400 transition-colors" target="_blank">{item}</a>
                          ) : (
                            <span className="select-text" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
                              {item}
                            </span>
                          )
                        }
                        
                        {canManageMetadata ? (
                          <div className="relative font-pretendard">
                            <div className="group-hover:opacity-100 opacity-0">
                              <IconButton
                                icon={<Ellipsis size={13} />}
                                onClick={() => {
                                  setOpenMetadataMenuId((current) =>
                                    current === popupId ? null : popupId
                                  );
                                }}
                              />
                            </div>
                            
                            <MiniPopup
                              open={openMetadataMenuId === popupId}
                              onClose={() => setOpenMetadataMenuId(null)}
                              left
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-100"
                                onClick={() => {
                                  setEditingMetadataIndex(index);
                                  setDraftMetadata(item);
                                  setOpenMetadataMenuId(null);
                                }}
                              >
                                <Pencil size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
                                onClick={() => {
                                  setOpenMetadataMenuId(null);
                                  void onDeleteMetadata?.(index);
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </MiniPopup>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              {canManageMetadata &&
              safeMetadataItems.length < 5 &&
              editingMetadataIndex == null ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftMetadata("");
                    setEditingMetadataIndex(-1);
                  }}
                  className="flex items-center gap-2 border border-dashed border-neutral-300 px-3 py-2 text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-700"
                >
                  <Plus size={14} />
                  <span>Add metadata</span>
                </button>
              ) : null}

              {canManageMetadata && editingMetadataIndex === -1 ? (
                <div className={`flex flex-col gap-2 bg-neutral-200/50 px-3 py-2 ${pageSource === 'lrclib' ? 'items-start text-left' : 'items-center text-center'}`}>
                  <textarea
                    className={`min-w-[12em] focus:outline-none ${pageSource === 'lrclib' ? 'text-left' : 'text-center'} resize-none`}
                    placeholder="Add metadata"
                    value={draftMetadata}
                    onChange={(event) => setDraftMetadata(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleSaveMetadata();
                      }
                      if (event.key === "Escape") {
                        setEditingMetadataIndex(null);
                        setDraftMetadata("");
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <IconButton
                      icon={<Check size={14} />}
                      disabled={savingMetadata}
                      onClick={() => void handleSaveMetadata()}
                    />
                    <IconButton
                      icon={<X size={14} />}
                      disabled={savingMetadata}
                      onClick={() => {
                      setEditingMetadataIndex(null);
                      setDraftMetadata("");
                    }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            
          </div>
        ) : null}

        {blocks.map((block, blockIndex) => (
          (() => {
            const visualState = getLyricLineVisualState(
              blockIndex,
              activeLyricBlockIndex,
              syncPlaybackActive,
              settings.lemma_info
            );
            const previousBlock = blockIndex > 0
              ? blocks[blockIndex - 1]
              : null;
            const previousBlockHasTokens =
              (previousBlock?.tokens?.length ?? 0) > 0;
            const shouldIndentFirstLine =
              pageSource !== "lrclib" &&
              blockIndex > 0 &&
              previousBlockHasTokens;

            return (
          <div
            key={blockIndex}
            data-block-index={blockIndex}
            data-lyric-line={block.timestamp_ms != null ? "true" : "false"}
            className={`
              relative z-1 flex w-full max-w-[48em] flex-wrap content-start justify-between
              after:basis-0 after:flex-auto after:content-['']
              transition-all duration-300 origin-left
              ${block.tokens?.length === 0 && 'h-[1.7em] shrink-0'}
              ${visualState.blockMinHeightClass}
              ${visualState.blockAlignClass}
              ${visualState.blockPaddingClass}
            `}
            style={{
              opacity: visualState.blockOpacity,
            }}
          >
            {block.tokens?.map((token, tokenPosition) => {
              const tokenIndex = globalIndex++;

              const tokenProps =
                getTokenProps?.({
                  token,
                  index: tokenIndex,
                }) ?? {};

              const {
                className,
                style,
                ...restTokenProps
              } = tokenProps;

              const highlightPalette =
                getHighlightPalette(token.dep, settings);

              return (
                <span
                  key={tokenIndex}
                  data-idx={tokenIndex}
                  data-token-dep={token.dep ?? ""}
                  data-token-highlight={
                    highlightPalette
                      ? "true"
                      : "false"
                  }
                  className={[
                    "relative z-10 flex flex-col px-1",
                    settings.lemma_info && pageId
                      ? "min-h-[4em] h-auto gap-1"
                      : isLyricPage
                        ? "h-auto min-h-[1.6em] gap-0 justify-center"
                      : pageId
                        ? "min-h-[1.5em] h-auto gap-0"
                        : "",
                    pageId ? "transition-all" : "",
                    visualState.tokenSizeClass,
                    visualState.tokenPaddingClass,
                    className,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    ...(shouldIndentFirstLine && tokenPosition === 0
                      ? { marginInlineStart: "2em" }
                      : {}),
                    ...style,
                  }}
                  {...restTokenProps}
                >
                  <span className="grid">
                    <span
                      aria-hidden="true"
                      className="invisible col-start-1 row-start-1 font-[500]"
                    >
                      {token.surface}
                    </span>
                    <span className="col-start-1 row-start-1">
                      {token.surface}
                    </span>
                  </span>
                  <div
                    className={`
                      flex-col text-xs font-normal font-pretendard
                      ${settings.lemma_info
                        ? "flex w-max opacity-80 transition-opacity duration-700"
                        : "max-h-0 w-0 opacity-0 transition-opacity duration-700"}
                      ${(token.pos === "X" || token.dep === "flat") ? "opacity-0" : ""}
                      ${!pageId ? "hidden" : ""}
                    `}
                  >
                    <span>{token.lemma}</span>
                    <span>{token.pos}</span>
                    <span>{token.dep}</span>
                  </div>
                  {lemmaInfo && lemmaInfo[`${token.lemma}_${token.pos}`]?.is_favorite === true &&
                    <div className="absolute right-0 -top-1">
                      <Star size={11} fill="var(--color-neutral-400)" stroke="transparent" />
                    </div>
                  }
                </span>
              );
            })}
          </div>
            );
          })()
        ))}

        <TokenHighlightOverlay
          key={pageId}
          pageId={pageId}
          containerRef={containerRef}
          blocks={blocks}
          activeLyricBlockIndex={activeLyricBlockIndex}
          syncPlaybackActive={syncPlaybackActive}
        />
      </div>

      {rightAside}
      {overlay}
    </div>
  );
}
