export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

/** Exact local date+time for hover tooltips, e.g. "10 Nov 2026, 14:32". */
export function exactTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const AVATAR_URL_FIELDS = ["url", "optimalUrl", "originalUrl", "thumbnailUrl", "compressed_url", "compressedUrl", "thumbnail_url"];

/** Avatar URL from any avatar/picture-shaped field the API uses.
 *  Direct string fields (avatar_url / avatarUrl) win over nested picture
 *  objects, whose variants may still be processing. */
export function avatarOf(user: unknown): string | undefined {
  const u = user as Record<string, any> | null;
  if (!u) return undefined;
  for (const k of ["avatar_url", "avatarUrl", "avatar"]) {
    if (typeof u[k] === "string" && u[k]) return u[k];
  }
  for (const [k, v] of Object.entries(u)) {
    if (!/avatar|picture/i.test(k)) continue;
    if (typeof v === "string" && v) return v;
    if (v && typeof v === "object") {
      for (const f of AVATAR_URL_FIELDS) {
        if (typeof v[f] === "string" && v[f]) return v[f];
      }
    }
  }
  return undefined;
}

/** The user-chosen avatar ring color (hex), from any of the shapes the API uses. */
export function ringColorOf(user: unknown): string | undefined {
  const u = user as Record<string, any> | null;
  if (!u) return undefined;
  return (
    u.avatar_ring_color ??
    u.avatarRingColor?.hexCode ??
    u.avatar_ring_colors?.[0] ??
    u.avatarRingColor?.colors?.[0]
  );
}

/** Badge string from any plausible field name (badge, userBadge, ...). */
export function badgeOf(user: unknown): string | undefined {
  const u = user as Record<string, any> | null;
  if (!u) return undefined;
  for (const [k, v] of Object.entries(u)) {
    if (/badge/i.test(k) && typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/** Membership tier from any plausible field (effectiveTier, subscriptionTier,
 *  member/isMember booleans, ...). Returns an uppercase token or undefined. */
export function tierOf(user: unknown): string | undefined {
  const u = user as Record<string, any> | null;
  if (!u) return undefined;
  for (const [k, v] of Object.entries(u)) {
    const key = k.toLowerCase();
    if ((key.includes("tier") || key.includes("subscription") || key === "membership") ) {
      if (typeof v === "string" && v.trim() && v.toUpperCase() !== "FREE" && v.toUpperCase() !== "NONE") return v.toUpperCase();
    }
    if ((key === "member" || key === "ismember" || key === "is_member") && v === true) return "MEMBER";
  }
  return undefined;
}

export function isHumanBadge(user: unknown): boolean {
  return (badgeOf(user) ?? "").toUpperCase().includes("HUMAN");
}

export interface NotifMeta {
  icon: string;
  verb: string;
  color: string;
}

/** Map a notification type to a Lineicon + verb (Lineicons instead of emoji,
 *  per the design decision). Falls back to the raw type/message. */
export function notifMeta(type?: string | null, message?: string | null): NotifMeta {
  const t = (type ?? "").toUpperCase();
  const fallback: NotifMeta = { icon: "bell-1", verb: (message ?? "").trim() || t.toLowerCase() || "notification", color: "var(--muted)" };
  if (t.includes("LIKE")) return { icon: "heart", verb: "liked your post", color: "var(--accent)" };
  if (t.includes("REPLY")) return { icon: "comment-1-text", verb: "replied to your comment", color: "var(--link)" };
  if (t.includes("COMMENT")) return { icon: "comment-1", verb: "commented on your post", color: "var(--link)" };
  if (t.includes("FOLLOW")) return { icon: "user-4", verb: "started following you", color: "#6fdcb0" };
  if (t.includes("REPOST") || t.includes("SHARE")) return { icon: "share-1", verb: "reposted your post", color: "var(--link)" };
  if (t.includes("MENTION")) return { icon: "user-4", verb: "mentioned you", color: "#ffd257" };
  if (t.includes("VIEW") || t.includes("STORY")) return { icon: "eye", verb: "viewed your story", color: "var(--muted)" };
  if (t.includes("STAR") || t.includes("FAVORITE")) return { icon: "star-fat", verb: "starred your post", color: "#ffd257" };
  return fallback;
}
