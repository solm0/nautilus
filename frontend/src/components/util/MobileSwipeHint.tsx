import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "../../i18n";
import "./MobileSwipeHint.css";

type MobileSwipeHintProps = {
  checked: boolean;
  visible: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
};

export function MobileSwipeHint({
  checked,
  visible,
  onCheckedChange,
  onClose,
}: MobileSwipeHintProps) {
  const { t } = useI18n();

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-neutral-900/20 backdrop-blur-md transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lemma-swipe-hint-title"
        className={`absolute inset-0 z-20 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label={t("Close")}
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+2rem)] z-10 rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-200/70"
          onClick={onClose}
        >
          <X className="h-8 w-8" strokeWidth={3} />
        </button>

        <div className="pointer-events-none absolute w-full left-0 px-4 inset-x-10 top-[calc(env(safe-area-inset-top)+7rem)] flex flex-col gap-1 text-left">
          <h2 id="lemma-swipe-hint-title" className="text-lg text-neutral-800">
            {t("Tell us which words you know.")}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-600">
            {t("We'll prioritize examples containing words you know.")}
          </p>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="mobile-swipe-hint-trail absolute left-[44%] top-[62%] h-13 origin-left rounded-full bg-gradient-to-r from-transparent via-neutral-300 to-neutral-500" />
          <div className="mobile-swipe-hint-touch absolute left-[44%] top-[62%] h-13 w-13 rounded-full bg-neutral-400" />
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap text-sm text-neutral-700"
          onClick={() => onCheckedChange(!checked)}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-neutral-600 bg-neutral-600 text-white"
              : "border-neutral-400 bg-white/80"
          }`}>
            {checked ? <Check className="h-3 w-3" /> : null}
          </span>
          {t("Don't show this again")}
        </button>
      </section>
    </>
  );
}

export function MobileSwipeHintCard({
  active,
  children,
  tintOpacity,
}: {
  active: boolean;
  children: ReactNode;
  tintOpacity: number;
}) {
  return (
    <div className={`relative ${
      active ? "mobile-swipe-hint-card pointer-events-none cursor-default" : ""
    }`}>
      {children}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 top-1 z-50 rounded-3xl bg-green-100 mix-blend-multiply transition-opacity duration-100 ${
          active ? "mobile-swipe-hint-tint" : ""
        }`}
        style={active ? undefined : { opacity: tintOpacity }}
      />
    </div>
  );
}
