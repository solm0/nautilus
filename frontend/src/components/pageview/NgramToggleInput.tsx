import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import NgramWriter, { type NgramWriterHandle } from "./NgramWriter";
import LanguageSelect from "../util/LanguageSelect";
import { LANG_MAP } from "../setting/PackTable";

export type NgramToggleInputHandle = {
  flushPendingInput: () => string;
  hasText: () => boolean;
};
type NgramToggleInputProps = {
  value: string;
  onChange: (v: string) => void;
  defaultOn?: boolean;
  pageLanguage?: string;
  cut?: boolean;
  background?: boolean;
  languageOptions?: {
    lang: string;
  }[];
  onHasTextChange?: (hasText: boolean) => void;
  autofocus?: boolean;
};

function textToTokens(text: string) {
  if (!text.trim()) return ["<s>"];

  const body = text
    .split("\n")
    .flatMap((line, i, arr) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (i < arr.length - 1) return [...words, "\n"];
      return words;
    });

  return ["<s>", ...body];
}

export function tokensToText(tokens: string[]) {
  let out = "";

  tokens.forEach((t) => {
    if (t === "<s>") return;

    if (t === "\n") {
      out = out.trimEnd() + "\n";
    } else {
      out += (out && !out.endsWith("\n") ? " " : "") + t;
    }
  });

  return out;
}

const NgramToggleInput = forwardRef<NgramToggleInputHandle, NgramToggleInputProps>(({
  value,
  onChange,
  defaultOn = true,
  pageLanguage,
  cut = false,
  background = false,
  languageOptions,
  onHasTextChange,
  autofocus = true
}, ref) => {
  const [useNgram, setUseNgram] = useState(defaultOn);
  const [tokens, setTokens] = useState<string[]>([]);
  const [language, setLanguage] = useState<{
    lang: string;
  } | null>(pageLanguage ? {lang: pageLanguage} : null);

  const initializedRef = useRef(false);
  const writerRef = useRef<NgramWriterHandle>(null);

  // 🔹 최초 1회만 text → tokens
  useEffect(() => {
    if (useNgram && !initializedRef.current) {
      setTokens(textToTokens(value));
      initializedRef.current = true;
    }
  }, [useNgram]);

  // 🔹 toggle OFF → ON 시에도 변환
  const handleToggle = () => {
    setUseNgram((prev) => {
      const next = !prev;

      if (next === true) {
        // OFF → ON
        setTokens(textToTokens(value));
      } else {
        // ON → OFF
        onChange(tokensToText(tokens));
      }

      return next;
    });
  };

  // 🔹 ngram 사용 중일 때만 tokens → text
  useEffect(() => {
    if (useNgram) {
      onChange(tokensToText(tokens));
    }
  }, [tokens, useNgram]);

  useEffect(() => {
    if (!useNgram) {
      onHasTextChange?.(value.trim().length > 0);
    }
  }, [onHasTextChange, useNgram, value]);

  useImperativeHandle(ref, () => ({
    flushPendingInput() {
      if (!useNgram) {
        return value;
      }

      const nextTokens = writerRef.current?.flushPendingInput() ?? tokens;
      const nextValue = tokensToText(nextTokens);
      onChange(nextValue);
      return nextValue;
    },
    hasText() {
      if (!useNgram) {
        return value.trim().length > 0;
      }

      return writerRef.current?.hasText() ?? tokensToText(tokens).trim().length > 0;
    },
  }), [onChange, tokens, useNgram, value]);

  return (
    <div className="w-full h-full flex flex-col items-start gap-2 overflow-y-scroll">

      <div className="w-full flex gap-4 items-center justify-center">
        <button
          type="button"
          onClick={handleToggle}
          className="shrink-0 group relative h-8 w-auto items-center rounded-full bg-neutral-200/80 p-0.3 transition-colors hover:bg-neutral-200 dark:bg-neutral-400 dark:hover:bg-neutral-500 text-sm flex px-1"
        >
          <div
            className={`absolute flex h-7 w-auto px-2 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 shadow-sm transition-transform duration-200 ${
              useNgram ? "translate-x-12" : "-translate-x-0.5"
            }`}
          >
            <span className="opacity-0">{useNgram ? 'N-gram' : 'Plain'}</span>
          </div>
          <span className="px-2 z-10">Plain</span>
          <span className="px-2 z-10">N-gram</span>
        </button>

        <LanguageSelect
          language={language?.lang ?? null}
          setLanguage={(l)=>setLanguage(l)}
          background={background}
          options={languageOptions}
        />
      </div>

      {useNgram && language ? (
        <NgramWriter
          ref={writerRef}
          key={language.lang}
          language={language.lang}
          tokens={tokens}
          setTokens={setTokens}
          cut={cut}
          onHasTextChange={onHasTextChange}
          autofocus={autofocus}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full resize-none bg-transparent leading-7 pb-8 text-base text-inherit caret-black focus:outline-none placeholder-neutral-400 overflow-y-auto"
          spellCheck={false}
          placeholder={`Add your thoughts... ${ language?.lang && `in ${LANG_MAP[language?.lang]}`}.`}
        />
      )}
    </div>
  );
});

export default NgramToggleInput;
