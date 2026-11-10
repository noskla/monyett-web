import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import Avatar from "../components/Avatar";
import UserBadge from "../components/UserBadge";
import { avatarOf, badgeOf, tierOf } from "../util";
import type { Post, User } from "../types";

/** Search: users via legacy /api/search, posts via v1 posts-by-tag when the
 *  query starts with #. User-triggered only. */
function extractUsers(raw: unknown): User[] {
  if (Array.isArray(raw)) return raw as User[];
  const o = raw as Record<string, unknown> | null;
  return (o?.users as User[]) ?? (o?.data as User[]) ?? (Array.isArray(o?.data) ? (o.data as User[]) : []) ?? [];
}

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
          // /api/search returns a bare array of {id, publicId, name, match_score}
          // — `name` is the username; display name may differ, so retry without
          // the type filter when the filtered search finds nothing
          let raw: unknown = (await api.searchUsers(q, 1, 20)).data;
          let list = extractUsers(raw);
          if (list.length === 0) {
            raw = (await api.mGet<unknown>("search", { keyword: q, page: 1, pageSize: 20 })).data;
            list = extractUsers(raw);
          }
          // enrich with avatar/badge via by-username (search rows carry none)
          const enriched = await Promise.allSettled(
            list.map(async (u) => {
              const uname = u.username ?? u.name;
              if (!uname) return u;
              try {
                const r = await api.byUsername(uname);
                return { ...r.data, ...u, username: uname };
              } catch {
                return { ...u, username: uname };
              }
            }),
          );
          if (!cancelled) {
            setUsers(enriched.map((r) => (r.status === "fulfilled" ? r.value : ({ username: q } as User))));
          }
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
          {users.map((u) => {
            const uname = u.username ?? u.name;
            const display = u.display_name ?? u.name ?? uname;
            return (
              <Link to={`/u/${uname}`} className="card user-result" key={u.publicId ?? u.id ?? uname}>
                <Avatar url={avatarOf(u)} name={display} size={40} user={u} />
                <span>
                  <strong>{display}</strong>
                  <UserBadge badge={badgeOf(u)} tier={tierOf(u)} />
                  {uname && <span className="muted"> @{uname}</span>}
                </span>
              </Link>
            );
          })}
          {users.length === 0 && <p className="muted">No users found.</p>}
        </>
      )}
    </div>
  );
}
