import { useEffect, useRef, useState } from "react";
import { getProgress, installPack } from "../../api";
import { ResponsiveModal } from "../util/ResponsiveModal";
import { LANG_MAP, type Pack } from "./PackTable";
import Button from "../util/Button";

type Props = {
  pack: Pack;
  onClose: () => void;
  onInstalled: () => Promise<void>;
};

export default function PackModal({ pack, onClose, onInstalled }: Props) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const intervalRef = useRef<number | null>(null);
  const installedRef = useRef(false);

  const langName = LANG_MAP[pack.lang] || pack.lang;

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
        lang: pack.lang,
        version: pack.version,
        filename: pack.filename,
      });

      stopPolling();
      intervalRef.current = window.setInterval(async () => {
        try {
          const p = await getProgress(res.task_id);

          setProgress((prev) => Math.max(prev, p.progress || 0));

          if (p.status === "done") {
            stopPolling();
            setDone(true);
            await onInstalled();
          }

          if (p.status === "error") {
            stopPolling();
            setError("Installation failed.");
          }
        } catch {
          stopPolling();
          setError("Failed to fetch install progress.");
        }
      }, 500);
    } catch {
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
            {langName} {pack.version} pack installing
          </h2>

          <p className="text-sm text-neutral-500">
            Do not close this window until installation is complete.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          <div className="text-sm text-neutral-500">
            {Math.round(progress * 100)}%
          </div>
        </div>

        {done && (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-green-600">Installed successfully.</div>

            <Button
              onClick={handleClose}
              text="Close"
              black fit
            />
          </div>
        )}

        {error && <div className="text-sm text-red-500">{error}</div>}
      </div>
    </ResponsiveModal>
  );
}