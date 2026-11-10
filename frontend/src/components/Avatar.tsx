interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
}

/** Avatar from a CDN URL (no auth attached — media is public). Falls back to an initial. */
export default function Avatar({ url, name, size = 40 }: AvatarProps) {
  if (url) {
    return <img className="avatar" src={url} alt={name ?? ""} width={size} height={size} loading="lazy" />;
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size / 2 }}>
      {initial}
    </div>
  );
}
