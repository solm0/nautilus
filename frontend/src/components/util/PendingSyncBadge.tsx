import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlobeX } from "lucide-react";

import { useI18n } from "../../i18n";

export default function PendingSyncBadge() {
  const { t } = useI18n();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const showTooltip = () => {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;

    setTooltipPosition({
      left: rect.left + rect.width / 2,
      top: rect.top - 4,
    });
  };

  return (
    <>
      <span
        ref={badgeRef}
        className="relative inline-flex items-center gap-1 text-xs text-orange-600/50"
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltipPosition(null)}
      >
        <GlobeX size={12} />
      </span>
      {tooltipPosition && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm bg-neutral-50 px-2 py-1 text-xs text-neutral-400 shadow-sm"
              style={tooltipPosition}
            >
              {t("Uploads when you're back online.")}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
