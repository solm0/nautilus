import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import type { OCRBlock, OCRResponse } from "../src/components/pageTypes";
import {
  analyzeTextBlocks,
  EXTENSION_DEEPLINK_BASE,
  enrichBlocksWithIpa,
  getInstalledLanguages,
  isAuthenticated,
  type InstalledPack,
  loginWithPassword,
  logoutExtensionAuth,
  openInstallPage,
  openSavedPage,
  probeLocalApi,
  saveAnalyzedPage,
  signupWithPassword,
} from "./api";

const PANEL_HOST_ID = "nautilus-extension-host";

type SelectedEntry = {
  id: string;
  element: HTMLElement;
};

type SelectionDragState = {
  anchor: HTMLElement;
  current: HTMLElement;
  pointerMoved: boolean;
};

type AuthIntent = "save" | null;

function inferLanguage() {
  const lang = document.documentElement.lang.trim().toLowerCase();
  if (!lang) return "en";

  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("mk")) return "mk";
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("sr")) return "sr";
  return "en";
}

type InstalledLanguageOption = {
  lang: string;
};

function normalizeTextPreservingBreaks(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "");
}

function extractElementText(element: HTMLElement) {
  const raw = typeof element.innerText === "string" && element.innerText.length > 0
    ? element.innerText
    : element.textContent ?? "";

  return normalizeTextPreservingBreaks(raw);
}

function previewText(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "Untitled selection";
  return firstLine.length > 72 ? `${firstLine.slice(0, 72)}...` : firstLine;
}

function isSelectableTextElement(element: HTMLElement) {
  const text = extractElementText(element).trim();
  const rect = element.getBoundingClientRect();

  return (
    text.length >= 12 &&
    text.length <= 12000 &&
    rect.width >= 24 &&
    rect.height >= 18
  );
}

function findTextElement(target: EventTarget | null, host: HTMLElement | null) {
  let node = target instanceof Element ? target : null;

  while (node) {
    if (host?.contains(node)) return null;

    const element = node as HTMLElement;
    if (isSelectableTextElement(element)) {
      return element;
    }

    node = node.parentElement;
  }

  return null;
}

function collectSelectableLeafElements(root: ParentNode, host: HTMLElement | null) {
  const all = Array.from(root.querySelectorAll<HTMLElement>("body *"));

  return all.filter((element) => {
    if (host?.contains(element)) return false;
    if (!isSelectableTextElement(element)) return false;

    return !Array.from(element.children).some((child) => {
      return child instanceof HTMLElement && isSelectableTextElement(child);
    });
  });
}

function findLeafTextElement(target: EventTarget | null, host: HTMLElement | null) {
  const targetNode = target instanceof Node ? target : null;
  if (!targetNode) return null;

  const selectableLeaves = collectSelectableLeafElements(document, host);
  const leaf = selectableLeaves.find((element) => element.contains(targetNode));
  if (leaf) return leaf;

  return findTextElement(target, host);
}

function findLeafTextElementFromPoint(clientX: number, clientY: number, host: HTMLElement | null) {
  const pointTarget = document.elementFromPoint(clientX, clientY);
  return findLeafTextElement(pointTarget, host);
}

function getElementsBetween(anchor: HTMLElement, current: HTMLElement, host: HTMLElement | null) {
  const selectable = collectSelectableLeafElements(document, host);
  const anchorIndex = selectable.indexOf(anchor);
  const currentIndex = selectable.indexOf(current);

  if (anchorIndex < 0 || currentIndex < 0) {
    return [current];
  }

  const start = Math.min(anchorIndex, currentIndex);
  const end = Math.max(anchorIndex, currentIndex);
  return selectable.slice(start, end + 1);
}

function makeResult(text: string, blocks: OCRBlock[]): OCRResponse {
  return { text, blocks };
}

function makeOverlayStyle(rect: DOMRect, kind: "hover" | "selected"): CSSProperties {
  return {
    position: "fixed",
    left: `${Math.max(0, rect.left - 2)}px`,
    top: `${Math.max(0, rect.top - 2)}px`,
    width: `${Math.max(0, rect.width + 4)}px`,
    height: `${Math.max(0, rect.height + 4)}px`,
    borderRadius: "12px",
    border: kind === "hover" ? "2px solid rgba(245, 158, 11, 0.9)" : "2px solid rgba(249, 115, 22, 0.95)",
    background: kind === "hover" ? "rgba(253, 230, 138, 0.18)" : "rgba(251, 146, 60, 0.16)",
    boxShadow: kind === "hover" ? "0 0 0 1px rgba(255,255,255,0.5)" : "0 0 0 1px rgba(255,255,255,0.72)",
    pointerEvents: "none",
    zIndex: 2147483646,
    transition: "all 120ms ease",
  };
}

function openDeepLinkInPage(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.style.display = "none";
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function tryWakeDesktopApp() {
  const wakeUrl = EXTENSION_DEEPLINK_BASE.replace(/page\/?$/, "wake");

  try {
    openDeepLinkInPage(wakeUrl);
    return true;
  } catch {
    return false;
  }
}

function AuthModal({
  authed,
  busy,
  mode,
  message,
  onClose,
  onModeChange,
  onLogin,
  onLogout,
  onSignup,
}: {
  authed: boolean;
  busy: boolean;
  mode: "login" | "signup";
  message: string | null;
  onClose: () => void;
  onModeChange: (mode: "login" | "signup") => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={modalBackdropStyle}>
      <div style={modalCardStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Nautilus</div>
            <h2 style={modalTitleStyle}>{authed ? "Account" : mode === "login" ? "Login" : "Create account"}</h2>
          </div>
          <button type="button" onClick={onClose} style={ghostButtonStyle}>
            Close
          </button>
        </div>

        {authed ? (
          <div style={modalSectionStyle}>
            <p style={modalParagraphStyle}>You are signed in. Save will open the desktop app on the new page.</p>
            {message ? <p style={errorTextStyle}>{message}</p> : null}
            <button type="button" onClick={() => void onLogout()} style={primaryButtonStyle} disabled={busy}>
              {busy ? "Working..." : "Logout"}
            </button>
          </div>
        ) : (
          <>
            <div style={modalSectionStyle}>
              <p style={modalParagraphStyle}>
                {mode === "login"
                  ? "Sign in to save selected page regions into Nautilus."
                  : "Create your account here, then continue from the same page."}
              </p>
              {mode === "signup" ? (
                <input
                  type="text"
                  placeholder="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={inputStyle}
                />
              ) : null}
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={inputStyle}
                autoFocus
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
              {message ? <p style={errorTextStyle}>{message}</p> : null}
            </div>

            <div style={buttonRowStyle}>
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => void onLogin(email, password)}
                  style={primaryButtonStyle}
                  disabled={busy}
                >
                  {busy ? "Logging in..." : "Login"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSignup(name, email, password)}
                  style={primaryButtonStyle}
                  disabled={busy}
                >
                  {busy ? "Creating..." : "Create account"}
                </button>
              )}

              <button
                type="button"
                onClick={() => onModeChange(mode === "login" ? "signup" : "login")}
                style={ghostButtonStyle}
                disabled={busy}
              >
                {mode === "login" ? "Create account" : "Back to login"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OverlayApp() {
  const hostRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<ShadowRoot | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const pageDragRef = useRef<SelectionDragState | null>(null);
  const elementIdsRef = useRef(new WeakMap<HTMLElement, string>());
  const nextIdRef = useRef(1);
  const pendingAuthIntentRef = useRef<AuthIntent>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguageOption[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [uiCollapsed, setUiCollapsed] = useState(true);
  const [collapsedHovered, setCollapsedHovered] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPreviewIds, setDragPreviewIds] = useState<string[]>([]);

  const getElementId = (element: HTMLElement) => {
    const existing = elementIdsRef.current.get(element);
    if (existing) return existing;

    const nextId = `nautilus-selection-${nextIdRef.current}`;
    nextIdRef.current += 1;
    elementIdsRef.current.set(element, nextId);
    return nextId;
  };

  const syncAuthState = useEffectEvent(async () => {
    setAuthed(await isAuthenticated());
  });

  useEffect(() => {
    hostRef.current = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
    rootRef.current = hostRef.current?.shadowRoot ?? null;
    void syncAuthState();
  }, [syncAuthState]);

  useEffect(() => {
    let active = true;

    const loadLanguages = async () => {
      setLanguagesLoading(true);

      try {
        const installed = await getInstalledLanguages();
        if (!active) return;

        const normalized = installed
          .filter((pack: InstalledPack) => pack.installed)
          .map((pack: InstalledPack) => ({
            lang: pack.lang,
          }));

        setInstalledLanguages(normalized);
        if (normalized.length > 0) {
          const inferred = inferLanguage();
          const matching = normalized.find((item) => item.lang === inferred);
          setSelectedLanguage((current) => current ?? matching?.lang ?? normalized[0].lang);
        }
      } catch {
        if (!active) return;
        setInstalledLanguages([]);
      } finally {
        if (active) {
          setLanguagesLoading(false);
        }
      }
    };

    void loadLanguages();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleScrollOrResize = () => {
      setLayoutTick((value) => value + 1);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  useEffect(() => {
    setSelectedEntries((current) => current.filter((entry) => document.contains(entry.element)));
  }, [layoutTick]);

  const clearSelection = useEffectEvent(() => {
    setSelectedEntries([]);
    setHoveredElement(null);
    setMessage(null);
    setTitle("");
  });

  const toggleElementSelection = useEffectEvent((element: HTMLElement) => {
    const id = getElementId(element);

    setSelectedEntries((current) => {
      const exists = current.some((entry) => entry.id === id);
      if (exists) {
        return current.filter((entry) => entry.id !== id);
      }

      return [...current, { id, element }];
    });
  });

  const appendSelectionElements = useEffectEvent((elements: HTMLElement[]) => {
    const deduped = elements.filter((element, index) => elements.indexOf(element) === index);

    setSelectedEntries((current) => {
      const existingIds = new Set(current.map((entry) => entry.id));
      const nextEntries = deduped
        .map((element) => ({ id: getElementId(element), element }))
        .filter((entry) => !existingIds.has(entry.id));

      if (nextEntries.length === 0) return current;
      return [...current, ...nextEntries];
    });
  });

  useEffect(() => {
    if (!selectionMode) {
      setHoveredElement(null);
      pageDragRef.current = null;
      setDragPreviewIds([]);
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const next = findLeafTextElementFromPoint(event.clientX, event.clientY, hostRef.current);
      setHoveredElement(next);

      const dragState = pageDragRef.current;
      if (!dragState || !next) return;

      dragState.pointerMoved = true;
      dragState.current = next;
      const range = getElementsBetween(dragState.anchor, next, hostRef.current);
      setDragPreviewIds(range.map((element) => getElementId(element)));
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (hostRef.current?.contains(event.target as Node)) return;

      const element = findLeafTextElementFromPoint(event.clientX, event.clientY, hostRef.current);
      if (!element) return;

      event.preventDefault();
      window.getSelection()?.removeAllRanges();

      pageDragRef.current = {
        anchor: element,
        current: element,
        pointerMoved: false,
      };
    };

    const handleClick = (event: MouseEvent) => {
      if (pageDragRef.current?.pointerMoved) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      if (hostRef.current?.contains(event.target as Node)) return;

      const element = findLeafTextElementFromPoint(event.clientX, event.clientY, hostRef.current);
      if (!element) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleElementSelection(element);
      setMessage(null);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const dragState = pageDragRef.current;
      if (!dragState) return;

      const element = findLeafTextElementFromPoint(event.clientX, event.clientY, hostRef.current) ?? dragState.current;
      pageDragRef.current = null;
      window.getSelection()?.removeAllRanges();

      if (!dragState.pointerMoved || !element) {
        setDragPreviewIds([]);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const range = getElementsBetween(dragState.anchor, element, hostRef.current);
      appendSelectionElements(range);
      setMessage(null);
      setDragPreviewIds([]);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectionMode(false);
        setHoveredElement(null);
        pageDragRef.current = null;
        setDragPreviewIds([]);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handlePointerMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handlePointerMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [appendSelectionElements, selectionMode, toggleElementSelection]);

  useEffect(() => {
    if (!selectionMode) return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.getSelection()?.removeAllRanges();
    };
  }, [selectionMode]);

  const selectedBlocks = useMemo(() => {
    return selectedEntries
      .map((entry) => {
        const text = extractElementText(entry.element);
        return {
          id: entry.id,
          element: entry.element,
          text,
          preview: previewText(text),
        };
      })
      .filter((entry) => entry.text.trim().length > 0 && document.contains(entry.element));
  }, [selectedEntries, layoutTick]);

  const selectedRects = useMemo(() => {
    return selectedBlocks
      .map((entry) => ({ id: entry.id, rect: entry.element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
  }, [selectedBlocks, layoutTick]);

  const dragPreviewRects = useMemo(() => {
    if (dragPreviewIds.length === 0) return [];

    const selectable = collectSelectableLeafElements(document, hostRef.current);
    const previewSet = new Set(dragPreviewIds);

    return selectable
      .map((element) => ({ id: getElementId(element), rect: element.getBoundingClientRect() }))
      .filter(({ id, rect }) => previewSet.has(id) && rect.width > 0 && rect.height > 0);
  }, [dragPreviewIds, getElementId, layoutTick]);

  const hoveredRect = useMemo(() => {
    if (!selectionMode || !hoveredElement || !document.contains(hoveredElement)) return null;

    const isSelected = selectedEntries.some((entry) => entry.element === hoveredElement);
    if (isSelected) return null;

    const rect = hoveredElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }, [hoveredElement, layoutTick, selectedEntries, selectionMode]);

  const combinedText = useMemo(
    () => selectedBlocks.map((entry) => entry.text).join("\n\n"),
    [selectedBlocks],
  );

  useEffect(() => {
    if (title.trim()) return;
    if (selectedBlocks.length === 0) return;

    setTitle(selectedBlocks[0].preview);
  }, [selectedBlocks, title]);

  useEffect(() => {
    if (selectionMode || selectedBlocks.length > 0 || message || authOpen) {
      setUiCollapsed(false);
    }
  }, [authOpen, message, selectedBlocks.length, selectionMode]);

  const moveSelectedEntry = useEffectEvent((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setSelectedEntries((current) => {
      const sourceIndex = current.findIndex((entry) => entry.id === sourceId);
      const targetIndex = current.findIndex((entry) => entry.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  });

  useEffect(() => {
    if (!draggingId) return;

    const tick = window.setInterval(() => {
      const container = listRef.current;
      const pointerY = dragPointerYRef.current;
      if (!container || pointerY == null) return;

      const rect = container.getBoundingClientRect();
      const threshold = 50;
      if (pointerY < rect.top + threshold) {
        container.scrollTop -= 18;
      } else if (pointerY > rect.bottom - threshold) {
        container.scrollTop += 18;
      }
    }, 16);

    return () => {
      window.clearInterval(tick);
    };
  }, [draggingId]);

  const ensureLocalAppAvailable = useEffectEvent(async () => {
    if (await probeLocalApi()) return true;

    tryWakeDesktopApp();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (await probeLocalApi()) return true;
    }

    await openInstallPage();
    return false;
  });

  const runSaveFlow = useEffectEvent(async (skipAuthCheck = false) => {
    if (selectedBlocks.length === 0) {
      setMessage("Select one or more text regions first.");
      return;
    }

    if (!selectedLanguage) {
      setMessage("Choose an installed language first.");
      return;
    }

    setSaveBusy(true);
    setMessage("Waking the desktop app...");
    setAuthMessage(null);

    try {
      const ready = await ensureLocalAppAvailable();
      if (!ready) {
        setMessage("Desktop app or local server was not available. Opened the install page.");
        return;
      }

      if (!skipAuthCheck && !authed) {
        pendingAuthIntentRef.current = "save";
        setAuthMode("login");
        setAuthOpen(true);
        setMessage("Login is required before saving.");
        return;
      }

      setMessage("Analyzing selected text...");
      const language = selectedLanguage;
      const analyzed = await analyzeTextBlocks(
        selectedBlocks.map((entry) => entry.text),
        language,
      );

      setMessage("Attaching IPA...");
      const ipaData = await enrichBlocksWithIpa(analyzed.blocks, language);

      setMessage("Saving page...");
      const page = await saveAnalyzedPage(
        makeResult(combinedText, ipaData.blocks),
        title.trim() || selectedBlocks[0]?.preview || "Web Clip",
        language,
        window.location.href,
      );

      setMessage(`Saved page ${page.id}. Opening the desktop app...`);
      await openSavedPage(page.id);
      clearSelection();
      setSelectionMode(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  });

  const handleLogin = useEffectEvent(async (email: string, password: string) => {
    if (!email.trim() || !password.trim()) {
      setAuthMessage("Enter your email and password.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await loginWithPassword(email, password);
      setAuthed(true);
      setAuthOpen(false);

      if (pendingAuthIntentRef.current === "save") {
        pendingAuthIntentRef.current = null;
        await runSaveFlow(true);
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setAuthBusy(false);
    }
  });

  const handleSignup = useEffectEvent(async (name: string, email: string, password: string) => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setAuthMessage("Enter your name, email, and password.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await signupWithPassword(name, email, password);
      setAuthMode("login");
      setAuthMessage("Account created. Now log in.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setAuthBusy(false);
    }
  });

  const handleLogout = useEffectEvent(async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await logoutExtensionAuth();
      setAuthed(false);
      setAuthOpen(false);
      pendingAuthIntentRef.current = null;
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Logout failed");
    } finally {
      setAuthBusy(false);
    }
  });

  return (
    <>
      {hoveredRect ? <div style={makeOverlayStyle(hoveredRect, "hover")} /> : null}
      {dragPreviewRects.map(({ id, rect }) => (
        <div key={`preview-${id}`} style={makeOverlayStyle(rect, "hover")} />
      ))}
      {selectedRects.map(({ id, rect }) => (
        <div key={id} style={makeOverlayStyle(rect, "selected")} />
      ))}

      <div style={panelShellStyle}>
        {uiCollapsed && !authOpen ? (
          <button
            type="button"
            onClick={() => setUiCollapsed(false)}
            onMouseEnter={() => setCollapsedHovered(true)}
            onMouseLeave={() => setCollapsedHovered(false)}
            style={{
              ...collapsedTabStyle,
              ...(collapsedHovered ? collapsedTabHoveredStyle : null),
            }}
            title="Open Nautilus"
          >
            <span style={collapsedDotStyle} />
            <span style={collapsedLabelStyle}>N</span>
          </button>
        ) : null}

        <div
          style={{
            ...panelCardStyle,
            ...((authOpen || uiCollapsed) ? hiddenPanelCardStyle : null),
          }}
        >
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Nautilus</div>
              <div style={panelTitleStyle}>
                {selectionMode ? "Selection mode on" : "Ready"}
              </div>
            </div>
            <div style={headerButtonRowStyle}>
              <button
                type="button"
                onClick={() => {
                  setUiCollapsed(true);
                  setSelectionMode(false);
                  setHoveredElement(null);
                }}
                style={iconGhostButtonStyle}
                title="Hide"
              >
                Hide
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionMode((current) => !current);
                  setHoveredElement(null);
                  setMessage(null);
                }}
                style={selectionMode ? primaryButtonStyle : ghostButtonStyle}
              >
                {selectionMode ? "Stop selecting" : "Select regions"}
              </button>
            </div>
          </div>

          <div style={statusRowStyle}>
            <span style={countBadgeStyle}>{selectedBlocks.length} selected</span>
            {selectedBlocks.length > 0 ? (
              <button type="button" onClick={() => clearSelection()} style={linkButtonStyle}>
                Clear
              </button>
            ) : null}
          </div>

          <p style={helpTextStyle}>
            {selectionMode
              ? "Hover any text area to preview it. Click to add or remove regions. Press Esc to leave selection mode."
              : "Use selection mode to mark multiple text regions, then save them straight into the desktop app."}
          </p>

          <div style={fieldStackStyle}>
            <label style={fieldLabelStyle} htmlFor="nautilus-title-input">
              Title
            </label>
            <input
              id="nautilus-title-input"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Web Clip"
              style={panelInputStyle}
            />
          </div>

          <div style={fieldStackStyle}>
            <label style={fieldLabelStyle} htmlFor="nautilus-language-select">
              Language
            </label>
            {languagesLoading ? (
              <div style={loadingChipStyle}>Loading installed languages...</div>
            ) : installedLanguages.length === 0 ? (
              <button type="button" onClick={() => void openInstallPage()} style={installLinkStyle}>
                Install a language pack to continue.
              </button>
            ) : (
              <select
                id="nautilus-language-select"
                value={selectedLanguage ?? ""}
                onChange={(event) => setSelectedLanguage(event.target.value)}
                style={panelSelectStyle}
              >
                {installedLanguages.map((language) => (
                  <option key={language.lang} value={language.lang}>
                    {language.lang}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedBlocks.length > 0 ? (
            <div
              ref={listRef}
              style={selectionListStyle}
              onDragOver={(event) => {
                event.preventDefault();
                dragPointerYRef.current = event.clientY;
              }}
              onDrop={(event) => {
                event.preventDefault();
                dragIdRef.current = null;
                dragPointerYRef.current = null;
                setDraggingId(null);
              }}
            >
              {selectedBlocks.map((entry, index) => (
                <div
                  key={entry.id}
                  style={{
                    ...selectionItemStyle,
                    ...(draggingId === entry.id ? draggingSelectionItemStyle : null),
                  }}
                  draggable
                  onDragStart={(event) => {
                    dragIdRef.current = entry.id;
                    dragPointerYRef.current = event.clientY;
                    setDraggingId(entry.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", entry.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    dragPointerYRef.current = event.clientY;
                    const sourceId = dragIdRef.current;
                    if (!sourceId || sourceId === entry.id) return;
                    moveSelectedEntry(sourceId, entry.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = dragIdRef.current;
                    if (sourceId && sourceId !== entry.id) {
                      moveSelectedEntry(sourceId, entry.id);
                    }
                    dragIdRef.current = null;
                    dragPointerYRef.current = null;
                    setDraggingId(null);
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                    dragPointerYRef.current = null;
                    setDraggingId(null);
                  }}
                >
                  <span style={selectionIndexStyle}>{index + 1}</span>
                  <span style={dragHandleStyle} aria-hidden="true">
                    <svg viewBox="0 0 12 16" width="12" height="16" fill="none">
                      <circle cx="3" cy="3" r="1.1" fill="currentColor" />
                      <circle cx="9" cy="3" r="1.1" fill="currentColor" />
                      <circle cx="3" cy="8" r="1.1" fill="currentColor" />
                      <circle cx="9" cy="8" r="1.1" fill="currentColor" />
                      <circle cx="3" cy="13" r="1.1" fill="currentColor" />
                      <circle cx="9" cy="13" r="1.1" fill="currentColor" />
                    </svg>
                  </span>
                  <span style={selectionPreviewStyle}>{entry.preview}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => void runSaveFlow()}
              style={primaryButtonStyle}
              disabled={saveBusy}
            >
              {saveBusy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMessage(null);
                setAuthOpen(true);
              }}
              style={ghostButtonStyle}
              disabled={authBusy}
            >
              {authed ? "Account" : "Login"}
            </button>
          </div>

          {message ? <p style={messageTextStyle}>{message}</p> : null}
        </div>
      </div>

      {authOpen ? (
        <AuthModal
          authed={authed}
          busy={authBusy}
          mode={authMode}
          message={authMessage}
          onClose={() => {
            setAuthOpen(false);
            setAuthMessage(null);
            pendingAuthIntentRef.current = null;
          }}
          onModeChange={setAuthMode}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onSignup={handleSignup}
        />
      ) : null}
    </>
  );
}

const panelShellStyle: CSSProperties = {
  position: "fixed",
  top: "68px",
  right: "16px",
  zIndex: 2147483647,
  pointerEvents: "none",
};

const panelCardStyle: CSSProperties = {
  width: "min(360px, calc(100vw - 32px))",
  padding: "14px",
  borderRadius: "20px",
  background: "rgba(12, 14, 18, 0.92)",
  color: "#f5f5f5",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 28px 60px rgba(15, 23, 42, 0.28)",
  backdropFilter: "blur(18px)",
  fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxHeight: "calc(100vh - 32px)",
  overflow: "hidden",
  transition: "opacity 160ms ease, transform 160ms ease",
};

const hiddenPanelCardStyle: CSSProperties = {
  opacity: 0,
  pointerEvents: "none",
  transform: "translateY(-6px) scale(0.98)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const headerButtonRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const collapsedTabStyle: CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(12, 14, 18, 0.42)",
  color: "rgba(255,255,255,0.72)",
  borderRadius: "999px",
  padding: "7px 10px",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  backdropFilter: "blur(16px)",
  cursor: "pointer",
  opacity: 0.4,
  transition: "opacity 140ms ease, transform 140ms ease",
  pointerEvents: "auto",
};

const collapsedTabHoveredStyle: CSSProperties = {
  opacity: 1,
  transform: "translateX(-2px)",
};

const collapsedDotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "999px",
  background: "rgba(251, 146, 60, 0.92)",
  boxShadow: "0 0 0 4px rgba(251, 146, 60, 0.12)",
};

const collapsedLabelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
};

const eyebrowStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.62)",
};

const panelTitleStyle: CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  marginTop: "2px",
};

const statusRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const countBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "88px",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.08)",
  fontSize: "12px",
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "13px",
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.78)",
};

const fieldStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.58)",
};

const panelInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#f8fafc",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "13px",
  background: "rgba(255,255,255,0.06)",
  outline: "none",
  boxSizing: "border-box",
  maxWidth: "100%",
};

const panelSelectStyle: CSSProperties = {
  ...panelInputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  cursor: "pointer",
};

const loadingChipStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.62)",
  fontSize: "13px",
};

const installLinkStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "#f8fafc",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "13px",
  textAlign: "left",
  cursor: "pointer",
  boxSizing: "border-box",
  maxWidth: "100%",
};

const selectionListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  overflowY: "auto",
  maxHeight: "min(48vh, 520px)",
  paddingRight: "4px",
};

const selectionItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "9px 10px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.06)",
  cursor: "grab",
  userSelect: "none",
  flexShrink: 0,
};

const draggingSelectionItemStyle: CSSProperties = {
  opacity: 0.55,
  background: "rgba(249, 115, 22, 0.18)",
  border: "1px solid rgba(253, 186, 116, 0.4)",
};

const selectionIndexStyle: CSSProperties = {
  width: "20px",
  height: "20px",
  borderRadius: "999px",
  background: "rgba(249, 115, 22, 0.2)",
  color: "#fed7aa",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  flexShrink: 0,
};

const dragHandleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.38)",
  flexShrink: 0,
  cursor: "grab",
};

const selectionPreviewStyle: CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.82)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#f5f5f5",
  color: "#101214",
  borderRadius: "999px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "#f5f5f5",
  borderRadius: "999px",
  padding: "10px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

const iconGhostButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  padding: "10px 12px",
};

const linkButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#f5d0fe",
  padding: 0,
  fontSize: "12px",
  cursor: "pointer",
};

const messageTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "12px",
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.76)",
};

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  padding: "16px",
  background: "rgba(3, 7, 18, 0.16)",
};

const modalCardStyle: CSSProperties = {
  width: "min(360px, calc(100vw - 32px))",
  borderRadius: "24px",
  padding: "18px",
  background: "rgba(17, 24, 39, 0.96)",
  color: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 28px 60px rgba(15, 23, 42, 0.34)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",
  boxSizing: "border-box",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
};

const modalTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: "24px",
  lineHeight: 1.1,
};

const modalSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const modalParagraphStyle: CSSProperties = {
  margin: 0,
  fontSize: "14px",
  lineHeight: 1.55,
  color: "rgba(248,250,252,0.78)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "2px solid rgba(250, 250, 250, 0.2)",
  color: "#f8fafc",
  borderRadius: "10px",
  padding: "11px 12px",
  fontSize: "14px",
  background: "rgba(255,255,255,0.04)",
  outline: "none",
  boxSizing: "border-box",
  maxWidth: "100%",
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "13px",
  lineHeight: 1.5,
  color: "#fca5a5",
};

function mountPanel() {
  let host = document.getElementById(PANEL_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = PANEL_HOST_ID;
    document.documentElement.appendChild(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  let mount = shadow.getElementById("nautilus-root");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "nautilus-root";
    shadow.appendChild(mount);
  }

  return createRoot(mount);
}

mountPanel().render(<OverlayApp />);
