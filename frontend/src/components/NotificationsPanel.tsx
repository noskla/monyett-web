import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "./Icon";
import { timeAgo, notifMeta } from "../util";
import type { Notification } from "../types";

function extractList(raw: unknown): Notification[] {
  if (Array.isArray(raw)) return raw as Notification[];
  const o = raw as Record<string, unknown> | null;
  return (o?.notifications as Notification[]) ?? (o?.items as Notification[]) ?? (o?.data as Notification[]) ?? [];
}

/** Sidebar notifications panel: unread count, latest 5 with event-type icon,
 *  actor shown once, readable text, full text on hover, mark-all-seen. */
export default function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([api.notifications(1, 5), api.notificationCount()]);
      setItems(extractList(list.data));
      const c = count.data as Record<string, unknown>;
      const n = c?.count ?? c?.unread ?? c?.unreadCount ?? (typeof count.data === "number" ? count.data : null);
      if (typeof n === "number") setUnread(n);
    } catch {
      /* panel is best-effort */
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
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="card side-notifs">
      <div className="side-notifs-head">
        <strong><Icon name="bell" size={15} /> Notifications</strong>
        {unread !== null && unread > 0 && <span className="unread-pill">{unread}</span>}
        {unread !== null && unread > 0 && (
          <button className="link-btn small" onClick={markAll}>mark all seen</button>
        )}
      </div>
      {items.length === 0 && <p className="muted small">No notifications.</p>}
      {items.map((n, i) => {
        const actor = n.actor ?? (n as Record<string, unknown>).user as Notification["actor"];
        const post = n.post ?? (n as Record<string, unknown>).post as Notification["post"];
        const when = n.created_at ?? n.createdAt;
        const meta = notifMeta(n.type, n.message);
        const actorName = actor?.name ?? actor?.username ?? "Someone";
        const fullText = `${actorName} ${meta.verb}${n.message && !meta.verb.includes(n.message) ? ` — ${n.message}` : ""}${when ? ` · ${timeAgo(when)}` : ""}`;
        const row = (
          <>
            <span
              className="notif-icon"
              style={{
                color: meta.color,
                background: `color-mix(in srgb, ${meta.color} 20%, transparent)`,
                border: `1px solid color-mix(in srgb, ${meta.color} 45%, transparent)`,
              }}
            >
              <Icon name={meta.icon} size={15} />
            </span>
            <span className="side-notif-text" title={fullText}>
              <strong>{actorName}</strong> {meta.verb}
              {when && <span className="muted small"> · {timeAgo(when)}</span>}
            </span>
            {!n.is_seen && <span className="unread-dot" />}
          </>
        );
        return (
          <div className="side-notif" key={String(n.id ?? i)}>
            {post?.publicId ? <Link to={`/post/${post.publicId}`}>{row}</Link> : row}
          </div>
        );
      })}
      <Link to="/notifications" className="small">View all →</Link>
    </div>
  );
}
