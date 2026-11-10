import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import StoriesBar from "../components/StoriesBar";
import type { FeedResponse, Pagination, Post, TimelineGroup } from "../types";

const PAGE_SIZE = 20;
const NEW_POST_CHECK_MS = 30_000;

function flatten(groups: TimelineGroup[]): Post[] {
  return groups.flatMap((g) => g.posts ?? []);
}

/** Home feed. Background check every 30s fetches page 1 silently; if the newest
 *  post changed, a centered "-- refresh --" button appears and redraws the feed
 *  on click (no auto-redraw). */
export default function Feed() {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const latestId = useRef<string | null>(null);

  const loadPage = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.feed(p, PAGE_SIZE);
      const feed = res.data as FeedResponse;
      const meta = (res.meta ?? feed.meta) as Pagination | undefined;
      setPageCount(meta?.pagination?.pageCount ?? null);
      setPage(p);
      setGroups((prev) => {
        const next = replace ? feed.timeline ?? [] : [...prev, ...(feed.timeline ?? [])];
        const first = flatten(next)[0];
        latestId.current = first ? String(first.publicId ?? first.id) : latestId.current;
        return next;
      });
      setHasNew(false);
    } catch (e) {
      setError((e as ApiError).message ?? "failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, true);
  }, [loadPage]);

  // background new-post check every 30s (only while the tab is visible)
  useEffect(() => {
    const iv = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await api.feed(1, 1); // only need the newest post
        const feed = res.data as FeedResponse;
        const first = flatten(feed.timeline ?? [])[0];
        const id = first ? String(first.publicId ?? first.id) : null;
        if (id && latestId.current && id !== latestId.current) setHasNew(true);
      } catch {
        /* background check is best-effort */
      }
    }, NEW_POST_CHECK_MS);
    return () => clearInterval(iv);
  }, []);

  const hasMore = pageCount === null || page < pageCount;

  return (
    <div className="feed">
      {error && <p className="error">{error}</p>}
      {hasNew && (
        <button className="refresh-banner" onClick={() => loadPage(1, true)}>
          -- refresh --
        </button>
      )}
      <StoriesBar />
      {groups.map((g, gi) => (
        <section key={g.date_key ?? gi}>
          {g.posts.map((p) => (
            <PostCard key={p.publicId ?? p.id} post={p} />
          ))}
        </section>
      ))}
      {!loading && groups.length === 0 && !error && (
        <p className="muted">No posts yet. Follow people to see their posts here.</p>
      )}
      {hasMore && (
        <button className="load-more" onClick={() => loadPage(page + 1, false)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
