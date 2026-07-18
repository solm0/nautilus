import { useEffect, useState } from "react";
import { fetchMyComments } from "../../api";
import { isNetworkError } from "../../network";
import type { Comment } from "../../types";

export function useMyComments() {
  const [items, setItems] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = async () => {
    if (loading || !hasMore || offline) return;

    setLoading(true);
    setOffline(false);

    try {
      const res = await fetchMyComments(cursor);

      setItems(prev => [...prev, ...res.items]);
      setCursor(res.next_cursor);
      setHasMore(!!res.next_cursor);
    } catch (error) {
      setOffline(isNetworkError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { items, load, hasMore, loading, offline };
}
