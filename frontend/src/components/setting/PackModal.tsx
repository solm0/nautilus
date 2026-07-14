import { useEffect, useRef, useState } from "react";
import { getProgress, installPack } from "../../api";
import { ResponsiveModal } from "../util/ResponsiveModal";
import Button from "../util/Button";

const LANG_MAP: Record<string, string> = {
  ru: "Russian",
  de: "German",
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese",
  fr: "French",
  es: "Spanish",
  sr: "Serbian",
  mk: "Macedonian",
  sq: "Albanian",
};

type Props = {
  lang: string;
  version: string;
  filename: string;
  assetKind: "lemma" | "ngram";
  onClose: () => void;
  onInstalled: () => Promise<void>;
};

export default function PackModal({
  lang,
  version,
  filename,
  assetKind,
  onClose,
  onInstalled,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"starting" | "downloading" | "extracting" | "done" | "error">("starting");

  const intervalRef = useRef<number | null>(null);
  const installedRef = useRef(false);

  const langName = LANG_MAP[lang] || lang;
  const assetLabel = assetKind === "lemma" ? "lemmas" : "writing assistant";

  const stopPolling = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  async function startInstall() {
    if (installedRef.current) return;
    installedRef.current = true;

    try {
      setError("");

      const res = await installPack({
        lang,
        version,
        filename,
        asset_kind: assetKind,
      });

      stopPolling();
      intervalRef.current = window.setInterval(async () => {
        try {
          const p = await getProgress(res.task_id);

          setStatus(p.status || "downloading");
          setProgress((prev) => Math.max(prev, p.progress || 0));

          if (p.status === "done") {
            stopPolling();
            setStatus("done");
            setProgress(1);
            setDone(true);
            await onInstalled();
          }

          if (p.status === "error") {
            stopPolling();
            setStatus("error");
            setError("Installation failed.");
          }
        } catch {
          stopPolling();
          setStatus("error");
          setError("Failed to fetch install progress.");
        }
      }, 500);
    } catch {
      setStatus("error");
      setError("Failed to start installation.");
    }
  }

  useEffect(() => {
    startInstall();
    return () => stopPolling();
  }, []);

  return (
    <ResponsiveModal open={true} onClose={handleClose}>
      <div className="flex flex-col gap-6 min-w-[320px]">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {langName} {version} {assetLabel} installing
          </h2>

          <p className="text-sm text-neutral-500">
            Do not close this window until installation is complete.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
            {progress > 0 ? (
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            ) : (
              <div className="h-full w-1/3 animate-pulse bg-neutral-500" />
            )}
          </div>

          <div className="text-sm text-neutral-500">
            {status === "extracting"
              ? "Extracting files..."
              : status === "done"
                ? "100%"
                : progress > 0
                  ? `${Math.round(progress * 100)}%`
                  : "Downloading..."}
          </div>
        </div>

        {done && (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-green-600">Installed successfully.</div>

            <Button
              onClick={handleClose}
              text="Close"
              black
              fit
            />
          </div>
        )}

        {error && <div className="text-sm text-red-500">{error}</div>}
      </div>
    </ResponsiveModal>
  );
}
