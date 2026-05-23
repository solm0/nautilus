import { useEffect, useRef, type ReactNode } from "react";

export function MiniPopup({
  open, onClose, children, big = false, left = false, row = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  big?: boolean;
  left?: boolean;
  row?: boolean;
}) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!open) return;
      if (popupRef.current?.contains(event.target as Node)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose]);

  return (
    <div
      ref={popupRef}
      className={`
        absolute
        ${big ? 'w-72 md:w-96' : 'w-36'}
        ${left ? `${row ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1'}` : `${row ? 'right-full top-0 mr-2' : 'right-0 top-full mt-1'}`}
        rounded-md
        bg-neutral-50
        shadow-lg
        text-xs
        overflow-hidden
        z-80
        transition-all
        ${open
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
        }
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
