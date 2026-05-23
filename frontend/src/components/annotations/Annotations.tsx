import { useEffect, useRef, useState } from "react";
import { useInfiniteAnnotations } from "./useInfiniteAnnotations";
import AnnotationCard from "./AnnotationCard";
import { useSearchParams } from "react-router-dom";
import { useInfiniteMutualTimeline } from "./useInfiniteMutualTimeline";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { fetchAnnotationById } from "../../api";
import type { TimelineItem } from "../setting/Mutuals";
import BlockingLoadingModal from "../util/BlockingLoadingModal";

export default function Annotations() {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") ?? "my"
  
  const my = useInfiniteAnnotations()
  const mutual = useInfiniteMutualTimeline()
  const active = tab === "my" ? my : mutual
  const { items, load, hasMore, loading } = active
  const [pinned, setPinned] = useState<TimelineItem | null>(null);

  const annotationId = params.get("id");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        load();
      }
    });

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [load]);

  useEffect(() => {
    if (tab === "my" && my.items.length === 0) {
      my.load();
    }
    if (tab === "mutuals" && mutual.items.length === 0) {
      mutual.load();
    }
  }, [tab]);

  // 알림에서 왔을 시 해당 annotation prepend
  useEffect(() => {
    if (!annotationId) return;

    const id = Number(annotationId);

    fetchAnnotationById(id).then(setPinned);
  }, [annotationId]);

  const handleUpdate = (updated: TimelineItem) => {
    setPinned((prev) => prev?.id === updated.id ? updated : prev);

    if (tab === "my") {
      my.setItems((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      return;
    }

    mutual.setItems((prev) => prev.map((item) => item.id === updated.id ? updated : item));
  };

  const handleDelete = (id: number) => {
    setPinned((prev) => prev?.id === id ? null : prev);

    if (tab === "my") {
      my.setItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    mutual.setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex flex-col gap-7 w-full h-full overflow-y-scroll pl-3 md:pl-6 bg-neutral-50">
      <AnnotationToolbar />

      {/* annotation?{id} */}
      {pinned && (
        <AnnotationCard
          item={pinned}
          autoOpenComments={true}
          pinned={true}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      <h2 className="top-0 pt-8 md:pt-12 z-30 flex gap-4 sticky bg-neutral-50">
        <span
          className={tab === "my" ? "" : "text-neutral-400 hover:text-neutral-500 cursor-pointer transition-colors"}
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("tab", "my");
            setParams(next);
          }}
        >
          My
        </span>
        <span
          className={tab === "mutuals" ? "" : "text-neutral-400 hover:text-neutral-500 cursor-pointer transition-colors"}
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("tab", "mutuals");
            setParams(next);
          }}
        >
          Mutuals
        </span>
      </h2>

      <div className="flex flex-col gap-1 pt-7">
        {items.map(item => (
          <AnnotationCard
            key={item.id}
            item={item}
            autoOpenComments={false}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}

        {/* sentinel */}
        <div ref={sentinelRef} className="h-10" />

        <BlockingLoadingModal open={loading} message="Loading annotations..." />
        {!hasMore && <p className="text-center opacity-50 pb-18 text-sm">End of the list</p>}
      </div>
    </div>
  );
}
