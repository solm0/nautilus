import { useEffect, useState } from "react";
import { fetchMyComments } from "../../api";
import type { Comment } from "../../types";

export function useMyComments() {
  const [items, setItems] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    const res = await fetchMyComments(cursor);

    setItems(prev => [...prev, ...res.items]);
    setCursor(res.next_cursor);
    setHasMore(!!res.next_cursor);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return { items, load, hasMore, loading };
}