import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type BlockingLoadingModalProps = {
  open: boolean;
  message: string;
};

export default function BlockingLoadingModal({
  open,
  message,
}: BlockingLoadingModalProps) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-80">
      <div
        className="absolute inset-0 bg-neutral-700 transition-opacity duration-200"
        style={{ opacity: open ? 0.4 : 0 }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div
          className="w-full max-w-sm rounded-sm bg-neutral-50 px-7 py-6 text-center shadow-lg transition-all duration-200"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "scale(1)" : "scale(0.96)",
          }}
          role="status"
          aria-live="polite"
          aria-busy={open}
        >
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-700" />
          <p className="text-neutral-700 font-source">{message}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
