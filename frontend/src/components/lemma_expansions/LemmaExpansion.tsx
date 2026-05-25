import { useEffect, useState } from "react";
import LemmaRelated from "./LemmaRelated";
import LemmaKwic from "./LemmaKwic";
import type { LemmaData } from "../pageTypes";
import { Star } from "lucide-react";

export default function LemmaExpansion({
  data, onSelect, onToggleFavorite, language, lemmaInfo
}: {
  data: LemmaData;
  onSelect: (tokenKey: string) => void;
  onToggleFavorite: (key: string, next: boolean) => Promise<void>;
  language: string;
  lemmaInfo?: Record<string, LemmaData>;
}) {
  const [visible, setVisible] = useState(false);
  const [isFavoriteLocal, setIsFavoriteLocal] = useState(data.is_favorite);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const modes = ['related', 'kwic'];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIsFavoriteLocal(!!data.is_favorite);
  }, [data.key, data.is_favorite]);

  const onFavoriteClick = async (key: string) => {
    const parts = key.split('_');
    const pos = parts.pop()!;
    const lemma = parts.join('_');

    const globalKey = `${lemma}/${pos}/${language}`;

    const next = !isFavoriteLocal;

    setIsFavoriteLocal(next);

    try {
      await onToggleFavorite(globalKey, next);
    } catch {
      setIsFavoriteLocal(!next);
    }
  }

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
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute top-1 left-1 flex gap-1.5 items-center z-80 px-2 py-0.5 bg-neutral-100/50 backdrop-blur-2xl rounded-sm">
        {data.key.split('_')[0]}
        <Star key={data.key} size={14} className="text-neutral-400 hover:text-neutral-500 cursor-pointer" fill={isFavoriteLocal ? "currentColor" : "transparent"} onClick={() => onFavoriteClick(data.key)} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {content}
      </div>
    </div>
  );
}
