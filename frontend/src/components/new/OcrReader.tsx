import { useState } from "react";
import CropCanvas from "./CropCanvas";
import { Image } from "lucide-react";
import type { FooterAction } from "./New";
import type { OCRResponse } from "../pageTypes";
import { analyzeBlocks, LOCAL_API } from "../../api";

export default function OcrReader({
  language, setLoading, setResult, setAnalyzing, setFooterAction, handleRectChange
}: {
  language: string
  setLoading: (l: boolean) => void;
  setResult: (r: OCRResponse | null) => void;
  setAnalyzing: (a: boolean) => void;
  setFooterAction: (action: FooterAction | null) => void;
  handleRectChange: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // 디바이스 판별
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const canUseCamera =
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const showCameraUI = isTouch && canUseCamera;

  const uploadBlob = async (blob: Blob) => {
    setLoading(true);

    const form = new FormData();
    form.append("file", blob);
    form.append("language", language);

    const res = await fetch(`${LOCAL_API}/ocr`, {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    const baseResult: OCRResponse = {
      text: data.text ?? "",
      blocks: data.blocks ?? [],
    };

    setResult(baseResult);
    setLoading(false);

    // ===== analyze 바로 호출 =====
    setAnalyzing(true);
    const nlpData = await analyzeBlocks(baseResult.blocks, language);

    setResult({
      text: baseResult.text,
      blocks: nlpData.blocks,
    });

    setAnalyzing(false);
  };

  if (showCameraUI) {
    return (
      <input
        id="image"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImage(URL.createObjectURL(file));
          setResult(null);
        }}
      />
    )
  } else return (
    <>
      {image &&
        <CropCanvas
          image={image}
          onCrop={uploadBlob}
          setFooterAction={setFooterAction}
          onRectChange={handleRectChange}
        />}
      <input
        id="image"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImage(URL.createObjectURL(file));
          setResult(null);
        }}
      />
      <label
        htmlFor="image"
        className={`
          border-5 border-dashed border-neutral-300 rounded
          h-auto w-full relative flex items-center justify-center transition-all
          ${dragging ? "bg-neutral-200" : "hover:bg-neutral-200"}
        `}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          setImage(URL.createObjectURL(file));
          setResult(null);
          setDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragEnter={() => setDragging(true)}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
      >
        <div className="w-full p-20 flex flex-col gap-5 text-neutral-400 items-center justify-center">
          <Image size={80} />
          <p>{image ? 'Change image' : 'Drag & drop or click'}</p>
        </div>
      </label>
    </>
  );
}
