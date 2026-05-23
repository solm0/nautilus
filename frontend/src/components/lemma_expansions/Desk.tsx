import { useCallback, useEffect, useRef, useState } from "react";
import Breadcrumb, { type D3Node } from "./Breadcrumb.tsx";
import type { TreeNode } from "../../types.ts";
import type { LemmaData } from "../pageTypes.ts";
import LemmaExpansionWrapper from "./LemmaExpansionWrapper.tsx";

export default function Desk({
  initialLemma,
  onToggleFavorite,
  language,
}: {
  initialLemma: LemmaData;
  onToggleFavorite: (key: string, next:boolean) => Promise<void>;
  language: string;
}) {
  const breadcrumbRef = useRef<{ addNode: (parentLemma: string, newNode: TreeNode) => void }>(null);
  const [activeNode, setActiveNode] = useState<D3Node | null>(null);
  const [lemmaDatas, setLemmaDatas] = useState<LemmaData[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(initialLemma.key);
  const [lemmaStatus, setLemmaStatus] = useState<Record<string, "loading" | "ready">>({});
  const prevActiveLemmaRef = useRef<string | null>(null);

  useEffect(() => {
    setLemmaDatas([initialLemma]);
  }, [])

  const addLemmaData = useCallback((lemmaData: LemmaData, autoActivate = true) => {
    setLemmaDatas(prev => {
      if (prev.find(l => l.key === lemmaData.key)) return prev;
      return [...prev, lemmaData];
    });
    if (autoActivate) setActiveKey(lemmaData.key);
  }, []);

  // breadcrumb 클릭
  useEffect(() => {
    const nextLemmaKey = activeNode?.data.lemma ?? null;
    if (prevActiveLemmaRef.current === nextLemmaKey) return;
    prevActiveLemmaRef.current = nextLemmaKey;

    if (!nextLemmaKey) return;
    const hasLemmaData = lemmaDatas.some(l => l.key === nextLemmaKey);
    const isLoading = lemmaStatus[nextLemmaKey] === "loading";
    if (hasLemmaData && !isLoading) setActiveKey(nextLemmaKey);
  }, [activeNode, lemmaDatas, lemmaStatus])

  useEffect(() => {
    if (!activeKey) return;
    if (lemmaStatus[activeKey] !== "ready") return;
    setLemmaStatus(prev => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
  }, [activeKey, lemmaStatus]);

  const handleTokenSelect = (tokenKey: string) => {
    const parentLemma = activeNode?.data.lemma ?? activeKey;
    if (!parentLemma) return;
    breadcrumbRef.current?.addNode(parentLemma, { lemma: tokenKey });
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <Breadcrumb
        ref={breadcrumbRef}
        initialLemmaKey={initialLemma.key}
        activeNode={activeNode}
        setActiveNode={setActiveNode}
        nodeStatusByLemma={lemmaStatus}
      />
      <LemmaExpansionWrapper
        activeNode={activeNode}
        lemmaDatas={lemmaDatas}
        activeKey={activeKey}
        addLemmaData={addLemmaData}
        onLemmaFetchStart={(lemmaKey:string) => {
          setLemmaStatus(prev => ({
            ...prev,
            [lemmaKey]: "loading",
          }));
        }}
        onLemmaFetchSuccess={(lemmaKey:string) => {
          setLemmaStatus(prev => ({
            ...prev,
            [lemmaKey]: "ready",
          }));
        }}
        onLemmaFetchError={(lemmaKey:string) => {
          setLemmaStatus(prev => {
            const next = { ...prev };
            delete next[lemmaKey];
            return next;
          });
        }}
        onSelect={handleTokenSelect}
        onToggleFavorite={onToggleFavorite}
        language={language}
      />
    </div>
  )
}
