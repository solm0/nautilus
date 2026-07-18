import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import type { Annotation } from "../pageTypes";
import { createAnnotation, updateAnnotation } from "../../api";
import { updatePendingAnnotation } from "../../offlineData";
import { useTheme } from "../useTheme";

export default function EmojiPickerPopover({
  x,
  y,
  pageId,
  selection,
  annotation,
  offline,
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
  offline: boolean;

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

    const created = await createAnnotation({
      page_id: pageId,
      type: "emoji",
      content: emoji,
      start_index: selection.start,
      end_index: selection.end,
    });

    setAnnotations(prev => [...prev, created]);
  }

  async function updateEmoji(emoji: string) {
    if (!annotation?.id) return;
    const isPending = annotation.id < 0;
    if (offline && !isPending) return;

    const prevEmoji = annotation.content;

    setAnnotations(prev =>
      prev.map(a =>
        a.id === annotation.id
          ? { ...a, content: emoji }
          : a
      )
    );

    try {
      if (isPending) {
        await updatePendingAnnotation(annotation.id, emoji);
      } else {
        await updateAnnotation(annotation.id, emoji);
      }
    } catch {
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
        emojiStyle={EmojiStyle.NATIVE}
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
          const action = annotation
            ? updateEmoji(e.emoji)
            : createEmoji(e.emoji);
          void action.catch(() => null).finally(close);
        }}
      />
    </div>
  );
}
