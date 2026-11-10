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

export function avatarOf(user: unknown): string | undefined {
  const u = user as {
    avatar_url?: string;
    profile_picture?: { url?: string; compressed_url?: string; thumbnail_url?: string };
    profilePicture?: { originalUrl?: string; optimalUrl?: string; thumbnailUrl?: string };
  } | null;
  return (
    u?.avatar_url ??
    u?.profile_picture?.url ??
    u?.profile_picture?.compressed_url ??
    u?.profilePicture?.optimalUrl ??
    u?.profilePicture?.originalUrl ??
    u?.profilePicture?.thumbnailUrl
  );
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
