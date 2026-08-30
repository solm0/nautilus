import { useEffect, useRef } from "react";
import { useInfiniteAnnotations } from "./useInfiniteAnnotations";
import AnnotationCard from "./AnnotationCard";
import type { TimelineItem } from "../../types";
import BlockingLoadingModal from "../util/BlockingLoadingModal";
import OfflineState from "../util/OfflineState";
import { useI18n } from "../../i18n";
import { CENTRAL_RESTORED_EVENT } from "../../network";

export default function Annotations() {
  const { t } = useI18n();
  const { items, setItems, load, hasMore, loading, offline } = useInfiniteAnnotations()
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current || offline) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !offline) {
        void load();
      }
    });

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, load, loading, offline]);

  useEffect(() => {
    if (items.length === 0 && !offline) {
      void load();
    }
  }, [items.length, load, offline]);

  useEffect(() => {
    if (!offline) return;

    const handleCentralRestored = () => {
      void load();
    };

    window.addEventListener(CENTRAL_RESTORED_EVENT, handleCentralRestored);
    return () => window.removeEventListener(CENTRAL_RESTORED_EVENT, handleCentralRestored);
  }, [load, offline]);

  const handleUpdate = (updated: TimelineItem) => {
    setItems((prev) => prev.map((item) => item.id === updated.id ? updated : item));
  };

  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex flex-col gap-7 w-full h-full overflow-y-scroll pl-3 md:pl-6 bg-neutral-50">
      <h2 className="top-0 pt-12 z-30 flex gap-4 sticky bg-neutral-50">{t("Annotations")}</h2>

      {offline && items.length > 0 ? (
        <p className="text-xs text-neutral-400">
          {t("You're offline. Check your connection and try again.")}
        </p>
      ) : null}

      {offline && items.length === 0 ? (
        <OfflineState onRetry={() => void load()} />
      ) : null}

      <div className="flex flex-col gap-1 pt-7">
        {items.map(item => (
          <AnnotationCard
            key={item.id}
            item={item}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            readonlySnapshotActions={offline}
          />
        ))}

        {/* sentinel */}
        <div ref={sentinelRef} className="h-10" />

        <BlockingLoadingModal open={loading} message="Loading annotations..." />
        {/* {!hasMore && <p className="text-center opacity-50 pb-18 text-sm">{t("End of the list")}</p>} */}
      </div>
    </div>
  );
}
