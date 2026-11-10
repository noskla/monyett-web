import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import StoriesBar from "../components/StoriesBar";
import type { FeedResponse, Pagination, TimelineGroup } from "../types";

const PAGE_SIZE = 20;

/** Home feed: chronological timeline, page-based. "Load more" / "Refresh" are
 *  the only triggers — no auto-polling (PLAN.md §0). */
export default function Feed() {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [page, setPage] = useState(0); // pages loaded so far
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.feed(p, PAGE_SIZE);
      const feed = res.data as FeedResponse;
      const meta = (res.meta ?? feed.meta) as Pagination | undefined;
      const pc = meta?.pagination?.pageCount ?? null;
      setPageCount(pc);
      setPage(p);
      setGroups((prev) => (replace ? feed.timeline ?? [] : [...prev, ...(feed.timeline ?? [])]));
    } catch (e) {
      setError((e as ApiError).message ?? "failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, true);
  }, [loadPage]);

  const hasMore = pageCount === null || page < pageCount;

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h2>Feed</h2>
        <button onClick={() => loadPage(1, true)} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <StoriesBar />
      {groups.map((g) => (
        <section key={g.date_key ?? Math.random()}>
          {g.date_key && <h3 className="muted date-key">{g.date_key}</h3>}
          {g.posts.map((p) => (
            <PostCard key={p.publicId ?? p.id} post={p} />
          ))}
        </section>
      ))}
      {!loading && groups.length === 0 && !error && <p className="muted">No posts yet. Follow people to see their posts here.</p>}
      {hasMore && (
        <button className="load-more" onClick={() => loadPage(page + 1, false)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
