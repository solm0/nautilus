import { useRef, useState } from "react";
import PageCore from "../PageCore";
import type { OCRBlock } from "../pageTypes";
import {
  getNearestTokenIndex,
  isIndexInRanges,
  updateSelectionRanges,
  type SelectionRange,
} from "../pageUtils";

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 8;
const HIGHLIGHT_COLOR = 'var(--color-neutral-300)';
const DRAG_COLOR = "var(--color-neutral-200)";

export default function PagePreview({
  blocks,
  selectedRanges,
  onSelectedRangesChange,
}: {
  blocks: OCRBlock[];
  selectedRanges: SelectionRange[];
  onSelectedRangesChange: (ranges: SelectionRange[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [draftSelection, setDraftSelection] = useState<{
    anchor: number;
    focus: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const pointerDownRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);

  function clearPointerState() {
    pointerDownRef.current = false;
    dragStartRef.current = null;
    didDragRef.current = false;
    setDraftSelection(null);
    setIsSelecting(false);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    pointerDownRef.current = true;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    setIsSelecting(false);

    longPressTimerRef.current = window.setTimeout(() => {
      const index = getNearestTokenIndex(event.clientX, event.clientY);
      if (index == null) return;

      didDragRef.current = true;
      setIsSelecting(true);
      setDraftSelection({ anchor: index, focus: index });
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownRef.current || !dragStartRef.current) return;

    const dx = Math.abs(event.clientX - dragStartRef.current.x);
    const dy = Math.abs(event.clientY - dragStartRef.current.y);

    if (!didDragRef.current && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const index = getNearestTokenIndex(event.clientX, event.clientY);
      if (index == null) return;

      didDragRef.current = true;
      setIsSelecting(true);
      setDraftSelection({ anchor: index, focus: index });
      return;
    }

    if (!didDragRef.current) return;

    event.preventDefault();

    const index = getNearestTokenIndex(event.clientX, event.clientY);
    if (index == null) return;

    setDraftSelection((prev) => (prev ? { ...prev, focus: index } : prev));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {}

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!didDragRef.current || !draftSelection) {
      clearPointerState();
      return;
    }

    onSelectedRangesChange(
      updateSelectionRanges(selectedRanges, {
        start: Math.min(draftSelection.anchor, draftSelection.focus),
        end: Math.max(draftSelection.anchor, draftSelection.focus),
      })
    );

    clearPointerState();
  };

  const draftRange = draftSelection
    ? {
        start: Math.min(draftSelection.anchor, draftSelection.focus),
        end: Math.max(draftSelection.anchor, draftSelection.focus),
      }
    : null;

  return (
    <PageCore
      blocks={blocks}
      containerRef={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      wrapperStyle={{ touchAction: isSelecting ? "none" : "pan-y" }}
      getTokenProps={({ index }) => {
        const isInDraft =
          draftRange != null && index >= draftRange.start && index <= draftRange.end;
        const isSelected = isIndexInRanges(index, selectedRanges);

        return {
          style: {
            padding: "0 3px",
            background: isInDraft ? DRAG_COLOR : isSelected ? HIGHLIGHT_COLOR : "transparent",
          },
          className: "text-neutral-600",
        };
      }}
    />
  );
}
