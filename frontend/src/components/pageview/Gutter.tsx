import { useEffect, type RefObject } from "react";
import type { Annotation } from "../pageTypes";
import { getTokenRect } from "../pageUtils";
import { Link, MessageSquareMore } from "lucide-react";
import type { SidePanelState } from "./PageView";

export function Gutter({
  annotations,
  containerRef,
  setHoverRange,
  setPanelData,
  annotationId,
  setEmojiPicker,
  offline = false,
}: {
  annotations?: Annotation[];
  containerRef: RefObject<HTMLDivElement | null>;
  setHoverRange: (r: { start: number; end: number } | null) => void;
  setPanelData?: (p: SidePanelState | null) => void;
  annotationId?: number;
  setEmojiPicker?: React.Dispatch<React.SetStateAction<any>>;
  offline?: boolean;
}) {
  const groups: { top: number; items: Annotation[] }[] = [];
  const container = containerRef.current;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;

      if (target.closest("[data-gutter-annotation]")) {
        return;
      }

      setHoverRange(null);

      if (!target.closest(".EmojiPickerReact")) {
        setEmojiPicker?.(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };

  }, [setEmojiPicker, setHoverRange]);

  if (!container) return;
  const containerRect = container.getBoundingClientRect();

  annotations?.forEach((annotation) => {
    const rect = getTokenRect(container, annotation.start_index);
    if (!rect) return;

    const top = rect.top - containerRect.top + 48;

    let found = false;

    for (const group of groups) {
      if (Math.abs(group.top - top) < rect.height * 0.6) {
        group.items.push(annotation);
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push({ top, items: [annotation] });
    }
  });

  return (
    <div className="absolute top-0 right-0 z-20 w-0 opacity-50 md:relative md:top-auto md:right-auto md:z-auto md:opacity-100">
      {groups.map((group, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: group.top,
            right: 12,
          }}
          className="flex gap-0.5"
        >
          {group.items.map((annotation, j) => {
            const disableEmojiEdit =
              annotation.type === "emoji" &&
              offline &&
              (annotation.id ?? 0) >= 0;

            return (
              <div
                key={j}
                data-gutter-annotation="true"
                className={`
                  h-6 w-6 rounded text-neutral-700 transition-colors flex items-center justify-center
                  ${disableEmojiEdit ? "pointer-events-none cursor-default opacity-50" : "cursor-pointer"}
                  ${annotationId === annotation.id ? 'bg-neutral-100' : 'bg-transparent'}
                  ${!disableEmojiEdit && 'hover:bg-neutral-100'}
                `}
              onPointerEnter={() =>
                setHoverRange({
                  start: annotation.start_index,
                  end: annotation.end_index,
                })
              }
              onPointerDown={() =>
                setHoverRange({
                  start: annotation.start_index,
                  end: annotation.end_index,
                })
              }
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") {
                  setHoverRange(null);
                }
              }}
              onPointerCancel={() => setHoverRange(null)}
              onClick={(e) => {
                if (annotation.type === "emoji") {

                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();

                  setEmojiPicker?.({
                    x: rect.left,
                    y: rect.bottom + 8,
                    annotation,
                  });

                  return;
                }

                if (!setPanelData) return;

                setPanelData({
                  type: "annotation:view",
                  data: annotation
                });
              }}
            >
              {annotation.type === "emoji" ? (
                <span className={`leading-none text-xl`}>
                  {annotation.content}
                </span>
              ) : annotation.type === "link" ? (
                <Link size={14} className={`${annotationId === annotation.id && 'text-neutral-700'}`} />
              ) : (
                <MessageSquareMore size={14} className={`${annotationId === annotation.id && 'text-neutral-700'}`} />
              )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
