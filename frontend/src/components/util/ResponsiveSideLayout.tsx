import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  restoreKey?: string | number | null;
  onDesktopPlacementChange?: (
    placement: "left" | "right" | null
  ) => void;
};

type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type InteractionState =
  | {
      type: "drag";
      offsetX: number;
      offsetY: number;
      restoredFromDock: boolean;
      originRect: WindowRect;
    }
  | {
      type: "resize";
      corner: ResizeCorner;
      originRect: WindowRect;
      startX: number;
      startY: number;
    }
  | null;

const MOBILE_SHEET_HEIGHT = "calc(100% - 6rem)";
const HEADER_HEIGHT = 24;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 280;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 640;
const WINDOW_GAP = 16;
const TOP_GAP = 38;
const DOCKED_WIDTH = 360;
const STORAGE_KEY = "responsive-side-layout-window";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveDragTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "summary",
        "[role='button']",
        "[role='link']",
        "[role='menuitem']",
        "[contenteditable='true']",
        "[data-no-drag='true']",
        ".cursor-pointer",
      ].join(",")
    )
  );
}

function getDefaultRect(): WindowRect {
  if (typeof window === "undefined") {
    return {
      x: 0,
      y: TOP_GAP,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }

  const width = Math.min(DEFAULT_WIDTH, window.innerWidth);
  const height = Math.min(DEFAULT_HEIGHT, window.innerHeight - TOP_GAP);

  return {
    x: Math.max(0, window.innerWidth - width - 24),
    y: TOP_GAP,
    width,
    height,
  };
}

function clampRectToViewport(rect: WindowRect) {
  if (typeof window === "undefined") return rect;

  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - TOP_GAP);
  const width = clamp(rect.width, MIN_WIDTH, maxWidth);
  const height = clamp(rect.height, MIN_HEIGHT, maxHeight);
  const x = clamp(rect.x, 0, window.innerWidth - width);
  const y = clamp(rect.y, TOP_GAP, window.innerHeight - height);

  return { x, y, width, height };
}

function clampFloatingRect(rect: WindowRect) {
  if (typeof window === "undefined") return rect;

  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - TOP_GAP);
  const width = clamp(rect.width, MIN_WIDTH, maxWidth);
  const height = clamp(rect.height, MIN_HEIGHT, maxHeight);
  const x = clamp(rect.x, 0, window.innerWidth - width);
  const y = clamp(rect.y, TOP_GAP, window.innerHeight - height);

  return { x, y, width, height };
}

function clampUndockedRestoreRect(rect: WindowRect) {
  if (typeof window === "undefined") return rect;

  const halfViewportHeight = Math.max(
    MIN_HEIGHT,
    Math.floor(window.innerHeight / 2)
  );

  return clampFloatingRect({
    ...rect,
    height: Math.min(rect.height, halfViewportHeight),
  });
}

function getDockedRect(width: number): WindowRect {
  if (typeof window === "undefined") {
    return { x: 0, y: TOP_GAP, width, height: HEADER_HEIGHT };
  }

  const clampedWidth = clamp(
    width,
    MIN_WIDTH,
    Math.max(MIN_WIDTH, window.innerWidth)
  );

  return {
    x: clamp(window.innerWidth - clampedWidth - 24, 0, window.innerWidth - clampedWidth),
    y: window.innerHeight - HEADER_HEIGHT,
    width: clampedWidth,
    height: HEADER_HEIGHT,
  };
}

function getDockedRectFromFloatingRect(rect: WindowRect): WindowRect {
  if (typeof window === "undefined") {
    return { ...rect, height: HEADER_HEIGHT };
  }

  const width = clamp(
    rect.width,
    MIN_WIDTH,
    Math.max(MIN_WIDTH, window.innerWidth)
  );

  return {
    x: clamp(rect.x, 0, window.innerWidth - width),
    y: window.innerHeight - HEADER_HEIGHT,
    width,
    height: HEADER_HEIGHT,
  };
}

function readSavedLayout() {
  if (typeof window === "undefined") {
    return {
      rect: getDefaultRect(),
      previousRect: getDefaultRect(),
      docked: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const rect = getDefaultRect();
      return { rect, previousRect: rect, docked: false };
    }

    const parsed = JSON.parse(raw) as {
      rect?: WindowRect;
      previousRect?: WindowRect;
      docked?: boolean;
    };

    const rect = parsed.rect ? clampRectToViewport(parsed.rect) : getDefaultRect();
    const previousRect = parsed.previousRect
      ? clampRectToViewport(parsed.previousRect)
      : rect;
    const docked = Boolean(parsed.docked);

    return {
      rect: docked ? getDockedRect(parsed.rect?.width ?? DOCKED_WIDTH) : rect,
      previousRect,
      docked,
    };
  } catch {
    const rect = getDefaultRect();
    return { rect, previousRect: rect, docked: false };
  }
}

export default function ResponsiveSideLayout({
  open,
  onClose,
  children,
  restoreKey = null,
  onDesktopPlacementChange,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cornerHandleRefs = useRef<
    Partial<Record<ResizeCorner, HTMLDivElement | null>>
  >({});
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const [translateY, setTranslateY] = useState(0);
  const startY = useRef(0);
  const draggingSheetRef = useRef(false);

  const saved = useMemo(readSavedLayout, []);
  const [windowRect, setWindowRect] = useState<WindowRect>(saved.rect);
  const [previousRect, setPreviousRect] = useState<WindowRect>(saved.previousRect);
  const [isDocked, setIsDocked] = useState(saved.docked);

  const interactionRef = useRef<InteractionState>(null);
  const liveRectRef = useRef<WindowRect>(saved.rect);
  const dockZoneVisibleRef = useRef(false);
  const prevRestoreKeyRef = useRef<string | number | null>(restoreKey);

  const desktopStyle = useMemo(
    () => ({
      left: windowRect.x,
      top: windowRect.y,
      width: windowRect.width,
      height: windowRect.height,
      transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
      opacity: visible ? 1 : 0,
    }),
    [visible, windowRect]
  );

  function applyRect(rect: WindowRect) {
    liveRectRef.current = rect;

    const panel = panelRef.current;
    if (panel) {
      panel.style.left = `${rect.x}px`;
      panel.style.top = `${rect.y}px`;
      panel.style.width = `${rect.width}px`;
      panel.style.height = `${rect.height}px`;
    }

    const handlePositions: Record<ResizeCorner, { left: number; top: number }> = {
      "top-left": { left: rect.x - 10, top: rect.y - 10 },
      "top-right": { left: rect.x + rect.width - 10, top: rect.y - 10 },
      "bottom-left": {
        left: rect.x - 10,
        top: rect.y + rect.height - 10,
      },
      "bottom-right": {
        left: rect.x + rect.width - 10,
        top: rect.y + rect.height - 10,
      },
    };

    for (const [corner, position] of Object.entries(handlePositions) as [
      ResizeCorner,
      { left: number; top: number },
    ][]) {
      const handle = cornerHandleRefs.current[corner];
      if (!handle) continue;
      handle.style.left = `${position.left}px`;
      handle.style.top = `${position.top}px`;
    }
  }

  function setPanelTransform(value: string) {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = value;
  }

  function setPanelTransition(value: string) {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transition = value;
  }

  function setPanelOpacity(value: string) {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.opacity = value;
  }

  function setDockZoneVisible(next: boolean) {
    if (dockZoneVisibleRef.current === next) return;
    dockZoneVisibleRef.current = next;
  }

  useEffect(() => {
    applyRect(windowRect);
    setPanelTransform("");
    setPanelTransition("");
    setPanelOpacity(visible ? "1" : "0");
  }, [windowRect]);

  useEffect(() => {
    if (!open || !isDocked) {
      prevRestoreKeyRef.current = restoreKey;
      return;
    }

    if (restoreKey == null || restoreKey === prevRestoreKeyRef.current) return;

    const nextRect = clampUndockedRestoreRect(previousRect);
    setIsDocked(false);
    setPreviousRect(nextRect);
    setWindowRect(nextRect);
    prevRestoreKeyRef.current = restoreKey;
  }, [open, isDocked, previousRect, restoreKey]);

  useEffect(() => {
    if (!onDesktopPlacementChange) return;

    if (!open || isMobile || isDocked) {
      onDesktopPlacementChange(null);
      return;
    }

    const centerX = windowRect.x + windowRect.width / 2;
    const viewportCenterX = window.innerWidth / 2;

    onDesktopPlacementChange(
      centerX < viewportCenterX ? "left" : "right"
    );
  }, [
    isDocked,
    isMobile,
    onDesktopPlacementChange,
    open,
    windowRect.width,
    windowRect.x,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsMobile(coarse || window.innerWidth < 768);

      setWindowRect((prev) =>
        isDocked ? getDockedRectFromFloatingRect(prev) : clampFloatingRect(prev)
      );
      setPreviousRect((prev) => clampFloatingRect(prev));
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [isDocked]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rect: windowRect,
        previousRect,
        docked: isDocked,
      })
    );
  }, [windowRect, previousRect, isDocked]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
      return;
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
    return undefined;
  }, [isMobile, open]);

  useEffect(() => {
    if (!open || isMobile) return;

    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.type === "drag") {
        const nextX = event.clientX - interaction.offsetX;
        const nextY = event.clientY - interaction.offsetY;
        const nextRect = clampFloatingRect({
          ...liveRectRef.current,
          x: nextX,
          y: nextY,
        });
        const shouldDock =
          nextRect.y + nextRect.height >=
          window.innerHeight - 1;

        setDockZoneVisible(shouldDock);

        liveRectRef.current = nextRect;
        setPanelTransition("none");
        setPanelTransform("");
        applyRect(nextRect);
        setPanelOpacity(shouldDock ? "0.2" : "1");

        return;
      }

      const { corner, originRect, startX, startY } = interaction;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      let nextRect = { ...originRect };

      if (corner === "top-left") {
        nextRect = {
          x: originRect.x + dx,
          y: originRect.y + dy,
          width: originRect.width - dx,
          height: originRect.height - dy,
        };
      } else if (corner === "top-right") {
        nextRect = {
          x: originRect.x,
          y: originRect.y + dy,
          width: originRect.width + dx,
          height: originRect.height - dy,
        };
      } else if (corner === "bottom-left") {
        nextRect = {
          x: originRect.x + dx,
          y: originRect.y,
          width: originRect.width - dx,
          height: originRect.height + dy,
        };
      } else {
        nextRect = {
          x: originRect.x,
          y: originRect.y,
          width: originRect.width + dx,
          height: originRect.height + dy,
        };
      }

      const maxRight = window.innerWidth - WINDOW_GAP;
      const maxBottom = window.innerHeight - WINDOW_GAP;

      if (nextRect.width < MIN_WIDTH) {
        if (corner === "top-left" || corner === "bottom-left") {
          nextRect.x -= MIN_WIDTH - nextRect.width;
        }
        nextRect.width = MIN_WIDTH;
      }

      if (nextRect.height < MIN_HEIGHT) {
        if (corner === "top-left" || corner === "top-right") {
          nextRect.y -= MIN_HEIGHT - nextRect.height;
        }
        nextRect.height = MIN_HEIGHT;
      }

      if (nextRect.x < WINDOW_GAP) {
        if (corner === "top-left" || corner === "bottom-left") {
          nextRect.width -= WINDOW_GAP - nextRect.x;
        }
        nextRect.x = WINDOW_GAP;
      }

      if (nextRect.y < WINDOW_GAP) {
        if (corner === "top-left" || corner === "top-right") {
          nextRect.height -= WINDOW_GAP - nextRect.y;
        }
        nextRect.y = WINDOW_GAP;
      }

      if (nextRect.x + nextRect.width > maxRight) {
        if (corner === "top-right" || corner === "bottom-right") {
          nextRect.width = maxRight - nextRect.x;
        } else {
          nextRect.x = maxRight - nextRect.width;
        }
      }

      if (nextRect.y + nextRect.height > maxBottom) {
        if (corner === "bottom-left" || corner === "bottom-right") {
          nextRect.height = maxBottom - nextRect.y;
        } else {
          nextRect.y = maxBottom - nextRect.height;
        }
      }

      nextRect = clampRectToViewport(nextRect);
      setPanelTransform("");
      setPanelTransition("none");
      setPanelOpacity("1");
      applyRect(nextRect);
    }

    function handlePointerUp() {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.type === "drag") {
        const floatingRect = clampFloatingRect(liveRectRef.current);
        const shouldDock =
          floatingRect.y + floatingRect.height >=
          window.innerHeight - 1;

        if (shouldDock) {
          setPanelTransform("");
          setPanelTransition("");
          setPanelOpacity("1");
          setPreviousRect(floatingRect);
          setWindowRect(getDockedRectFromFloatingRect(floatingRect));
          setIsDocked(true);
        } else {
          const clamped = clampFloatingRect(liveRectRef.current);
          setPanelTransform("");
          setPanelTransition("");
          setPanelOpacity("1");
          setPreviousRect(clamped);
          setWindowRect(clamped);
          setIsDocked(false);
        }
      } else {
        const clamped = clampRectToViewport(liveRectRef.current);
        setPanelTransform("");
        setPanelTransition("");
        setPanelOpacity("1");
        setPreviousRect(clamped);
        setWindowRect(clamped);
      }

      interactionRef.current = null;
      setDockZoneVisible(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [open, isMobile, isDocked, previousRect, windowRect]);

  if (!mounted) return null;

  function onTouchStart(event: React.TouchEvent) {
    if (isInteractiveDragTarget(event.target)) return;
    draggingSheetRef.current = true;
    startY.current = event.touches[0].clientY;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (!draggingSheetRef.current) return;
    event.preventDefault();
    const current = event.touches[0].clientY;
    const diff = Math.max(0, current - startY.current);
    setTranslateY(diff);
  }

  function onTouchEnd() {
    if (!draggingSheetRef.current) return;
    draggingSheetRef.current = false;

    if (translateY > 120) {
      setTranslateY(0);
      onClose();
      return;
    }

    setTranslateY(0);
  }

  function handlePanelPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (!isDocked && isInteractiveDragTarget(event.target)) return;

    const restoredFromDock = isDocked;
    const offsetX = event.clientX - windowRect.x;
    const offsetY = event.clientY - windowRect.y;

    if (restoredFromDock) {
      const nextRect = clampUndockedRestoreRect({
        ...previousRect,
        x: event.clientX - offsetX,
        y: event.clientY - Math.min(offsetY, HEADER_HEIGHT / 2),
      });
      setWindowRect(nextRect);
      setPreviousRect(nextRect);
      setIsDocked(false);
    }

    interactionRef.current = {
      type: "drag",
      offsetX,
      offsetY: restoredFromDock ? Math.min(offsetY, HEADER_HEIGHT / 2) : offsetY,
      restoredFromDock,
      originRect: restoredFromDock ? previousRect : windowRect,
    };
  }

  function handleCornerPointerDown(
    corner: ResizeCorner,
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0 || isDocked) return;

    interactionRef.current = {
      type: "resize",
      corner,
      originRect: windowRect,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.stopPropagation();
  }

  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-neutral-700 transition-opacity duration-200"
          style={{ opacity: Math.max(0, 0.4 - translateY / 400) }}
          onClick={onClose}
        />

        <div
          className={`
            absolute bottom-0 flex w-full flex-col overflow-hidden rounded-t-2xl bg-neutral-50
            transition-transform duration-200
            ${visible ? "translate-y-0" : "translate-y-full"}
          `}
          style={{
            height: MOBILE_SHEET_HEIGHT,
            transform: visible ? `translateY(${translateY}px)` : undefined,
            transition: draggingSheetRef.current ? "none" : undefined,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="shrink-0 pt-2 pb-6"
            onClick={onClose}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>,
      document.body
    );
  }

  const corners: {
    corner: ResizeCorner;
    squareClassName: string;
    cursor: string;
  }[] = [
    {
      corner: "top-left",
      squareClassName: "left-1 top-1",
      cursor: "nwse-resize",
    },
    {
      corner: "top-right",
      squareClassName: "right-1 top-1",
      cursor: "nesw-resize",
    },
    {
      corner: "bottom-left",
      squareClassName: "left-1 bottom-1",
      cursor: "nesw-resize",
    },
    {
      corner: "bottom-right",
      squareClassName: "right-1 bottom-1",
      cursor: "nwse-resize",
    },
  ];

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-60">

      <div
        ref={panelRef}
        className={`
          pointer-events-auto fixed overflow-hidden transition-[opacity,transform,top,height,background-color] duration-220 will-change-transform drop-shadow-xl
          ${isDocked
            ? "cursor-grab rounded-t-lg bg-neutral-300 hover:bg-neutral-400 active:cursor-grabbing"
            : "rounded-sm bg-neutral-100 border border-neutral-200"}
        `}
        style={desktopStyle}
        onPointerDown={handlePanelPointerDown}
      >
        <div
          className={`relative w-full overflow-hidden transition-[height,opacity] duration-200 ${
            isDocked ? "opacity-0" : "opacity-100"
          }`}
          style={{ height: isDocked ? 0 : "100%" }}
        >
          <div className="h-full w-full overflow-hidden">{children}</div>
        </div>

      </div>

      {!isDocked &&
        corners.map(({ corner, squareClassName, cursor }) => (
          <div
            key={corner}
            ref={(node) => {
              cornerHandleRefs.current[corner] = node;
            }}
            className="pointer-events-auto fixed z-[90] h-5 w-5"
            style={{ cursor }}
            onPointerDown={(event) => handleCornerPointerDown(corner, event)}
          >
            <div
              className={`absolute h-3 w-3 duration-150 ${squareClassName}}`}
            />
          </div>
        ))}
    </div>,
    document.body
  );
}
