import { useEffect, useState } from "react";
import LemmaRelated from "./LemmaRelated";
import LemmaKwic from "./LemmaKwic";
import type { LemmaData } from "../pageTypes";
import { Star } from "lucide-react";
import { useI18n } from "../../i18n";

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
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const modes = ['related', 'kwic'];
  const [idx, setIdx] = useState(0);
  const globalKey = data.global_key ?? `${data.key.split("_").slice(0, -1).join("_")}/${data.key.split("_").slice(-1)[0]}/${language}`;
  const isFavorite = favoriteKeys?.has(globalKey) ?? data.is_favorite;
  const lemma = data.key.split("_").slice(0, -1).join("_");

  const onFavoriteClick = async () => {
    await onToggleFavorite(globalKey, !isFavorite);
  };

  let content;
  if (idx === 0) {
    content = (
      <section className="h-full min-h-0 w-full flex items-center">
        <LemmaRelated
          data={data.related}
          onSelect={onSelect}
          lemmaKey={data.global_key}
          language={language}
        />
      </section>
    ) 
  } else if (idx === 1) {
    content = (
      <section className="min-h-0 h-full w-full flex items-start">
        <LemmaKwic
          data={data.kwic}
          onSelect={onSelect}
          lemma={data.key}
          language={language}
          lemmaInfo={lemmaInfo}
        />
      </section>
    )
  }

  return (
    <div
      className={`w-full h-full flex flex-col relative overflow-hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute bottom-0 right-0 h-auto flex px-2 z-50">
        <div className="w-auto h-12 flex items-center gap-1.5 text-xs">
          {modes.map((m,i)=>(
            <button
              key={i}
              onClick={()=>setIdx(i)}
              className={`
                ${idx === i ? 'bg-neutral-800 text-neutral-100 px-6':'bg-neutral-200 hover:bg-neutral-300 px-2'}
                py-2 rounded-lg transition-all
              `}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>

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
        {content}
      </div>
    </div>
  );
}
