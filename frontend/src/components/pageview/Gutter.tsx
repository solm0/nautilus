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
}: {
  annotations?: Annotation[];
  containerRef: RefObject<HTMLDivElement | null>;
  setHoverRange: (r: { start: number; end: number } | null) => void;
  setPanelData?: (p: SidePanelState | null) => void;
  annotationId?: number;
  setEmojiPicker?: React.Dispatch<React.SetStateAction<any>>;
}) {
  const groups: { top: number; items: Annotation[] }[] = [];
  const container = containerRef.current;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!setEmojiPicker) return;

      const target = event.target as HTMLElement;

      if (
        target.closest(".EmojiPickerReact")
      ) {
        return;
      }

      setEmojiPicker(null);
    }

    window.addEventListener("mousedown", handleClick);

    return () => {
      window.removeEventListener("mousedown", handleClick);
    };

  }, []);

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
    <div className="w-6 md:w-0 relative">
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
          {group.items.map((annotation, j) => (
            <div
              key={j}
              className={`
                h-6 w-6 rounded text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer flex items-center justify-center
                ${annotationId === annotation.id ? 'bg-neutral-200' : 'bg-transparent'}
                ${annotation.type !== 'emoji' && 'hover:bg-neutral-200'}
              `}
              onMouseEnter={() =>
                setHoverRange({
                  start: annotation.start_index,
                  end: annotation.end_index,
                })
              }
              onMouseLeave={() => setHoverRange(null)}
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
                <span className="leading-none text-xl hover:scale-150 transition-transform ease-in-out">
                  {annotation.content}
                </span>
              ) : annotation.type === "link" ? (
                <Link size={14} className={`${annotationId === annotation.id && 'text-neutral-600'}`} />
              ) : (
                <MessageSquareMore size={14} className={`${annotationId === annotation.id && 'text-neutral-600'}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
