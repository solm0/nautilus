import { useEffect, useRef, useState } from "react";
import type { SidePanelState } from "./PageView"
import type { Annotation } from "../pageTypes";
import { createAnnotation as createAnnotationRequest } from "../../api";
import Button from "../util/Button";
import NgramToggleInput, { type NgramToggleInputHandle } from "./NgramToggleInput";
import { useI18n } from "../../i18n";

export function isValidUrl(str: string) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AnnotationNew({
  panel, setAnnotations, setPanelData, pageLanguage
}:{
  panel: SidePanelState;
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  setPanelData: (p: SidePanelState | null) => void;
  pageLanguage: string;
}) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);
  const inputRef = useRef<NgramToggleInputHandle>(null);
  const annotationPanel =
    panel?.type === "annotation:new" ? panel : null;

  useEffect(() => {
    if (!annotationPanel) return;
    setInputValue(annotationPanel.data.content);
    setCanSave(annotationPanel.data.content.trim().length > 0);
  }, [annotationPanel]);

  useEffect(() => {
    if (annotationPanel?.data.type !== "memo") {
      setCanSave(inputValue.trim().length > 0);
    }
  }, [annotationPanel?.data.type, inputValue]);

  if (!annotationPanel) return null;

  const annotationData = annotationPanel.data;

  async function handleCreateAnnotation() {
    const nextValue = annotationData.type === "memo"
      ? inputRef.current?.flushPendingInput() ?? inputValue
      : inputValue;

    // link validation
    if (annotationData.type === "link") {
      if (!isValidUrl(nextValue)) {
        setMsg(t("Invalid URL"));
        return;
      }
    }

    // content 바꿔치기
    const payload = {
      ...annotationData,
      content: nextValue,
    }

    const newAnnotation = await createAnnotationRequest(payload);

    setAnnotations?.((prev) => [...prev, newAnnotation]);
    setPanelData({ type: "annotation:view", data: newAnnotation });
    setInputValue("");
  }

  return (
    <div className="w-full h-full pt-2 px-3 pb-16">
      {annotationData.type === "memo"
        ? (
          <NgramToggleInput
            ref={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onHasTextChange={setCanSave}
            defaultOn={true}
            pageLanguage={pageLanguage}
            background
            placeNgramInstallInEditor
          />
        ) : (
          <div className="flex flex-col gap-1">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="https://..."
              className="mt-7 border-2 border-neutral-300 rounded-md w-full px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
            />
            {msg && <p className="text-xs text-red-400 font-medium pb-2">{msg}</p>}
          </div>
        )
      }
      <div className="absolute bottom-2 left-0 px-2 w-full flex flex-col">
        <Button
          text={annotationData.type === "memo" ? t("Create new memo") : t("Create new link")}
          onClick={handleCreateAnnotation}
          disabled={!canSave}
          fit black
        />
      </div>
    </div>
  )
}
