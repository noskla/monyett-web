import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import type { Post } from "../types";

/** Discover feed (cursor-based). Handles both `items` (with .post) and
 *  `posts` response shapes per the contract notes. */
export default function Discover() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cur: string | null, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.discover(20, cur ?? undefined);
      const raw = res.data as Record<string, unknown>;
      const items = (raw?.items as Record<string, unknown>[] | undefined) ?? [];
      const list: Post[] = items.length
        ? items.map((it) => ((it.post ?? it) as Post))
        : ((raw?.posts as Post[] | undefined) ?? (Array.isArray(raw) ? (raw as Post[]) : []));
      setCursor((raw?.next_cursor as string | null) ?? null);
      setPosts((prev) => (replace ? list : [...prev, ...list]));
    } catch (e) {
      setError((e as ApiError).message ?? "failed to load discover");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null, true);
  }, [load]);

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h2>Discover</h2>
        <button onClick={() => load(null, true)} disabled={loading}>{loading ? "…" : "Refresh"}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {posts.map((p) => (
        <PostCard key={p.publicId ?? p.id} post={p} />
      ))}
      {!loading && posts.length === 0 && !error && <p className="muted">Nothing to discover yet.</p>}
      {cursor && (
        <button className="load-more" onClick={() => load(cursor, false)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
