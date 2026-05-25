import { useEffect, useRef } from "react";
import LemmaExpansion from "./LemmaExpansion";
import type { D3Node } from "./Breadcrumb";
import type { LemmaData } from "../pageTypes";
import { lemmaLookupOne } from "../../api";
import { CircleAlert } from "lucide-react";

export default function LemmaExpansionWrapper({
  activeNode,
  lemmaDatas,
  activeKey,
  addLemmaData,
  onLemmaFetchStart,
  onLemmaFetchSuccess,
  onLemmaFetchError,
  onSelect,
  onToggleFavorite,
  language,
  lemmaInfo,
}: {
  activeNode: D3Node | null;
  lemmaDatas: LemmaData[] ;
  activeKey: string | null;
  addLemmaData: (layout: LemmaData, autoActivate?: boolean) => void;
  onLemmaFetchStart?: (lemmaKey: string) => void;
  onLemmaFetchSuccess?: (lemmaKey: string) => void;
  onLemmaFetchError?: (lemmaKey: string) => void;
  onSelect: (tokenKey: string) => void;
  onToggleFavorite: (key: string, next:boolean) => Promise<void>;
  language: string;
  lemmaInfo?: Record<string, LemmaData>;
}) {
  const inflightRef = useRef(new Set<string>());
  const statusRef = useRef(new Map<string, "loading" | "success" | "error">());

  useEffect(() => {
    const lemmaKey = activeNode?.data.lemma;
    const [lemma, pos] = lemmaKey?.split('_') ?? [];

    if (!lemmaKey || !pos ) return;

    if (lemmaDatas.find(l => l.key === lemmaKey)) return;
    if (inflightRef.current.has(lemmaKey)) return;

    inflightRef.current.add(lemmaKey);
    statusRef.current.set(lemmaKey, "loading");
    onLemmaFetchStart?.(lemmaKey);

    (async () => {
      try {
        const data = await lemmaLookupOne({ lemma, pos }, language);
        statusRef.current.set(lemmaKey, "success");
        addLemmaData(data);
        onLemmaFetchSuccess?.(lemmaKey);
      } catch {
        statusRef.current.set(lemmaKey, "error");
        onLemmaFetchError?.(lemmaKey);
      } finally {
        inflightRef.current.delete(lemmaKey);
      }

    })();
  }, [activeNode, lemmaDatas, addLemmaData, onLemmaFetchStart, onLemmaFetchSuccess, onLemmaFetchError]);

  const lemmaData = lemmaDatas.find(l => l.key === activeKey)
  const status = activeKey ? statusRef.current.get(activeKey) : undefined;

  if (status === "loading" && !lemmaData) {
    return null;
  }
  if (status === "error" || lemmaData && lemmaData.related.length == 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <CircleAlert size={20} />
        We couldn’t find this word.
      </div>
    );
  }
  if (lemmaData && lemmaData.related.length > 0) {
    return (
      <LemmaExpansion
        data={lemmaData}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        language={language}
        lemmaInfo={lemmaInfo}
      />
    );
  }
  return null;
}
