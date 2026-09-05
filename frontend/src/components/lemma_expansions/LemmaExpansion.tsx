import { useEffect, useState } from "react";
import { Check, Star } from "lucide-react";
import LemmaKwic from "./LemmaKwic";
import type { LemmaData } from "../pageTypes";
import { useI18n } from "../../i18n";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "../ui/toast";

export default function LemmaExpansion({
  data,
  onSelect,
  onToggleInterest,
  language,
  lemmaInfo,
  interestKeys,
  isKnown,
  onMarkKnown,
}: {
  data: LemmaData;
  onSelect: (tokenKey: string) => void;
  onToggleInterest: (key: string, next: boolean) => Promise<void>;
  language: string;
  lemmaInfo?: Record<string, LemmaData>;
  interestKeys?: Set<string>;
  isKnown: boolean;
  onMarkKnown: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [showKnownConfirmation, setShowKnownConfirmation] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const parts = data.key.split("_");
  const pos = parts.pop() ?? "";
  const lemma = parts.join("_");
  const globalKey = data.global_key ?? `${lemma}/${pos}/${language}`;
  const isInterested = interestKeys?.has(globalKey) ?? data.is_interested;

  const handleKnownClick = () => {
    setShowKnownConfirmation(true);
    void onMarkKnown();
  };

  return (
    <ToastProvider duration={3000} swipeDirection="right">
      <div className={`flex h-full w-full flex-col overflow-hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}>
      <section className="min-h-0 w-full flex-1">
        <LemmaKwic
          data={data.kwic}
          onSelect={onSelect}
          lemma={data.key}
          language={language}
          lemmaInfo={lemmaInfo}
          interestKeys={interestKeys}
        />
      </section>

      <footer className="relative flex h-18 shrink-0 items-center justify-center px-4 pb-2 pt-1">
        <button
          type="button"
          aria-label={isInterested ? "관심 단어에서 제거" : "관심 단어로 추가"}
          className={`absolute bottom-5 left-5 rounded-full p-1 transition-colors ${
            isInterested ? "text-yellow-400" : "text-neutral-400 hover:text-neutral-500"
          }`}
          onClick={() => void onToggleInterest(globalKey, !isInterested)}
        >
          <Star
            size={19}
            fill={isInterested ? "currentColor" : "transparent"}
            stroke="currentColor"
          />
        </button>

        <div className="flex min-w-0 flex-col items-center text-center">
          {language === "ja" && data.furigana && (
            <span className="max-w-32 truncate text-[9px] leading-tight text-neutral-400">
              {data.furigana}
            </span>
          )}
          <div className="flex flex-col items-center md:hidden">
            <span className="max-w-36 truncate text-sm leading-tight text-neutral-700">{lemma}</span>
            <span className="text-[9px] leading-4 text-neutral-400">{pos}</span>
          </div>
          {isKnown && !showKnownConfirmation ? (
            <div className="hidden h-10 min-w-24 max-w-40 flex-col items-center justify-center px-2 md:flex">
              <span className="max-w-full truncate text-sm leading-tight text-neutral-700">{lemma}</span>
              <span className="text-[9px] leading-4 text-neutral-400">{pos}</span>
            </div>
          ) : (
            <button
              type="button"
              className={`group relative hidden h-10 min-w-24 max-w-40 flex-col items-center justify-center rounded-lg px-2 transition-colors md:flex ${
                showKnownConfirmation
                  ? "border-none bg-neutral-100"
                  : "border border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
              }`}
              onClick={handleKnownClick}
              disabled={showKnownConfirmation}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100">
                {t("I know this word")}
              </span>
              <span className="relative max-w-full">
                <span className="block truncate text-sm leading-tight text-neutral-700">{lemma}</span>
              </span>
              <span className="text-[9px] leading-4 text-neutral-400">{pos}</span>
            </button>
          )}
        </div>

        <Toast
          open={showKnownConfirmation}
          onOpenChange={setShowKnownConfirmation}
          duration={3000}
          className="border-green-200 bg-green-100 text-sm text-green-700"
        >
          <ToastTitle className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span>{t("You know “{lemma}”.", { lemma })}</span>
          </ToastTitle>
          <ToastDescription className="pl-6 leading-snug">
            {t("sentences containing “{lemma}” will be shown first.", { lemma })}
          </ToastDescription>
        </Toast>
        <ToastViewport className="absolute bottom-full left-1/2 mb-3 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 p-0" />
      </footer>
      </div>
    </ToastProvider>
  );
}
