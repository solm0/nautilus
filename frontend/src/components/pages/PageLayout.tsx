import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";

import MoveModal from "./MoveModal";
import PageCard from "./PageCard";
import { Toolbar } from "./Toolbar";

import Button from "../util/Button";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { useLayout } from "../RootLayout";

import {
  CENTRAL_API,
  authHeaders,
  fetchNotebooks,
  fetchPages,
} from "../../api";

const PINNED_STORAGE_KEY = "pages.sidebar.pinned";
const LONG_PRESS_MS = 420;
const DRAG_CANCEL_DISTANCE = 10;
const SIDEBAR_CLOSE_SWIPE = 72;
const ROOT_DROP_ID = -1;
const MOBILE_SIDEBAR_MS = 220;
const DRAG_SCROLL_EDGE_PX = 56;
const DRAG_SCROLL_MAX_STEP = 18;

export type Page = {
  id: number;
  name: string;
  created_at: string;
  notebook_id?: number | null;
  language: string;
  source?: string;
  metadata?: string[];
};

export type Notebook = {
  id: number;
  name: string;
  created_at: string;
  parent_id?: number | null;
};

export type SelectedItem = {
  type: "page" | "notebook";
  id: number;
};

type DeleteTarget =
  | { type: "page"; item: Page }
  | { type: "notebook"; item: Notebook };

type DragGesture = {
  page: Page;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  timerId: number;
};

type DragState = {
  page: Page;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

function sortByCreatedDesc<T extends { created_at: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}

function loadPinnedIds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is number => typeof value === "number");
  } catch {
    return [];
  }
}

function buildNotebookPath(
  notebookId: number | null | undefined,
  notebookById: Map<number, Notebook>
) {
  const ids: number[] = [];
  let currentId = notebookId ?? null;

  while (currentId) {
    const notebook = notebookById.get(currentId);
    if (!notebook) break;

    ids.unshift(notebook.id);
    currentId = notebook.parent_id ?? null;
  }

  return ids;
}

export default function PageLayout() {
  const { id } = useParams();
  const location = useLocation();
  const currentPageId = id ? Number(id) : null;

  const { pageSidebarOpen, setPageSidebarOpen } = useLayout();

  const [pages, setPages] = useState<Page[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotebookIds, setExpandedNotebookIds] = useState<Set<number>>(
    () => new Set()
  );
  const [pinnedPageIds, setPinnedPageIds] = useState<number[]>(() =>
    loadPinnedIds()
  );
  const [movePageIds, setMovePageIds] = useState<number[]>([]);
  const [movePageLabel, setMovePageLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragTargetNotebookId, setDragTargetNotebookId] = useState<number | null>(
    null
  );
  const [dropFlashNotebookId, setDropFlashNotebookId] = useState<number | null>(
    null
  );
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [isMobileLike, setIsMobileLike] = useState(false);
  const [sidebarOffsetX, setSidebarOffsetX] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebarMounted, setMobileSidebarMounted] = useState(false);
  const [mobileSidebarEntered, setMobileSidebarEntered] = useState(false);

  const initializedExpansionRef = useRef(false);
  const knownNotebookIdsRef = useRef<Set<number>>(new Set());
  const dragGestureRef = useRef<DragGesture | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const dragTargetNotebookIdRef = useRef<number | null>(null);
  const suppressClickPageIdRef = useRef<number | null>(null);
  const notebookTargetRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rootDropRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const mobileSidebarTimeoutRef = useRef<number | null>(null);
  const sidebarDragStartRef = useRef<number | null>(null);
  const sidebarDraggingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollVelocityRef = useRef(0);

  const reload = async () => {
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }

    try {
      const [pagesData, notebooksData] = await Promise.all([
        fetchPages(),
        fetchNotebooks(),
      ]);

      setPages(pagesData);
      setNotebooks(notebooksData);
      hasLoadedOnceRef.current = true;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const updateMobileState = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsMobileLike(coarse || window.innerWidth < 768);
    };

    updateMobileState();
    window.addEventListener("resize", updateMobileState);
    return () => window.removeEventListener("resize", updateMobileState);
  }, []);

  useEffect(() => {
    if (!id) {
      setPageSidebarOpen(true);
    }
  }, [id, setPageSidebarOpen]);

  useEffect(() => {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedPageIds));
  }, [pinnedPageIds]);

  useEffect(() => {
    setOpenPopupId(null);
  }, [pageSidebarOpen, currentPageId]);

  const notebookById = useMemo(
    () => new Map(notebooks.map((notebook) => [notebook.id, notebook])),
    [notebooks]
  );

  const pagesByNotebookId = useMemo(() => {
    const map = new Map<number | null, Page[]>();

    for (const page of pages) {
      const key = page.notebook_id ?? null;
      const list = map.get(key) ?? [];
      list.push(page);
      map.set(key, list);
    }

    for (const [key, list] of map.entries()) {
      map.set(key, sortByCreatedDesc(list));
    }

    return map;
  }, [pages]);

  const notebooksByParentId = useMemo(() => {
    const map = new Map<number | null, Notebook[]>();

    for (const notebook of notebooks) {
      const parentId =
        notebook.parent_id && notebookById.has(notebook.parent_id)
          ? notebook.parent_id
          : null;
      const list = map.get(parentId) ?? [];
      list.push(notebook);
      map.set(parentId, list);
    }

    for (const [key, list] of map.entries()) {
      map.set(key, sortByCreatedDesc(list));
    }

    return map;
  }, [notebooks, notebookById]);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === currentPageId) ?? null,
    [pages, currentPageId]
  );

  useEffect(() => {
    if (notebooks.length === 0) return;

    setExpandedNotebookIds((prev) => {
      const next = new Set(prev);

      if (!initializedExpansionRef.current) {
        for (const notebook of notebooks) {
          next.add(notebook.id);
          knownNotebookIdsRef.current.add(notebook.id);
        }
        initializedExpansionRef.current = true;
      } else {
        for (const notebook of notebooks) {
          if (!knownNotebookIdsRef.current.has(notebook.id)) {
            next.add(notebook.id);
            knownNotebookIdsRef.current.add(notebook.id);
          }
        }
      }

      if (currentPage?.notebook_id) {
        for (const notebookId of buildNotebookPath(
          currentPage.notebook_id,
          notebookById
        )) {
          next.add(notebookId);
        }
      }

      return next;
    });
  }, [currentPage, notebookById, notebooks]);

  useEffect(() => {
    const validIds = new Set(pages.map((page) => page.id));
    setPinnedPageIds((prev) => prev.filter((pageId) => validIds.has(pageId)));
  }, [pages]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      if (mobileSidebarTimeoutRef.current) {
        window.clearTimeout(mobileSidebarTimeoutRef.current);
      }
      if (autoScrollFrameRef.current) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobileLike) {
      setMobileSidebarMounted(false);
      setMobileSidebarEntered(false);
      return;
    }

    if (pageSidebarOpen) {
      if (mobileSidebarTimeoutRef.current) {
        window.clearTimeout(mobileSidebarTimeoutRef.current);
      }
      setMobileSidebarMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMobileSidebarEntered(true);
        });
      });
      return;
    }

    setMobileSidebarEntered(false);
    if (mobileSidebarTimeoutRef.current) {
      window.clearTimeout(mobileSidebarTimeoutRef.current);
    }
    mobileSidebarTimeoutRef.current = window.setTimeout(() => {
      setMobileSidebarMounted(false);
    }, MOBILE_SIDEBAR_MS);
  }, [isMobileLike, pageSidebarOpen]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    dragTargetNotebookIdRef.current = dragTargetNotebookId;
  }, [dragTargetNotebookId]);

  useEffect(() => {
    if (!isMobileLike || !dragState) return;

    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };

    document.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [dragState, isMobileLike]);

  useEffect(() => {
    return () => {
      removeGlobalPointerListeners();
    };
  }, []);

  const pinnedPages = useMemo(() => {
    const pinned = pages.filter((page) => pinnedPageIds.includes(page.id));
    return sortByCreatedDesc(pinned);
  }, [pages, pinnedPageIds]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedSearchQuery.length > 0;

  const filteredItems = useMemo(() => {
    if (!isSearching) return [];

    const matchingNotebooks = notebooks
      .filter((notebook) =>
        notebook.name.toLowerCase().includes(normalizedSearchQuery)
      )
      .map((notebook) => ({
        key: `search-notebook-${notebook.id}`,
        item: { type: "notebook" as const, notebook },
      }));

    const matchingPages = pages
      .filter((page) => page.name.toLowerCase().includes(normalizedSearchQuery))
      .map((page) => ({
        key: `search-page-${page.id}`,
        item: { type: "page" as const, page },
      }));

    return [...matchingNotebooks, ...matchingPages].sort((a, b) => {
      const aDate =
        a.item.type === "page"
          ? a.item.page.created_at
          : a.item.notebook.created_at;
      const bDate =
        b.item.type === "page"
          ? b.item.page.created_at
          : b.item.notebook.created_at;

      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [isSearching, normalizedSearchQuery, notebooks, pages]);

  const rootPages = useMemo(
    () =>
      (pagesByNotebookId.get(null) ?? []).filter(
        (page) => !pinnedPageIds.includes(page.id)
      ),
    [pagesByNotebookId, pinnedPageIds]
  );

  const toggleNotebook = (notebookId: number) => {
    setExpandedNotebookIds((prev) => {
      const next = new Set(prev);
      if (next.has(notebookId)) {
        next.delete(notebookId);
      } else {
        next.add(notebookId);
      }
      return next;
    });
  };

  const consumeSuppressedClick = (pageId: number) => {
    if (suppressClickPageIdRef.current !== pageId) return false;

    suppressClickPageIdRef.current = null;
    return true;
  };

  const removeGlobalPointerListeners = () => {
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("pointerup", handleGlobalPointerUp);
    window.removeEventListener("pointercancel", handleGlobalPointerUp);
  };

  const clearDragGesture = () => {
    const gesture = dragGestureRef.current;

    if (gesture) {
      window.clearTimeout(gesture.timerId);
    }

    dragGestureRef.current = null;
  };

  const stopDragAutoScroll = () => {
    autoScrollVelocityRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const runDragAutoScroll = () => {
    const container = sidebarScrollRef.current;
    const gesture = dragGestureRef.current;
    const velocity = autoScrollVelocityRef.current;

    if (!container || !gesture || velocity === 0) {
      autoScrollFrameRef.current = null;
      return;
    }

    const previousScrollTop = container.scrollTop;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const nextScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, previousScrollTop + velocity)
    );

    if (nextScrollTop !== previousScrollTop) {
      container.scrollTop = nextScrollTop;
      setDragTargetNotebookId(
        findNotebookDropTarget(gesture.lastX, gesture.lastY)
      );
    }

    if (
      nextScrollTop === previousScrollTop &&
      (nextScrollTop === 0 || nextScrollTop === maxScrollTop)
    ) {
      stopDragAutoScroll();
      autoScrollFrameRef.current = null;
      return;
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
  };

  const updateDragAutoScroll = (x: number, y: number) => {
    if (isMobileLike || !dragStateRef.current) {
      stopDragAutoScroll();
      return;
    }

    const container = sidebarScrollRef.current;
    if (!container) {
      stopDragAutoScroll();
      return;
    }

    const rect = container.getBoundingClientRect();
    const withinHorizontalBounds = x >= rect.left && x <= rect.right;
    const withinVerticalBounds = y >= rect.top && y <= rect.bottom;

    if (!withinHorizontalBounds || !withinVerticalBounds) {
      stopDragAutoScroll();
      return;
    }

    let velocity = 0;

    if (y <= rect.top + DRAG_SCROLL_EDGE_PX) {
      const intensity = 1 - (y - rect.top) / DRAG_SCROLL_EDGE_PX;
      velocity = -Math.max(1, Math.round(DRAG_SCROLL_MAX_STEP * intensity));
    } else if (y >= rect.bottom - DRAG_SCROLL_EDGE_PX) {
      const intensity = 1 - (rect.bottom - y) / DRAG_SCROLL_EDGE_PX;
      velocity = Math.max(1, Math.round(DRAG_SCROLL_MAX_STEP * intensity));
    }

    if (velocity === 0) {
      stopDragAutoScroll();
      return;
    }

    autoScrollVelocityRef.current = velocity;

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
    }
  };

  const clearDrag = () => {
    clearDragGesture();
    stopDragAutoScroll();
    dragStateRef.current = null;
    dragTargetNotebookIdRef.current = null;
    setOpenPopupId(null);
    setDragState(null);
    setDragTargetNotebookId(null);
  };

  const flashNotebookDrop = (notebookId: number) => {
    setDropFlashNotebookId(notebookId);
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setDropFlashNotebookId(null);
    }, 360);
  };

  const movePagesToNotebook = async (
    pageIds: number[],
    notebookId: number | null
  ) => {
    const headers = authHeaders();
    if (!headers) throw new Error("unauthorized");

    await fetch(CENTRAL_API + "/pages/move", {
      method: "POST",
      headers,
      body: JSON.stringify({
        page_ids: pageIds,
        notebook_id: notebookId,
      }),
    });

    await reload();
  };

  const findNotebookDropTarget = (x: number, y: number) => {
    for (const [notebookId, element] of notebookTargetRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return notebookId;
      }
    }

    const rootElement = rootDropRef.current;
    if (rootElement) {
      const rect = rootElement.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return ROOT_DROP_ID;
      }
    }

    return null;
  };

  const startDragging = (gesture: DragGesture) => {
    window.clearTimeout(gesture.timerId);
    setDragState({
      page: gesture.page,
      x: gesture.lastX,
      y: gesture.lastY,
      offsetX: gesture.offsetX,
      offsetY: gesture.offsetY,
      width: gesture.width,
      height: gesture.height,
    });
    setDragTargetNotebookId(findNotebookDropTarget(gesture.lastX, gesture.lastY));
    updateDragAutoScroll(gesture.lastX, gesture.lastY);
  };

  const handleGlobalPointerMove = (event: PointerEvent) => {
    const gesture = dragGestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    const dx = Math.abs(event.clientX - gesture.startX);
    const dy = Math.abs(event.clientY - gesture.startY);
    const movedEnough = dx > DRAG_CANCEL_DISTANCE || dy > DRAG_CANCEL_DISTANCE;

    if (isMobileLike && gesture.pointerType === "touch") {
      if (movedEnough) {
        clearDragGesture();
        setDragTargetNotebookId(null);
        removeGlobalPointerListeners();
      }
      return;
    }

    if (!dragStateRef.current) {
      if (movedEnough) {
        startDragging(gesture);
      }
      return;
    }

    event.preventDefault();
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            x: event.clientX,
            y: event.clientY,
          }
        : prev
    );
    setDragTargetNotebookId(findNotebookDropTarget(event.clientX, event.clientY));
    updateDragAutoScroll(event.clientX, event.clientY);
  };

  const handleGlobalPointerUp = async (event: PointerEvent) => {
    const gesture = dragGestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    removeGlobalPointerListeners();

    const pageId = gesture.page.id;
    const targetNotebookId = dragTargetNotebookIdRef.current;
    const sourceNotebookId = gesture.page.notebook_id ?? null;
    const wasDragging = Boolean(dragStateRef.current);

    clearDrag();

    if (!wasDragging) return;

    suppressClickPageIdRef.current = pageId;
    window.setTimeout(() => {
      if (suppressClickPageIdRef.current === pageId) {
        suppressClickPageIdRef.current = null;
      }
    }, 0);

    if (
      targetNotebookId === null ||
      (targetNotebookId === ROOT_DROP_ID && sourceNotebookId === null) ||
      (targetNotebookId !== ROOT_DROP_ID && targetNotebookId === sourceNotebookId)
    ) {
      return;
    }

    const nextNotebookId =
      targetNotebookId === ROOT_DROP_ID ? null : targetNotebookId;

    await movePagesToNotebook([pageId], nextNotebookId);

    if (nextNotebookId !== null) {
      setExpandedNotebookIds((prev) => {
        const next = new Set(prev);
        next.add(nextNotebookId);
        return next;
      });
      flashNotebookDrop(nextNotebookId);
    }
  };

  const handlePagePointerDown = (
    page: Page,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("[data-no-drag='true']")) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const timerId = window.setTimeout(() => {
      const gesture = dragGestureRef.current;
      if (!gesture) return;

      if (isMobileLike && gesture.pointerType === "touch") {
        suppressClickPageIdRef.current = page.id;
        window.setTimeout(() => {
          if (suppressClickPageIdRef.current === page.id) {
            suppressClickPageIdRef.current = null;
          }
        }, 280);
        removeGlobalPointerListeners();
        setOpenPopupId(`page-menu-${page.id}`);
        clearDragGesture();
        return;
      }

      startDragging(gesture);
    }, LONG_PRESS_MS);

    dragGestureRef.current = {
      page,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      timerId,
    };

    window.addEventListener("pointermove", handleGlobalPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
  };

  const openMoveForPage = (page: Page) => {
    setOpenPopupId(null);
    setMovePageIds([page.id]);
    setMovePageLabel(page.name);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const headers = authHeaders();
    if (!headers) throw new Error("unauthorized");

    const endpoint =
      deleteTarget.type === "page"
        ? `/pages/${deleteTarget.item.id}`
        : `/notebooks/${deleteTarget.item.id}`;

    await fetch(CENTRAL_API + endpoint, {
      method: "DELETE",
      headers,
    });

    setOpenPopupId(null);
    setDeleteTarget(null);
    await reload();
  };

  const togglePinnedPage = (page: Page) => {
    setPinnedPageIds((prev) =>
      prev.includes(page.id)
        ? prev.filter((idValue) => idValue !== page.id)
        : [page.id, ...prev]
    );
  };

  const registerNotebookTarget = (
    notebookId: number,
    element: HTMLDivElement | null
  ) => {
    if (!element) {
      notebookTargetRefs.current.delete(notebookId);
      return;
    }

    notebookTargetRefs.current.set(notebookId, element);
  };

  const handleOpenPage = () => {
    setOpenPopupId(null);
    if (isMobileLike) {
      setPageSidebarOpen(false);
    }
  };

  const onSidebarTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileLike || !pageSidebarOpen) return;
    sidebarDraggingRef.current = true;
    sidebarDragStartRef.current = event.touches[0].clientX;
  };

  const onSidebarTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!sidebarDraggingRef.current || sidebarDragStartRef.current === null) return;

    const delta = event.touches[0].clientX - sidebarDragStartRef.current;
    setSidebarOffsetX(Math.min(0, delta));
  };

  const onSidebarTouchEnd = () => {
    if (!sidebarDraggingRef.current) return;

    const shouldClose = sidebarOffsetX < -SIDEBAR_CLOSE_SWIPE;
    sidebarDraggingRef.current = false;
    sidebarDragStartRef.current = null;
    setSidebarOffsetX(0);

    if (shouldClose) {
      setPageSidebarOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const searchBar = (
    <div className="px-2 pt-1 pb-2">
      <div className="flex items-center gap-2 rounded-md border border-neutral-300 md:border-neutral-400 text-neutral-300 md:text-neutral-400 px-2 py-1">
        <Search size={14} className="shrink-0" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search pages and folders"
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={clearSearch}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors ${
            searchQuery
              ? "hover:bg-neutral-100 hover:text-neutral-700"
              : "pointer-events-none opacity-30"
          }`}
          title="Clear search"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );

  const sidebarListContent = loading && !hasLoadedOnceRef.current ? (
    <div className="flex flex-col gap-0.5 px-2 pt-2">
      <SkeletonItem />
      <SkeletonItem level={1} showActions={false} />
      <SkeletonItem level={1} />
      <SkeletonItem />
      <SkeletonItem level={1} showActions={false} />
      <SkeletonItem />
    </div>
  ) : (
    <div className="flex flex-col px-2 pb-14 pt-0">
      {isSearching ? (
        filteredItems.length > 0 ? (
          filteredItems.map(({ key, item }) => (
            <PageCard
              key={key}
              item={item}
              level={0}
              currentPageId={currentPageId}
              expanded={item.type === "notebook" ? expandedNotebookIds.has(item.notebook.id) : false}
              reload={reload}
              isMobileLike={isMobileLike}
              isPinned={item.type === "page" && pinnedPageIds.includes(item.page.id)}
              dragActive={Boolean(dragState)}
              onToggleNotebook={
                item.type === "notebook"
                  ? () => toggleNotebook(item.notebook.id)
                  : undefined
              }
              onTogglePinned={
                item.type === "page"
                  ? () => togglePinnedPage(item.page)
                  : undefined
              }
              onMove={
                item.type === "page"
                  ? () => openMoveForPage(item.page)
                  : undefined
              }
              onDelete={() =>
                setDeleteTarget(
                  item.type === "page"
                    ? { type: "page", item: item.page }
                    : { type: "notebook", item: item.notebook }
                )
              }
              onPagePointerDown={
                item.type === "page"
                  ? (event) => handlePagePointerDown(item.page, event)
                  : undefined
              }
              onOpenPage={item.type === "page" ? handleOpenPage : undefined}
              consumeSuppressedClick={
                item.type === "page"
                  ? () => consumeSuppressedClick(item.page.id)
                  : undefined
              }
              dragging={item.type === "page" && dragState?.page.id === item.page.id}
              openPopupId={openPopupId}
              setOpenPopupId={setOpenPopupId}
            />
          ))
        ) : (
          <div className="px-2 py-3 text-sm text-neutral-400">
            No matches found.
          </div>
        )
      ) : (
        <>
          {renderNotebookTree(null)}

          {rootPages.map((page) => (
            <PageCard
              key={`root-page-${page.id}`}
              item={{ type: "page", page }}
              level={0}
              currentPageId={currentPageId}
              reload={reload}
              isMobileLike={isMobileLike}
              isPinned={pinnedPageIds.includes(page.id)}
              dragActive={Boolean(dragState)}
              onTogglePinned={() => togglePinnedPage(page)}
              onMove={() => openMoveForPage(page)}
              onDelete={() => setDeleteTarget({ type: "page", item: page })}
              onPagePointerDown={(event) => handlePagePointerDown(page, event)}
              onOpenPage={handleOpenPage}
              consumeSuppressedClick={() => consumeSuppressedClick(page.id)}
              dragging={dragState?.page.id === page.id}
              openPopupId={openPopupId}
              setOpenPopupId={setOpenPopupId}
            />
          ))}
        </>
      )}
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="w-full justify-between flex z-30 px-2 items-center h-8">
        <p className="text-xs opacity-60">Pages</p>
        <Toolbar reload={reload} />
      </div>

      {searchBar}

      {!isSearching && pinnedPages.length > 0 ? (
        <div className="pl-2 mr-2 py-2 mb-1 border-b border-neutral-400/50">
          <div className="pb-1 pt-1 text-xs opacity-60">
            Pinned
          </div>
          <div className="flex flex-col">
            {pinnedPages.map((page) => (
              <PageCard
                key={`pinned-${page.id}`}
                item={{ type: "page", page }}
                level={0}
                currentPageId={currentPageId}
                reload={reload}
                isMobileLike={isMobileLike}
                isPinned
                dragActive={Boolean(dragState)}
                onTogglePinned={() => togglePinnedPage(page)}
                onMove={() => openMoveForPage(page)}
                onDelete={() => setDeleteTarget({ type: "page", item: page })}
                onPagePointerDown={(event) => handlePagePointerDown(page, event)}
                onOpenPage={handleOpenPage}
                consumeSuppressedClick={() => consumeSuppressedClick(page.id)}
                dragging={dragState?.page.id === page.id}
                openPopupId={openPopupId}
                setOpenPopupId={setOpenPopupId}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div ref={sidebarScrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {sidebarListContent}
      </div>
    </div>
  );

  function SkeletonItem({
    level = 0,
    showActions = true,
  }: {
    level?: number;
    showActions?: boolean;
  }) {
    return (
      <div
        className="flex min-h-9 items-center gap-2 rounded-md px-2 pr-2 animate-pulse opacity-30"
        style={{ paddingLeft: 8 + level * 14 }}
      >
        <div className="flex shrink-0 items-center gap-1 text-neutral-400">
          <div className="h-3 w-3 rounded bg-neutral-400" />
          <div className="h-3 w-3 rounded bg-neutral-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-3 w-28 rounded bg-neutral-400" />
        </div>
        {showActions ? (
          <div className="flex shrink-0 items-center gap-1">
            <div className="h-6 w-6 rounded bg-neutral-300" />
            <div className="h-6 w-6 rounded bg-neutral-300" />
          </div>
        ) : null}
      </div>
    );
  }

  function renderNotebookTree(parentId: number | null, level = 0): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const childNotebooks = notebooksByParentId.get(parentId) ?? [];

    for (const notebook of childNotebooks) {
      const isExpanded = expandedNotebookIds.has(notebook.id);
      const childPages = (pagesByNotebookId.get(notebook.id) ?? []).filter(
        (page) => !pinnedPageIds.includes(page.id)
      );
      nodes.push(
        <div
          key={`notebook-tree-${notebook.id}`}
          ref={(element) => registerNotebookTarget(notebook.id, element)}
          className={`rounded-md transition-colors ${
            dragTargetNotebookId === notebook.id
              ? "bg-neutral-200/80 ring-1 ring-neutral-300"
              : dropFlashNotebookId === notebook.id
                ? "bg-neutral-200/70"
                : "bg-transparent"
          }`}
        >
          <PageCard
            item={{ type: "notebook", notebook }}
            level={level}
            currentPageId={currentPageId}
            expanded={isExpanded}
            reload={reload}
            isMobileLike={isMobileLike}
            dragActive={Boolean(dragState)}
            onToggleNotebook={() => toggleNotebook(notebook.id)}
            onDelete={() => setDeleteTarget({ type: "notebook", item: notebook })}
            isDragTarget={false}
            dropFlashed={false}
            openPopupId={openPopupId}
            setOpenPopupId={setOpenPopupId}
          />

          {isExpanded ? (
            <>
              {renderNotebookTree(notebook.id, level + 1)}

              {childPages.map((page) => (
                <PageCard
                  key={`page-${page.id}`}
                  item={{ type: "page", page }}
                  level={level + 1}
                  currentPageId={currentPageId}
                  reload={reload}
                  isMobileLike={isMobileLike}
                  isPinned={pinnedPageIds.includes(page.id)}
                  dragActive={Boolean(dragState)}
                  onTogglePinned={() => togglePinnedPage(page)}
                  onMove={() => openMoveForPage(page)}
                  onDelete={() => setDeleteTarget({ type: "page", item: page })}
                  onPagePointerDown={(event) => handlePagePointerDown(page, event)}
                  onOpenPage={handleOpenPage}
                  consumeSuppressedClick={() => consumeSuppressedClick(page.id)}
                  dragging={dragState?.page.id === page.id}
                  openPopupId={openPopupId}
                  setOpenPopupId={setOpenPopupId}
                />
              ))}
            </>
          ) : null}
        </div>
      );
    }

    return nodes;
  }

  return (
    <>
      <div className="flex w-full h-full">
        {isMobileLike && !pageSidebarOpen ? (
          <button
            type="button"
            className="absolute left-3 top-10 z-[40] flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50/90 text-neutral-700 shadow-md backdrop-blur-sm"
            onClick={() => setPageSidebarOpen(true)}
            title="Open pages"
          >
            <Menu size={18} />
          </button>
        ) : null}

        {isMobileLike && mobileSidebarMounted ? (
          <div className="fixed inset-0 z-[40] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-neutral-950/40 transition-opacity duration-200"
              style={{ opacity: mobileSidebarEntered ? 1 : 0 }}
              onClick={() => setPageSidebarOpen(false)}
              aria-label="Close pages sidebar"
            />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden border-r border-neutral-200 bg-neutral-50 shadow-2xl transition-[width,transform] duration-200"
              style={{
                width: mobileSidebarEntered ? "min(91.666667vw, 24rem)" : "0px",
                transform: `translateX(${mobileSidebarEntered ? sidebarOffsetX : 0}px)`,
                transition: sidebarDraggingRef.current
                  ? "none"
                  : `width ${MOBILE_SIDEBAR_MS}ms ease, transform ${MOBILE_SIDEBAR_MS}ms ease`,
              }}
              onTouchStart={onSidebarTouchStart}
              onTouchMove={onSidebarTouchMove}
              onTouchEnd={onSidebarTouchEnd}
            >
              <div
                ref={rootDropRef}
                className={`relative h-full overflow-y-auto pt-11 transition-colors ${
                  dragTargetNotebookId === ROOT_DROP_ID
                    ? "bg-neutral-200/55"
                    : "bg-neutral-50"
                }`}
              >
                {sidebarContent}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={rootDropRef}
            className={`relative shrink-0 flex flex-col pt-11 transition-[width,color] duration-200 ${
              pageSidebarOpen
                ? "w-64 overflow-y-auto"
                : "w-0 overflow-hidden"
            } ${
              dragTargetNotebookId === ROOT_DROP_ID
                ? "bg-neutral-200/55"
                : "bg-neutral-transparent"
            }`}
          >
            {sidebarContent}
          </div>
        )}

        <div
          className={`relative flex-1 h-full shrink-0 bg-neutral-50 ${
            location.pathname === "/" && "bg-transparent"
          }`}
        >
          <Outlet />
        </div>
      </div>

      {dragState ? (
        <div
          className="pointer-events-none fixed z-[120] overflow-hidden rounded-md border border-neutral-300 bg-neutral-50/95 shadow-xl backdrop-blur-sm"
          style={{
            width: dragState.width,
            left: dragState.x - dragState.offsetX,
            top: dragState.y - dragState.offsetY,
          }}
        >
          <div className="flex h-9 items-center gap-2 px-3 text-sm text-neutral-700">
            <div className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="truncate">{dragState.page.name}</span>
            <span className="ml-auto text-xs text-neutral-400">
              {dragState.page.language}
            </span>
          </div>
        </div>
      ) : null}

      <MoveModal
        open={movePageIds.length > 0}
        onClose={() => {
          setMovePageIds([]);
          setMovePageLabel("");
        }}
        pageIds={movePageIds}
        pageLabel={movePageLabel}
        notebooks={notebooks}
        reload={reload}
      />

      <ResponsiveModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <div className="flex flex-col gap-7">
          <h2>
            Delete{" "}
            {deleteTarget?.type === "page" ? "page" : "folder"}
            {deleteTarget ? ` "${deleteTarget.item.name}"` : ""}?
          </h2>

          {deleteTarget?.type === "notebook" ? (
            <p>Deleting a folder will also delete the pages inside it.</p>
          ) : null}

          <Button text="Delete" onClick={handleDelete} fit black />
        </div>
      </ResponsiveModal>
    </>
  );
}
