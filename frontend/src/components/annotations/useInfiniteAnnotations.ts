import { useRef, useState } from "react";
import { fetchAnnotations, type AnnotationCursor } from "../../api";
import { isNetworkError } from "../../network";
import type { TimelineItem } from "../../types";

export function useInfiniteAnnotations() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [cursor, setCursor] = useState<AnnotationCursor>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offline, setOffline] = useState(false);

  const loadingRef = useRef(false);

  const load = async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setOffline(false);

    try {
      const data = await fetchAnnotations(cursor);

      setItems(prev => {
        const map = new Map(prev.map(i => [i.id, i]));

        data.items.forEach(i => {
          map.set(i.id, i);
        });

        return Array.from(map.values());
      });
      setOffline(data.offline === true);

      if (data.offline) {
        return;
      }

      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch (error) {
      setOffline(isNetworkError(error));
      throw error;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  return {
    items,
    setItems,
    load,
    loading,
    hasMore,
    offline,
  };
}
