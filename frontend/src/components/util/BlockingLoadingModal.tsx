import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";

type BlockingLoadingModalProps = {
  open: boolean;
  message: string;
  usePortal?: boolean;
};

export default function BlockingLoadingModal({
  open,
  message,
  usePortal = true,
}: BlockingLoadingModalProps) {
  const [mounted, setMounted] = useState(open);
  const { t } = useI18n();

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

  const modalContent = (
    <div className={`${usePortal ? "fixed" : "absolute"} inset-0 z-80`}>
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
          <p className="text-neutral-700 font-source">{t(message)}</p>
        </div>
      </div>
    </div>
  );

  if (!usePortal) {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
