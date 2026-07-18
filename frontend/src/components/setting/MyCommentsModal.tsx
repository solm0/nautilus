import { useEffect, useMemo, useRef, useState } from "react";
import { useMyComments } from "./useMyComments";
import { useNavigate } from "react-router-dom";
import { ResponsiveModal } from "../util/ResponsiveModal";
import Button from "../util/Button";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "../../i18n";

export default function MyCommentsModal() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { items, load, hasMore, loading, offline } = useMyComments();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // 중복 제거 (annotation_id + id 기준)
  const dedupedItems = useMemo(() => {
    const map = new Map<string, typeof items[number]>();

    for (const c of items) {
      const key = `${c.id}-${c.annotation_id}`;
      map.set(key, c);
    }

    return Array.from(map.values())
  }, [items]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const obs = new IntersectionObserver(e => {
      if (e[0].isIntersecting && hasMore && !loading && !offline) {
        void load();
      }
    });

    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, load, loading, offline]);

  return (
    <>
      <Button text={t("My comments")} onClick={() => setOpen(true)} />

      <ResponsiveModal open={open} onClose={() => setOpen(false)} big>
        <div className="flex flex-col gap-7 overflow-hidden">
          <h2>{t("My Comments")}</h2>

          {offline ? (
            <p className="text-sm text-neutral-500">
              {t("You're offline. Check your connection and try again.")}
            </p>
          ) : null}
          
          {!offline ? (
            <div className="flex flex-col overflow-y-auto">
            {dedupedItems.map(c => (
              <div
                key={`${c.id}-${c.annotation_id}`}
                className="min-h-12 flex items-center p-4 cursor-pointer border-b border-neutral-200 hover:bg-neutral-100 transition-colors group"
                onClick={() => {
                  navigate(`/annotations?id=${c.annotation_id}`);
                  setOpen(false);
                }}
              >
                <div className="w-full whitespace-pre-wrap text-sm flex gap-7">
                  <div className="flex gap-2 items-start">
                    <p>{c.content}</p>
                    <ArrowUpRight size={15} className='opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1' />
                  </div>
                  <span className="text-neutral-400 min-w-20 ml-auto">{c.created_at.slice(0,10)}</span>
                </div>
              </div>
            ))}
            </div>
          ) : null}

          {!offline ? <div ref={sentinelRef} className="h-10" /> : null}

          {!offline && loading ? <p className="opacity-50 w-full text-center text-sm">{t("Loading...")}</p> : null}
          {/* {!hasMore && <p className="opacity-50 w-full text-center text-sm">{t("End of the list")}</p>} */}
        </div>
      </ResponsiveModal>
    </>
  );
}
