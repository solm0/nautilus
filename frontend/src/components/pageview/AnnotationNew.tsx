import { useEffect, useRef, useState } from "react";
import type { SidePanelState } from "./PageView"
import type { Annotation } from "../pageTypes";
import { authHeaders, CENTRAL_API } from "../../api";
import Button from "../util/Button";
import NgramToggleInput, { type NgramToggleInputHandle } from "./NgramToggleInput";

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

  async function createAnnotation() {
    const headers = authHeaders()
    if (!headers) return false;
    const nextValue = annotationData.type === "memo"
      ? inputRef.current?.flushPendingInput() ?? inputValue
      : inputValue;

    // link validation
    if (annotationData.type === "link") {
      if (!isValidUrl(nextValue)) {
        setMsg("Invalid URL");
        return;
      }
    }

    // content 바꿔치기
    const payload = {
      ...annotationData,
      content: nextValue,
    }

    const response = await fetch(`${CENTRAL_API}/annotations`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) return;

    const newAnnotation = await response.json();

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
          />
        ) : (
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="https://..."
            className="mt-7 border-2 border-neutral-300 rounded-md w-full px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
          />
        )
      }
      <div className="absolute bottom-2 left-0 px-2 w-full flex flex-col">
        {msg && <p className="text-sm text-red-600 pb-2">{msg}</p>}
        <Button
          text={`Create new ${annotationData.type === "memo" ? 'memo':'link'}`}
          onClick={createAnnotation}
          disabled={!canSave}
          fit black
        />
      </div>
    </div>
  )
}
