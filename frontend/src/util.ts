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
