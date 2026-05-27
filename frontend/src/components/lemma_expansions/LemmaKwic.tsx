import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { TokenInLemmaExpansion } from "./TokenInLemmaExpansion";
import type { KwicData, LemmaData } from "../pageTypes";
import { IconButton } from "../util/Button";
import { AlignCenterVertical } from "lucide-react";
import { lemmaLookup } from "../../api";
import { getLookupKey, getLookupKeyForMorph } from "../tokenLookup";

function highlightIntersect(
  surface: string,
  lemma: string
): React.ReactNode[] {

  const s = [...surface];
  const l = [...lemma.toLowerCase()];

  const n = s.length;
  const m = l.length;

  // dp[i][j] = LCS length
  const dp = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {

      if (s[i - 1].toLowerCase() === l[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(
          dp[i - 1][j],
          dp[i][j - 1]
        );
      }
    }
  }

  // backtrack matched chars
  const matched = new Set<number>();

  let i = n;
  let j = m;

  while (i > 0 && j > 0) {

    if (s[i - 1].toLowerCase() === l[j - 1]) {
      matched.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return s.map((ch, idx) => (
    <span
      key={idx}
      className={
        matched.has(idx)
          ? "bg-neutral-200 z-10 h-full flex items-center"
          : "z-10 h-full flex items-center"
      }
    >
      {ch}
    </span>
  ));
}

interface KwicRowProps {
  d: KwicData;
  lemma: string;
  language: string;
  onSelect: (tokenKey: string) => void;
  canSelectKey?: (tokenKey: string) => boolean;
  hovered: { pos: string | null; dep: string | null, x: number, y: number };
  setHovered: React.Dispatch<React.SetStateAction<{ pos: string | null; dep: string | null, x: number, y: number }>>
}

interface KwicRowHandle {
  setCenter: () => void;
}

// KwicData의 tokens 배열 원소 타입을 추론
type Token = KwicData["tokens"][number];

const KwicRow = forwardRef<KwicRowHandle, KwicRowProps>(function KwicRow(
  { d, lemma, language, onSelect, canSelectKey, hovered, setHovered },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  const tokens = d.tokens;
  const baseLemma = lemma.split("_")[0];
  const targetIdx = d.match_indices[0] ?? tokens.findIndex((t) => t.lemma === baseLemma);

  const left = tokens.slice(0, targetIdx);
  const target = tokens[targetIdx];
  const right = tokens.slice(targetIdx + 1);

  const setCenter = () => {
    const container = scrollRef.current;
    const leftEl = leftRef.current;
    if (!container || !leftEl) return;
    container.scrollTo({
      left: leftEl.scrollWidth - container.clientWidth / 2.5,
      behavior: "smooth",
    });
  };

  useImperativeHandle(ref, () => ({ setCenter }));

  useEffect(() => {
    // rAF으로 레이아웃 확정 후 실행 — 마운트 직후 scrollTo race condition 방지
    const id = requestAnimationFrame(() => {
      setCenter();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const renderToken = (t: Token, j: number) => (
    <div
      key={j}
      className="relative isolate h-full flex items-center px-1 shrink-0"
      onMouseEnter={(e) =>
        setHovered({
          pos: t.pos,
          dep: t.dep,
          x: e.clientX,
          y: e.clientY,
        })
      }
      onMouseLeave={() => setHovered({ pos: null, dep: null,  x: 0, y: 0  })}
      onMouseMove={(e) =>
        setHovered((prev) => ({
          ...prev,
          x: e.clientX,
          y: e.clientY,
        }))
      }
    >
      {/* pointer-events-none으로 stacking context 충돌 방지 */}
      <div
        className={[
          "transition-colors pointer-events-none absolute inset-0 z-0 h-10",
          hovered.pos === t.pos ? "bg-nt-mint opacity-50" : "opacity-0",
        ].join(" ")}
      />
      <div className="relative z-10">
        <TokenInLemmaExpansion
          token={t}
          language={language}
          onSelect={onSelect}
          canSelectKey={canSelectKey}
        />
      </div>
    </div>
  );

  // targetIdx를 못 찾은 경우 렌더링 스킵
  if (targetIdx === -1 || !target) return null;

  return (
    <div
      ref={scrollRef}
      className="w-full shrink-0 overflow-x-auto overflow-y-visible no-scrollbar h-auto"
      style={{ overscrollBehaviorX: 'contain' }}
    >
      <div className="flex items-center whitespace-nowrap">
        {/* 왼쪽: width 고정 + overflow hidden으로 레이아웃 안정화 */}
        <div
          ref={leftRef}
          className="flex justify-end shrink-0 "
          style={{ width: "50vw" }}
        >
          <div className="flex h-10">{left.map((t, j) => renderToken(t, j))}</div>
        </div>

        <div className="relative px-2 flex shrink-0 items-center h-10">
          <div className="absolute inset-0 opacity-50 pointer-events-none" />
          {highlightIntersect(target.surface, baseLemma)}
        </div>

        <div
          className="flex justify-start shrink-0 "
          style={{ width: "50vw" }}
        >
          <div className="flex h-10">{right.map((t, j) => renderToken(t, j))}</div>
        </div>
      </div>
    </div>
  );
});

export default function LemmaKwic({
  data,
  onSelect,
  lemma,
  language,
  lemmaInfo,
}: {
  data: KwicData[];
  onSelect: (tokenKey: string) => void;
  lemma: string;
  language: string;
  lemmaInfo?: Record<string, LemmaData>;
}) {
  const [hovered, setHovered] = useState<{
    pos: string | null;
    dep: string | null;
    x: number;
    y: number;
  }>({
    pos: null,
    dep: null,
    x: 0,
    y: 0,
  });

  const rowRefs = useRef<(KwicRowHandle | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const attemptedKeysRef = useRef(new Set<string>());
  const inflightKeysRef = useRef(new Set<string>());
  const [availableKeys, setAvailableKeys] = useState<Record<string, LemmaData>>(
    () => lemmaInfo ?? {},
  );
  const [loadingLemma, setLoadingLemma] = useState(false);

  const canSelectKey = (tokenKey: string) => {
    if (availableKeys[tokenKey] != null) {
      return true;
    }

    return !attemptedKeysRef.current.has(tokenKey);
  };

  useEffect(() => {
    setAvailableKeys(lemmaInfo ?? {});
  }, [lemmaInfo]);

  useEffect(() => {
    attemptedKeysRef.current.clear();
    inflightKeysRef.current.clear();
    setLoadingLemma(false);
  }, [data, language, lemma]);

  const lookupItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ lemma: string; pos: string }> = [];

    for (const row of data) {
      for (const token of row.tokens) {
        const tokenKey = getLookupKey(token, language);

        if (tokenKey && !seen.has(tokenKey)) {
          const parts = tokenKey.split("_");
          const tokenPos = parts.pop();
          const tokenLemma = parts.join("_");
          if (tokenLemma && tokenPos) {
            seen.add(tokenKey);
            items.push({ lemma: tokenLemma, pos: tokenPos });
          }
        }

        for (const morph of token.morphs ?? []) {
          const morphKey = getLookupKeyForMorph(morph, language);

          if (!morphKey || seen.has(morphKey)) {
            continue;
          }

          const parts = morphKey.split("_");
          const morphPos = parts.pop();
          const morphLemma = parts.join("_");

          if (!morphLemma || !morphPos) {
            continue;
          }

          seen.add(morphKey);
          items.push({ lemma: morphLemma, pos: morphPos });
        }
      }
    }

    return items.filter(({ lemma, pos }) => {
      const key = `${lemma}_${pos}`;

      if (availableKeys[key] != null) {
        return false;
      }

      if (attemptedKeysRef.current.has(key)) {
        return false;
      }

      if (inflightKeysRef.current.has(key)) {
        return false;
      }

      return true;
    });
  }, [availableKeys, data, language]);

  useEffect(() => {
    if (lookupItems.length === 0) {
      setLoadingLemma(false);
      return;
    }

    let cancelled = false;
    const pendingKeys = new Set(
      lookupItems.map(({ lemma, pos }) => `${lemma}_${pos}`),
    );

    pendingKeys.forEach((key) => inflightKeysRef.current.add(key));
    setLoadingLemma(true);

    void lemmaLookup(lookupItems, language)
      .then((lookupData) => {
        if (cancelled) return;

        pendingKeys.forEach((key) => attemptedKeysRef.current.add(key));
        setAvailableKeys((prev) => ({ ...prev, ...lookupData }));
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;

        pendingKeys.forEach((key) => inflightKeysRef.current.delete(key));
        setLoadingLemma(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lookupItems, language]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-0 w-full overflow-hidden"
    >
      <div className="absolute top-2 right-3 ml-auto">
        <IconButton
          icon={<AlignCenterVertical size={16} />}
          onClick={() => rowRefs.current.forEach((r) => r?.setCenter())}
          title="align center"
        />
      </div>

      <div className="w-full h-full flex-col overflow-y-auto no-scrollbar pt-14 pb-22 shrink-0">
        {data.map((d, i) => (
          <KwicRow
            key={i}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            d={d}
            lemma={lemma}
            language={language}
            onSelect={onSelect}
            canSelectKey={canSelectKey}
            hovered={hovered}
            setHovered={setHovered}
          />
        ))}
      </div>

      {loadingLemma && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-50/90 px-3 py-1 text-xs text-neutral-500 shadow-sm backdrop-blur-sm">
          Fetching lemmas...
        </div>
      )}

      {hovered.pos && (
        <div
          className="absolute z-[9999] pointer-events-none px-1 py-0.5 rounded-sm
                    bg-neutral-800 text-neutral-100 text-xs transition-transform duration-75"
          style={{
            left: Math.min(
              (containerRef.current?.clientWidth ?? 0) - 120,
              hovered.x -
                (containerRef.current?.getBoundingClientRect().left ?? 0) +
                12
            ),
            top: Math.min(
              (containerRef.current?.clientHeight ?? 0) - 60,
              hovered.y -
                (containerRef.current?.getBoundingClientRect().top ?? 0) +
                12
            ),
          }}
        >
          {hovered.pos}
        </div>
      )}
    </div>
  );
}
