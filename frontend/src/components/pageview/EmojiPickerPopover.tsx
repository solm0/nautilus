import EmojiPicker, { Theme } from "emoji-picker-react";
import type { Annotation } from "../pageTypes";
import { authHeaders, CENTRAL_API } from "../../api";
import { useTheme } from "../useTheme";

export default function EmojiPickerPopover({
  x,
  y,
  pageId,
  selection,
  annotation,
  setAnnotations,
  close,
}: {
  x: number;
  y: number;

  pageId?: number;

  selection?: {
    start: number;
    end: number;
  };

  annotation?: Annotation;

  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;

  close: () => void;
}) {
  const { theme } = useTheme();
  const PICKER_WIDTH = 320;
  const PICKER_HEIGHT = 420;

  const left = Math.min(
    Math.max(12, x),
    window.innerWidth - PICKER_WIDTH - 100
  );

  const top = Math.min(
    Math.max(12, y),
    window.innerHeight - PICKER_HEIGHT - 12
  );

  async function createEmoji(emoji: string) {
    if (!selection || !pageId) return;

    const optimistic: Annotation = {
      page_id: pageId,
      type: "emoji",
      content: emoji,
      start_index: selection.start,
      end_index: selection.end,
    };

    setAnnotations(prev => [...prev, optimistic]);

    const headers = authHeaders()
    if (!headers) throw new Error("no token")

    const response = await fetch(`${CENTRAL_API}/annotations`, {
      method: "POST",
      headers,
      body: JSON.stringify(optimistic),
    });

    if (!response.ok) return;

    const saved = await response.json();

    setAnnotations(prev =>
      prev.map(a =>
        a === optimistic ? saved : a
      )
    );
  }

  async function updateEmoji(emoji: string) {
    if (!annotation?.id) return;

    const prevEmoji = annotation.content;

    setAnnotations(prev =>
      prev.map(a =>
        a.id === annotation.id
          ? { ...a, content: emoji }
          : a
      )
    );

    const headers = authHeaders()
    if (!headers) throw new Error("no token")

    const response = await fetch(
      `${CENTRAL_API}/annotations/${annotation.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          content: emoji,
        }),
      }
    );

    if (!response.ok) {
      setAnnotations(prev =>
        prev.map(a =>
          a.id === annotation.id
            ? { ...a, content: prevEmoji }
            : a
        )
      );
    }
  }

  return (
    <div
      className="fixed z-999 shadow-lg rounded-lg overflow-hidden"
      style={{ left, top }}
    >
      <EmojiPicker
        theme={
          theme === "dark"
            ? Theme.DARK
            : Theme.LIGHT
        }
        searchDisabled
        skinTonesDisabled
        previewConfig={{ showPreview: false }}
        lazyLoadEmojis
        width={300}
        height={400}
        reactionsDefaultOpen={false}
        onEmojiClick={(e) => {
          if (annotation) {
            updateEmoji(e.emoji);
          } else {
            createEmoji(e.emoji);
          }

          close();
        }}
      />
    </div>
  );
}
