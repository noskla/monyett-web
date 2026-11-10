import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api";
import Avatar from "../components/Avatar";
import UserBadge from "../components/UserBadge";
import { avatarOf, badgeOf, tierOf, timeAgo, notifMeta } from "../util";
import Icon from "../components/Icon";
import type { Notification } from "../types";

function extractList(raw: unknown): Notification[] {
  if (Array.isArray(raw)) return raw as Notification[];
  const o = raw as Record<string, unknown> | null;
  return (o?.notifications as Notification[]) ?? (o?.items as Notification[]) ?? (o?.data as Notification[]) ?? [];
}

/** Notifications list + unread count + mark-seen. User-triggered only. */
export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([api.notifications(1, 50), api.notificationCount()]);
      setItems(extractList(list.data));
      const c = count.data as Record<string, unknown>;
      const n = c?.count ?? c?.unread ?? c?.unreadCount ?? (typeof count.data === "number" ? count.data : null);
      setUnread(typeof n === "number" ? n : null);
    } catch (e) {
      setError((e as ApiError).message ?? "failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    try {
      await api.markAllNotificationsSeen();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_seen: true })));
    } catch (e) {
      setError((e as ApiError).message ?? "failed");
    }
  }

  return (
    <div className="notifications">
      <div className="feed-toolbar">
        <h2>Notifications {unread !== null && unread > 0 && <span className="unread-pill">{unread}</span>}</h2>
        <button onClick={markAll} disabled={unread === 0}>Mark all seen</button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && items.length === 0 && !error && <p className="muted">No notifications.</p>}
      {items.map((n, i) => {
        const actor = n.actor ?? (n as Record<string, unknown>).user as Notification["actor"];
        const post = n.post ?? (n as Record<string, unknown>).post as Notification["post"];
        const when = n.created_at ?? n.createdAt;
        const meta = notifMeta(n as Record<string, unknown>);
        const actorName = actor?.name ?? actor?.username ?? "Someone";
        const inner = (
          <>
            <span className="notif-icon" style={{ background: `${meta.color}22`, color: meta.color }}>
              <Icon name={meta.icon} size={16} />
            </span>
            <Avatar url={avatarOf(actor)} name={actorName} size={36} user={actor} ringColor={undefined} />
            <span>
              <strong>{actorName}</strong>
              <UserBadge badge={badgeOf(actor)} tier={tierOf(actor)} />
              <span> {meta.verb}</span>
              {when && <span className="muted small"> · {timeAgo(when)}</span>}
            </span>
            {!n.is_seen && <span className="unread-dot" title="unread" />}
          </>
        );
        return (
          <div className={`card notif${n.is_seen ? "" : " unseen"}`} key={String(n.id ?? i)}>
            {post?.publicId ? <Link to={`/post/${post.publicId}`}>{inner}</Link> : inner}
          </div>
        );
      })}
    </div>
  );
}
