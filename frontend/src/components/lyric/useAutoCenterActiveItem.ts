import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const TARGET_VIEWPORT_RATIO = 0.42;

function getCenterDistanceRatio(container: HTMLElement, element: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const containerCenter =
    containerRect.top + containerRect.height * TARGET_VIEWPORT_RATIO;
  const elementCenter = elementRect.top + elementRect.height / 2;

  return Math.abs(containerCenter - elementCenter) / Math.max(containerRect.height, 1);
}

function isNearCenter(container: HTMLElement, element: HTMLElement) {
  return getCenterDistanceRatio(container, element) <= 0.08;
}

function getCenteredScrollTop(container: HTMLElement, element: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const elementCenter =
    elementRect.top - containerRect.top + container.scrollTop + elementRect.height / 2;
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const nextTop = elementCenter - container.clientHeight * TARGET_VIEWPORT_RATIO;

  return Math.max(0, Math.min(nextTop, maxScrollTop));
}

function scrollElementToCenter(
  container: HTMLElement,
  element: HTMLElement,
  behavior: ScrollBehavior,
) {
  container.scrollTo({
    top: getCenteredScrollTop(container, element),
    behavior,
  });
}

export function useAutoCenterActiveItem({
  containerRef,
  activeIndex,
  enabled,
  getElementForIndex,
}: {
  containerRef: RefObject<HTMLElement | null>;
  activeIndex: number;
  enabled: boolean;
  getElementForIndex: (index: number, container: HTMLElement) => HTMLElement | null;
}) {
  const [autoFollow, setAutoFollow] = useState(true);
  const autoFollowRef = useRef(true);
  const resumeTimerRef = useRef<number | null>(null);
  const previousActiveIndexRef = useRef<number>(-1);

  const clearResumeTimer = () => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const scheduleAutoResume = () => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setAutoFollow(true);
    }, 1800);
  };

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  useEffect(() => {
    if (!enabled) {
      setAutoFollow(false);
      clearResumeTimer();
      return;
    }
    setAutoFollow(true);
    clearResumeTimer();
  }, [enabled]);

  useEffect(() => {
    return () => {
      clearResumeTimer();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const getActiveElement = () =>
      activeIndex >= 0
        ? getElementForIndex(activeIndex, container)
        : null;

    const markManualInterruption = () => {
      const activeElement = getActiveElement();
      if (!activeElement) return;

      if (!isNearCenter(container, activeElement)) {
        setAutoFollow(false);
        scheduleAutoResume();
      }
    };

    const handleScroll = () => {
      const activeElement = getActiveElement();
      if (!activeElement) return;

      if (isNearCenter(container, activeElement)) {
        setAutoFollow(true);
        clearResumeTimer();
        return;
      }

      if (!autoFollowRef.current) {
        scheduleAutoResume();
      }
    };

    const handleWheel = () => {
      markManualInterruption();
    };

    const handleTouchMove = () => {
      markManualInterruption();
    };

    const handlePointerDown = () => {
      markManualInterruption();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeIndex, containerRef, enabled, getElementForIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || !autoFollow || activeIndex < 0) return;

    const activeElement = getElementForIndex(activeIndex, container);
    if (!activeElement) return;

    const didIndexChange = previousActiveIndexRef.current !== activeIndex;
    previousActiveIndexRef.current = activeIndex;

    if (!didIndexChange && isNearCenter(container, activeElement)) {
      return;
    }

    scrollElementToCenter(
      container,
      activeElement,
      didIndexChange ? "auto" : "smooth",
    );
  }, [activeIndex, autoFollow, containerRef, enabled, getElementForIndex]);

  return {
    autoFollow,
  };
}
