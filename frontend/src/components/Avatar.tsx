import { isHumanBadge } from "../util";

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  /** badge string; "HUMAN" renders a checkmark overlay */
  badge?: string | null;
  /** user-chosen ring color (hex) */
  ringColor?: string | null;
}

const DEFAULT_HUMAN_RING = "#50c88c";

/** Avatar with optional colored ring + human-verified checkmark overlay. */
export default function Avatar({ url, name, size = 40, badge, ringColor }: AvatarProps) {
  const human = isHumanBadge(badge);
  const ring = ringColor ?? (human ? DEFAULT_HUMAN_RING : null);
  const inner = url ? (
    <img className="avatar" src={url} alt={name ?? ""} width={size} height={size} loading="lazy" />
  ) : (
    <div className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size / 2 }}>
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
  return (
    <span className="avatar-wrap" style={{ width: size + 6, height: size + 6 }}>
      <span className="avatar-ring" style={ring ? { borderColor: ring } : undefined}>
        {inner}
      </span>
      {human && (
        <span className="avatar-check" style={{ background: ring ?? DEFAULT_HUMAN_RING }}>
          ✓
        </span>
      )}
    </span>
  );
}
