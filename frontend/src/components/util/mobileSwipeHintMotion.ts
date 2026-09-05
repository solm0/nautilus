import type { CSSProperties } from "react";

export function getMobileSwipeHintMotionStyle(viewportWidth: number) {
  const dragX = Math.min(viewportWidth * 0.46, 240);
  const progress = Math.min(dragX / Math.max(viewportWidth * 0.65, 1), 1);
  const rotation = Math.min(Math.max(dragX / 28, -12), 12);

  return {
    "--mobile-swipe-hint-x": `${dragX}px`,
    "--mobile-swipe-hint-rotation": `${rotation}deg`,
    "--mobile-swipe-hint-scale": String(1 - progress * 0.08),
    "--mobile-swipe-hint-opacity": String(1 - progress * 0.62),
    "--mobile-swipe-hint-tint-opacity": String(progress * 0.82),
  } as CSSProperties;
}
