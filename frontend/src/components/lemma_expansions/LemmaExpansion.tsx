import { useEffect, useRef, useState } from "react";
import { Check, Star } from "lucide-react";
import LemmaKwic from "./LemmaKwic";
import type { LemmaData } from "../pageTypes";
import { useI18n } from "../../i18n";

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
  const confirmationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => {
    if (confirmationTimerRef.current !== null) {
      window.clearTimeout(confirmationTimerRef.current);
    }
  }, []);

  const parts = data.key.split("_");
  const pos = parts.pop() ?? "";
  const lemma = parts.join("_");
  const globalKey = data.global_key ?? `${lemma}/${pos}/${language}`;
  const isInterested = interestKeys?.has(globalKey) ?? data.is_interested;

  const handleKnownClick = () => {
    setShowKnownConfirmation(true);
    void onMarkKnown();
    confirmationTimerRef.current = window.setTimeout(() => {
      setShowKnownConfirmation(false);
    }, 650);
  };

  return (
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
          <span className="max-w-36 truncate text-sm leading-tight text-neutral-700">{lemma}</span>
          <span className="text-[9px] leading-4 text-neutral-400">{pos}</span>
        </div>

        {(!isKnown || showKnownConfirmation) && (
          <button
            type="button"
            className="absolute bottom-5 right-3 hidden min-w-16 items-center justify-center text-[9px] text-neutral-400 transition-opacity hover:text-neutral-600 md:flex"
            onClick={handleKnownClick}
            disabled={showKnownConfirmation}
          >
            {showKnownConfirmation ? <Check className="h-4 w-4 text-green-500" /> : t("I know this word")}
          </button>
        )}
      </footer>
    </div>
  );
}
