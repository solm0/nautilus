import { useRef, useState } from "react"
import { fetchTimeline, type AnnotationCursor } from "../../api"
import type { TimelineItem } from "../setting/Mutuals"

export function useInfiniteMutualTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [cursor, setCursor] = useState<AnnotationCursor>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadingRef = useRef(false)

  const load = async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)

    try {
      const data = await fetchTimeline(cursor)

      setItems(prev => {
        const map = new Map(prev.map(i => [i.id, i]));

        data.items.forEach(i => {
          map.set(i.id, i);
        });

        return Array.from(map.values());
      });
      setCursor(data.next_cursor)
      setHasMore(!!data.next_cursor)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  return {
    items,
    setItems,
    load,
    loading,
    hasMore,
  }
}