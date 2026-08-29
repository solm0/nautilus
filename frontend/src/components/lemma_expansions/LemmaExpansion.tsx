import { useEffect, useState } from "react";
import LemmaKwic from "./LemmaKwic";
import type { LemmaData } from "../pageTypes";
import { Star } from "lucide-react";

export default function LemmaExpansion({
  data, onSelect, onToggleFavorite, language, lemmaInfo, favoriteKeys
}: {
  data: LemmaData;
  onSelect: (tokenKey: string) => void;
  onToggleFavorite: (key: string, next: boolean) => Promise<void>;
  language: string;
  lemmaInfo?: Record<string, LemmaData>;
  favoriteKeys?: Set<string>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const globalKey = data.global_key ?? `${data.key.split("_").slice(0, -1).join("_")}/${data.key.split("_").slice(-1)[0]}/${language}`;
  const isFavorite = favoriteKeys?.has(globalKey) ?? data.is_favorite;
  const lemma = data.key.split("_").slice(0, -1).join("_");

  const onFavoriteClick = async () => {
    await onToggleFavorite(globalKey, !isFavorite);
  };

  return (
    <div
      className={`w-full h-full flex flex-col relative overflow-hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute top-1 left-1 z-80 px-2 py-0.5 bg-neutral-100/50 backdrop-blur-2xl rounded-sm">
        {language === "ja" && data.furigana && (
          <div className="text-[10px] leading-tight text-neutral-500">
            {data.furigana}
          </div>
        )}
        <div className="flex gap-1.5 items-center">
          {lemma}
          <Star
            key={data.key}
            size={14}
            className="cursor-pointer text-neutral-400 hover:text-neutral-500"
            fill={isFavorite ? "currentColor" : "transparent"}
            onClick={() => {
              void onFavoriteClick();
            }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="min-h-0 h-full w-full flex items-start">
          <LemmaKwic
            data={data.kwic}
            onSelect={onSelect}
            lemma={data.key}
            language={language}
            lemmaInfo={lemmaInfo}
          />
        </section>
      </div>
    </div>
  );
}
