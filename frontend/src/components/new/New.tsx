import { useEffect, useState } from "react";
import PagePreview from "./PagePreview";
import { fetchNotebooks, savePage } from "../../api";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import OcrReader from "./OcrReader";
import PasteReader from "./PasteReader";
import Button from "../util/Button";
import { ResponsiveModal } from "../util/ResponsiveModal";
import type { OCRResponse } from "../pageTypes";
import { filterOCRResponseByRanges, type SelectionRange } from "../pageUtils";
import LanguageSelect from "../util/LanguageSelect";
import { isCapacitorApp } from "../../platform";

export type FooterAction = {
  text: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function New() {
  const mobileApp = isCapacitorApp();
  const [result, setResult] = useState<OCRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [footerAction, setFooterAction] = useState<FooterAction | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<SelectionRange[]>([]);

  const [openModal, setOpenModal] = useState(false);
  const [pageName, setPageName] = useState("");
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [anyLangInstalled, setAnyLangInstalled] = useState(false);

  const [language, setLanguage] = useState<{
    lang: string;
    ocr_supported?: boolean;
  } | null>(null);

  // /notebook에서 생성한 page일 경우
  const location = useLocation();
  const initialNotebookId = location.state?.notebookId ?? null;
  const [selectedNotebook, setSelectedNotebook] = useState<number | null>(initialNotebookId);

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedMode = params.get("mode") || "paste";
  const mode = mobileApp && requestedMode === "ocr" ? "paste" : requestedMode;

  function setMode(t: string) {
    setParams({ mode: t });
  }

  const hasTokens = result?.blocks?.every(b => b.tokens);
  const isPreviewStep = !!result;

  const showInput = !isPreviewStep;
  const showPreview = isPreviewStep;

  const isReady =
    isPreviewStep &&
    hasTokens &&
    !loading &&
    !analyzing;

  const handleNext = () => {
    if (!isReady) return;
    setOpenModal(true);
  };

  useEffect(() => {
    if (!openModal) return;

    fetchNotebooks()
      .then(setNotebooks)
      .catch(() => setNotebooks([]));
  }, [openModal]);

  useEffect(() => {
    if (mobileApp && requestedMode === "ocr") {
      setParams({ mode: "paste" }, { replace: true });
    }
  }, [mobileApp, requestedMode, setParams]);

  const handleSave = async () => {
    if (!result) return;

    const resultToSave =
      selectedRanges.length > 0
        ? filterOCRResponseByRanges(result, selectedRanges)
        : result;

    try {
      if (!language) return;
      
      const pageId = await savePage(
        resultToSave,
        pageName,
        selectedNotebook,
        language.lang,
        {
          source: "user",
          metadata: [],
        },
      );
      navigate(`/page/${pageId}`);
    } catch (e) {
      if (e instanceof Error && e.message === "unauthorized") {
        navigate("/login");
      }
    }
  };

  const statusText = loading
    ? "Running OCR..."
    : analyzing
    ? "Running Stanza analysis..."
    : null;

  const handleReset = () => {
    setResult(null);
    setAnalyzing(false);
    setLoading(false);
    setFooterAction(null);
    setSelectedRanges([]);
  };

  useEffect(() => {
    setSelectedRanges([]);
  }, [result]);

  return (
    <div className={`flex flex-col items-start h-full w-full gap-2 pr-4 pb-18 md:pb-4 md:pr-6 pl-3 md:pl-6 ${mobileApp ? 'bg-neutral-200' : 'bg-neutral-transparent'}`}>

      {/* SECTION 1: HEADER */}
      <div className="flex flex-col gap-2 pt-12 pb-2">
        <h2 className="flex items-baseline gap-4">

          {mode === "ocr" ? "Upload an image" : "Paste text"}

          {!mobileApp && (
            <button
              onClick={() => {
                setMode(mode === "ocr" ? "paste" : "ocr");
                setResult(null);
                setAnalyzing(false);
                setLoading(false);
                setFooterAction(null);
                setSelectedRanges([]);
              }}
              className="text-neutral-500 hover:text-neutral-600 text-base transition-colors cursor-pointer"
            >
              {mode === "ocr" ? "or paste text?" : "or upload image?"}
            </button>
          )}
        </h2>

      </div>

      {/* LANGUAGE SELECT */}
      <LanguageSelect
        language={language?.lang ?? null}
        setLanguage={(l) => setLanguage(l)}
        handleReset={handleReset}
        setAnyLangInstalled={setAnyLangInstalled}
        background={!mobileApp}
      />

      {/* SECTION 3 + 4 */}
      <div className="flex-1 w-full max-h-180 overflow-hidden flex flex-col md:flex-row gap-2 h-full">

          {/* INPUT */}
          {language && anyLangInstalled ? (
            <div className={`
              w-full flex-1 md:w-1/2 flex flex-col items-end
              ${showPreview ? "hidden md:flex opacity-50 pointer-events-none" : "opacity-100"}
            `}>
              {mode === "ocr"
                ? language.ocr_supported !== false
                  ? (
                    <OcrReader
                      key={language.lang}
                      language={language.lang}
                      setLoading={setLoading}
                      setResult={setResult}
                      setAnalyzing={setAnalyzing}
                      setFooterAction={setFooterAction}
                      handleRectChange={handleReset}
                    />
                  ): (
                    <div className="w-full flex justify-start pt-3">OCR is not supported for this language.</div>
                  )
                : null
              }
              {mode === "paste" && (
                <PasteReader
                  key={language.lang}
                  language={language.lang}
                  setResult={setResult}
                  setAnalyzing={setAnalyzing}
                  setFooterAction={setFooterAction}
                />
              )}
            </div>
          ): (
            <div className="w-full flex-1 md:w-1/2 flex items-center justify-center">Loading...</div>
          )}
          
          {/* PREVIEW */}
          <div className={`
            w-full h-full flex-1 md:w-1/2 flex flex-col gap-2 overflow-hidden
            ${showInput && "hidden md:flex"}
          `}>
            {result ? (
              <>
                <p>Select text to keep. Otherwise, all text will be used.</p>
                <div className="w-full flex-1 bg-neutral-100 rounded shrink-0 overflow-y-scroll">
                  <PagePreview
                    blocks={result.blocks}
                    selectedRanges={selectedRanges}
                    onSelectedRangesChange={setSelectedRanges}
                  />
                </div>
              </>
            ): (
              <div className="text-neutral-400 w-full h-full flex items-center justify-center p-2">
                Preview will show here
              </div>
            )}
        </div>
      </div>

      {/* SECTION 2: NEXT BUTTON */}
      <div className="shrink-0 sticky bottom-0 flex justify-end w-full gap-2">

        {isPreviewStep && (
          <Button
            text="Retry"
            onClick={handleReset}
            fit
            black
          />
        )}

        {statusText ? (
          <Button
            text={statusText}
            onClick={() => {}}
            disabled
            fit
            black
          />
        ) : footerAction && !isPreviewStep ? (
          <Button
            text={footerAction.text}
            onClick={footerAction.onClick}
            disabled={footerAction.disabled || !language}
            fit
            black
          />
        ) : (
          <Button 
            text="Next"
            onClick={handleNext}
            disabled={!isReady || !language}
            fit
            black
          />
        )}
      </div>

      <ResponsiveModal open={openModal} onClose={() => setOpenModal(false)}>
        <div className="flex flex-col gap-7">
          <h2 className="text-lg font-medium">Save Page</h2>

          {/* page name */}
          <input
            placeholder="Page name"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
          />

          {/* notebook select */}
          <select
            value={selectedNotebook ?? ""}
            onChange={(e) =>
              setSelectedNotebook(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
          >
            <option value="">(root)</option>
            {notebooks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          {/* save */}
          <Button text="Save" onClick={handleSave} black fit />
        </div>
      </ResponsiveModal>
    </div>
  );
}
