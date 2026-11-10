import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { avatarOf } from "../util";
import type { StoriesFeed } from "../types";

/** Story circles above the feed: own story first ("+" to add when none),
 *  then users you follow with stories. Unseen = brand-pink ring, else their ring color. */
export default function StoriesBar() {
  const [feed, setFeed] = useState<StoriesFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stories(1, 30)
      .then((res) => setFeed(res.data as StoriesFeed))
      .catch((e) => setError((e as ApiError).message ?? "stories unavailable"));
  }, []);

  if (error || !feed) return null;
  const own = feed.current_user;
  const others = (feed.users ?? []).filter((u) => (u.stories?.length ?? 0) > 0 || u.has_unseen);
  const hasOwn = (own?.stories?.length ?? 0) > 0;

  return (
    <div className="stories-bar">
      {own && (
        <Link to={hasOwn ? `/stories/${own.publicId}` : "/compose?type=story"} className="story-avatar" title={hasOwn ? "Your story" : "Add story"}>
          <span className={`story-ring${hasOwn && own.has_unseen ? " unseen" : ""}`} style={{ borderColor: hasOwn && own.has_unseen ? "var(--accent)" : own.ring_color ?? "var(--border)" }}>
            <Avatar url={avatarOf(own) ?? own.avatar_url} name={own.name ?? own.username ?? "you"} size={48} user={own} />
            {!hasOwn && <span className="story-add"><Icon name="plus" size={14} /></span>}
          </span>
          <span className="story-name muted small">{hasOwn ? "Your story" : "Add"}</span>
        </Link>
      )}
      {others.map((u) => (
        <Link to={`/stories/${u.publicId}`} key={u.publicId} className="story-avatar" title={`@${u.username}`}>
          <span
            className={`story-ring${u.has_unseen ? " unseen" : ""}`}
            style={{ borderColor: u.has_unseen ? "var(--accent)" : u.ring_color ?? "var(--border)" }}
          >
            <Avatar url={avatarOf(u) ?? u.avatar_url} name={u.name ?? u.username} size={48} user={u} />
          </span>
          <span className="story-name muted small">{u.username}</span>
        </Link>
      ))}
    </div>
  );
}
