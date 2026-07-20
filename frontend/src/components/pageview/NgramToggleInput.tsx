import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import NgramWriter, { type NgramWriterHandle } from "./NgramWriter";
import LanguageSelect from "../util/LanguageSelect";
import { LANG_MAP } from "../setting/PackTable";
import { useI18n } from "../../i18n";

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
  placeNgramInstallInEditor?: boolean;
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
  autofocus = true,
  placeNgramInstallInEditor = false,
}, ref) => {
  const { t } = useI18n();
  const [useNgram, setUseNgram] = useState(defaultOn);
  const [tokens, setTokens] = useState<string[]>([]);
  const [language, setLanguage] = useState<{
    lang: string;
  } | null>(pageLanguage ? {lang: pageLanguage} : null);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});
  const [writerRefreshKey, setWriterRefreshKey] = useState(0);
  const [ngramAvailable, setNgramAvailable] = useState(false);
  const [ngramInstallPromptTarget, setNgramInstallPromptTarget] =
    useState<HTMLDivElement | null>(null);

  const initializedRef = useRef(false);
  const writerRef = useRef<NgramWriterHandle>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const plainRef = useRef<HTMLSpanElement>(null);
  const assistantRef = useRef<HTMLSpanElement>(null);

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

  const handleNgramInstalled = (installedLang: string) => {
    if (language?.lang !== installedLang) return;

    setUseNgram(true);
    setTokens(textToTokens(value));
    setWriterRefreshKey((prev) => prev + 1);
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

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const toggle = toggleRef.current;
      const activeLabel = useNgram ? assistantRef.current : plainRef.current;
      if (!toggle || !activeLabel) return;

      setIndicatorStyle({
        left: activeLabel.offsetLeft,
        width: activeLabel.offsetWidth,
      });
    };

    updateIndicator();

    const observer = new ResizeObserver(updateIndicator);
    if (toggleRef.current) observer.observe(toggleRef.current);
    if (plainRef.current) observer.observe(plainRef.current);
    if (assistantRef.current) observer.observe(assistantRef.current);

    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [useNgram]);

  return (
    <div className="w-full h-full flex flex-col items-start gap-2 overflow-y-scroll">

      <div className="w-full flex gap-4 items-start justify-center">
        <button
          ref={toggleRef}
          type="button"
          onClick={handleToggle}
          className="shrink-0 relative inline-flex h-8 items-center rounded-full bg-neutral-200/80 p-0.5 text-xs transition-colors hover:bg-neutral-200 dark:bg-neutral-400 dark:hover:bg-neutral-500 mt-1"
        >
          <div
            className="absolute bottom-0.5 top-0.5 rounded-full bg-neutral-50 text-neutral-700 shadow-sm transition-all duration-200"
            style={indicatorStyle}
          />
          <span
            ref={plainRef}
            className="z-10 flex h-7 items-center justify-center whitespace-nowrap px-3 text-center"
          >
            {t("Plain")}
          </span>
          <span
            ref={assistantRef}
            className="z-10 flex h-7 items-center justify-center whitespace-nowrap px-3 text-center"
          >
            {t("Writing Assistant")}
          </span>
        </button>

        <LanguageSelect
          language={language?.lang ?? null}
          setLanguage={(l)=>setLanguage(l)}
          background={background}
          options={languageOptions}
          requireNgram
          onNgramInstalled={handleNgramInstalled}
          onNgramAvailabilityChange={
            placeNgramInstallInEditor ? setNgramAvailable : undefined
          }
          ngramInstallPromptTarget={
            placeNgramInstallInEditor
              ? ngramInstallPromptTarget
              : undefined
          }
        />
      </div>

      {useNgram && language && (!placeNgramInstallInEditor || ngramAvailable) ? (
        <NgramWriter
          ref={writerRef}
          key={`${language.lang}-${writerRefreshKey}`}
          language={language.lang}
          tokens={tokens}
          setTokens={setTokens}
          cut={cut}
          onHasTextChange={onHasTextChange}
          autofocus={autofocus}
        />
      ) : !useNgram || !language ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full resize-none bg-transparent leading-7 pb-8 text-base text-inherit caret-black focus:outline-none placeholder-neutral-400 overflow-y-auto"
          spellCheck={false}
          placeholder={language?.lang
            ? t("Add your thoughts in {language}...", {
                language: t(LANG_MAP[language.lang] ?? language.lang),
              })
            : t("Add your thoughts...")}
        />
      ) : placeNgramInstallInEditor ? (
        <div
          ref={setNgramInstallPromptTarget}
          className="flex h-full w-full items-center justify-center pb-8"
        />
      ) : null}
    </div>
  );
});

export default NgramToggleInput;
