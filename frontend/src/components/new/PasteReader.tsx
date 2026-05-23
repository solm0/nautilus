import { useCallback, useEffect, useState } from "react";
import type { FooterAction } from "./New";
import type { OCRResponse } from "../pageTypes";
import { analyzeBlocks } from "../../api";

export default function PasteReader({
  language, setAnalyzing, setResult, setFooterAction
}: {
  language: string
  setResult: (r: OCRResponse | null) => void;
  setAnalyzing: (a: boolean) => void;
  setFooterAction: (action: FooterAction | null) => void;
}) {
  const [pasteText, setPasteText] = useState("");

  function textToBlocks(text: string) {
    return text.split("\n").map(line => ({
      text: line,
    }));
  }

  const handlePasteAnalyze = useCallback(async () => {
    setAnalyzing(true);

    const blocks = textToBlocks(pasteText);
    const data = await analyzeBlocks(blocks, language);

    setResult({
      text: pasteText,
      blocks: data.blocks
    });

    setAnalyzing(false);
  }, [pasteText, setAnalyzing, setResult]);

  useEffect(() => {
    setFooterAction({
      text: "Done",
      onClick: handlePasteAnalyze,
      disabled: !pasteText.trim(),
    });

    return () => setFooterAction(null);
  }, [handlePasteAnalyze, pasteText, setFooterAction]);


  return (
    <>
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        className="w-full h-full resize-none rounded-sm focus:outline-none bg-neutral-50/80 p-2"
        placeholder={`Paste text here

Tip !!!

Accuracy improves when punctuation and line breaks are used properly in sentences.`}
        spellCheck={false}
      />
    </>
  );
}
