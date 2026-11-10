import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import Avatar from "../components/Avatar";
import UserBadge from "../components/UserBadge";
import { avatarOf } from "../util";
import type { Post, User } from "../types";

/** Search: users via legacy /api/search (type=user), posts via v1
 *  posts-by-tag when the query starts with #. User-triggered only. */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTag = q.startsWith("#");

  useEffect(() => {
    setInput(q);
    if (!q) {
      setUsers([]);
      setPosts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (isTag) {
          const res = await api.searchTag(q.slice(1), 1, 20);
          if (!cancelled) setPosts(res.data.posts ?? []);
        } else {
          const res = await api.searchUsers(q, 1, 20);
          const raw = res.data as unknown;
          const list = Array.isArray(raw)
            ? (raw as User[])
            : ((raw as { users?: User[]; data?: User[] })?.users ?? (raw as { data?: User[] })?.data ?? []);
          if (!cancelled) setUsers(list);
        }
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message ?? "search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, isTag]);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setParams({ q: input.trim() });
  }

  return (
    <div className="search">
      <form className="search-form" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search users, or #hashtag"
          autoFocus
        />
        <button disabled={!input.trim()}>Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}
      {!loading && isTag && (
        <>
          <h3 className="muted">{q}</h3>
          {posts.map((p) => (
            <PostCard key={p.publicId ?? p.id} post={p} />
          ))}
          {!loading && posts.length === 0 && q && <p className="muted">No posts for {q}.</p>}
        </>
      )}
      {!loading && !isTag && q && (
        <>
          {users.map((u) => (
            <Link to={`/u/${u.username}`} className="card user-result" key={u.publicId ?? u.id}>
              <Avatar url={avatarOf(u)} name={u.display_name ?? u.name ?? u.username} size={40} />
              <span>
                <strong>{u.display_name ?? u.name ?? u.username}</strong>
                <UserBadge badge={u.badge} tier={u.effectiveTier} />
                {u.username && <span className="muted"> @{u.username}</span>}
              </span>
            </Link>
          ))}
          {users.length === 0 && <p className="muted">No users found.</p>}
        </>
      )}
    </div>
  );
}
