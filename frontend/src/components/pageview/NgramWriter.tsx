import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";
import { Scissors, UnfoldHorizontal } from "lucide-react";
import { LOCAL_API } from "../../api";

type Prediction = [string, number];
export type NgramWriterHandle = {
  flushPendingInput: () => string[];
  hasText: () => boolean;
};
type NgramWriterProps = {
  tokens: string[];
  setTokens: React.Dispatch<React.SetStateAction<string[]>>;
  language: string;
  cut?: boolean;
  onHasTextChange?: (hasText: boolean) => void;
  autofocus?: boolean;
};

const normalizePredictions = (v: any): Prediction[] => {
  return Array.isArray(v) ? v : [];
};

const NgramWriter = forwardRef<NgramWriterHandle, NgramWriterProps>(({
  tokens,
  setTokens,
  language,
  cut = false,
  onHasTextChange,
  autofocus = true
}, ref) => {
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const [inputWidth, setInputWidth] = useState(100);

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const lastQueryRef = useRef("");

  const [isComposing, setIsComposing] = useState(false); // 한/일 입력 시
  const lastPredictRef = useRef("");

  const getContextTokens = (
    targetInsertIndex: number | null = insertIndex,
    sourceTokensOverride?: string[],
  ) => {
    const sourceTokens = sourceTokensOverride
      ?? (
        targetInsertIndex !== null
          ? tokens.slice(0, targetInsertIndex + 1)
          : tokens
      );

    let sentenceTokens = ["<s>"];

    sourceTokens.forEach((token) => {
      if (token === "<s>" || token === "\n") {
        sentenceTokens = ["<s>"];
        return;
      }

      sentenceTokens.push(token);
    });

    if (sentenceTokens.length <= 3) {
      return sentenceTokens;
    }

    return sentenceTokens.slice(-2);
  };

  const getContextParam = (
    targetInsertIndex: number | null = insertIndex,
    sourceTokensOverride?: string[],
  ) => JSON.stringify(getContextTokens(targetInsertIndex, sourceTokensOverride));

  const fetchPredictions = async (contextParam: string) => {

    lastPredictRef.current = contextParam;

    const res = await axios.get(`${LOCAL_API}/predict`, {
      params: { context: contextParam, language },
    });

    if (lastPredictRef.current !== contextParam) return;

    setPredictions(res.data.predictions ?? []);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  // ---------- auto width ----------
  useEffect(() => {
    if (mirrorRef.current) {
      mirrorRef.current.textContent = input || " ";
      const w = Math.max(mirrorRef.current.offsetWidth + 12, 100);
      setInputWidth(w);
    }
  }, [input]);

  // insert 위치 바뀌면 width 초기화
  useEffect(() => {
    setInputWidth(100);
  }, [insertIndex]);

  // ---------- commit ----------
  const buildTokensWithWord = (
    word: string,
    sourceTokens = tokens,
    targetInsertIndex = insertIndex,
  ) => {
    if (targetInsertIndex !== null) {
      const safeIndex = Math.max(targetInsertIndex, 0); // <s> 이후만 허용

      return [
        ...sourceTokens.slice(0, safeIndex + 1),
        word,
        ...sourceTokens.slice(safeIndex + 1),
      ];
    }

    return [...sourceTokens, word];
  };

  const commitToken = (word: string) => {
    const newTokens = buildTokensWithWord(word);
    if (insertIndex !== null) {
      setInsertIndex(Math.max(insertIndex, 0) + 1);
    }
    setTokens(newTokens);
    setInput("");
  };

  const getTokensWithPendingInput = (sourceTokens = tokens) => {
    const word = input.trim();
    if (!word) {
      return sourceTokens;
    }

    return buildTokensWithWord(word, sourceTokens);
  };

  useImperativeHandle(ref, () => ({
    flushPendingInput() {
      const nextTokens = getTokensWithPendingInput();
      if (nextTokens !== tokens) {
        if (insertIndex !== null) {
          setInsertIndex(Math.max(insertIndex, 0) + 1);
        }
        setTokens(nextTokens);
        setInput("");
      }
      return nextTokens;
    },
    hasText() {
      return getTokensWithPendingInput().some(
        (token) => token !== "<s>" && token !== "\n"
      );
    },
  }), [input, insertIndex, tokens]);

  useEffect(() => {
    onHasTextChange?.(
      getTokensWithPendingInput().some(
        (token) => token !== "<s>" && token !== "\n"
      )
    );
  }, [input, onHasTextChange, tokens]);

  const commitNewline = () => {
    let newTokens;

    if (insertIndex !== null) {
      newTokens = [
        ...tokens.slice(0, insertIndex + 1),
        "\n",
        ...tokens.slice(insertIndex + 1),
      ];
      setInsertIndex(insertIndex + 1);
    } else {
      newTokens = [...tokens, "\n"];
    }

    setTokens(newTokens);
    setInput("");

    // 👉 텍스트는 유지하고 context만 reset
    fetchPredictions(JSON.stringify(["<s>"]));
  };

  const truncateFrom = (index: number) => {
    const newTokens = tokens.slice(0, Math.max(index + 1, 1)); // 최소 ["<s>"]
    setTokens(newTokens);
    setInsertIndex(null);
    fetchPredictions(getContextParam(null, newTokens));
  };

  const resetContext = () => {
    setInsertIndex(null);
    setInput("");
    fetchPredictions(JSON.stringify(["<s>"]));
  };

  const enableInsert = (index: number) => {
    if (index === 0) return;
    setInsertIndex(index);
    fetchPredictions(getContextParam(index));
  };

  // ---------- probability → color ----------
  const bgFromProb = (p: number) => {
    const alpha = 0.1 + p * 2;
    return `rgb(var(--color-nt-blue-rgb) / ${alpha})`;
  };

  // ---------- rows ----------
  const rows = [
    predictions.slice(6, 8),
    predictions.slice(0, 3),
    predictions.slice(3, 6),
    predictions.slice(8, 10),
  ];

  const columnPos = -100;
  const rowOffsets = [-68, -38, 20, 50];
  const columnOffsets = [0, 20, 20, 0];

  // --------- search ---------
  const fetchSearch = async (q: string) => {
    const contextParam = getContextParam();
    const requestKey = `${q}::${contextParam}`;
    lastQueryRef.current = requestKey;

    const res = await axios.get(`${LOCAL_API}/search`, {
      params: { q, language, context: contextParam },
    });
    console.log("search res:", res.data);

    // outdated response 무시
    if (lastQueryRef.current !== requestKey) return;

    if (res.data.predictions.length > 0) {
      setPredictions(normalizePredictions(res.data.predictions));
    } else {
      fetchPredictions(contextParam);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (input.length >= 3) {
        // prefix search
        fetchSearch(input);
      } else {
        // fallback → 기존 context 기반 prediction
        fetchPredictions(getContextParam());
      }
    }, 50);

    return () => clearTimeout(handler);
  }, [input, insertIndex, tokens]);

  // ---------- input block ----------
  const InputBlock = (
    <div
      className="relative flex items-center"
      style={{
        minHeight: predictions.length ? 140 : undefined,
      }}
    >
      <input
        ref={inputRef}
        style={{ width: inputWidth }}
        className="border-b border-neutral-300 focus:border-neutral-400 outline-none px-1 min-w-24 leading-6"
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);

          // 공백 기준 commit
          if (!isComposing && v.endsWith(" ")) {
            const word = v.trim();
            if (word) commitToken(word);
          }
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          setInput(e.currentTarget.value);
        }}
        autoFocus={autofocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />

      <span
        ref={mirrorRef}
        className="absolute invisible whitespace-pre text-lg px-2"
      />

      {/* suggestions */}
      <div className="absolute left-full top-1/2 -translate-y-1/2">
        {rows.map((row, rowIdx) => {
          const x = columnPos + columnOffsets[rowIdx];
          const y = rowOffsets[rowIdx];

          return (
            <div
              key={rowIdx}
              className="absolute flex gap-1 justify-center"
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
            >
              {row.map(([word, prob], i) => (
                <button
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (word === "</s>") resetContext();
                    else commitToken(word);
                    focusInput();
                  }}
                  className="px-2 py-0.5 rounded text-sm transition whitespace-nowrap hover:brightness-130"
                  style={{
                    backgroundColor: bgFromProb(prob),
                  }}
                  hidden={word === "<s>"}
                >
                  {word === "</s>" ? "end" : word}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitNewline();
        resetContext();
      }
    }}
      className={`
        w-full flex flex-wrap content-start items-center gap-2 justify-start pr-14 overflow-y-scroll pb-24
        ${cut ? 'max-h-96' : 'h-full'}
      `}
    >
      {tokens.map((t, i) =>
        t === "<s>" ? null :
        t === "\n" ? (
          <div key={i} className="basis-full h-7" />
        ) : (
        <div key={i} className="flex items-center">
          <div className="relative group/token flex items-center h-auto">
            <span className="bg-neutral-200/50 px-1 rounded-sm group-hover/token:bg-neutral-100 border border-transparent group-hover/token:border-neutral-300">
              {t}
            </span>

            <div
              className="
                absolute left-full pl-2
                opacity-0 pointer-events-none
                group-hover/token:opacity-100
                group-hover/token:pointer-events-auto
                flex flex-col gap-1
                transition z-10"
            >
              <button
                onClick={() => truncateFrom(i)}
                className="bg-red-500 text-red-900 text-xs h-5 w-5 rounded hover:brightness-150 transition flex items-center justify-center"
              >
                <Scissors size={14} />
              </button>
              <button
                onClick={() => enableInsert(i)}
                className="bg-yellow-400 text-yellow-900 text-xs h-5 w-5 rounded hover:brightness-150 transition flex items-center justify-center"
              >
                <UnfoldHorizontal size={14} />
              </button>
            </div>
          </div>

          {insertIndex === i && InputBlock}
        </div>
      ))}

      {insertIndex === null && InputBlock}
    </div>
  );
});

export default NgramWriter;
