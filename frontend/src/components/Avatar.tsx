import type { CSSProperties } from "react";
import { badgeOf, isHumanBadge, ringColorsOf, tierOf } from "../util";

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  /** the user object — badge/tier/ring are derived from it (tolerant of field names) */
  user?: unknown;
}

const MEMBER_COLOR = "#0089f7";
const MEMBER_PLUS_COLOR = "#ffd257";
const ACCENT = "#ff384f"; // brand pink, used when the API defines no ring color

/** Avatar with ring + checkmark for badged users:
 *  - border color/gradient comes from the API (avatar_ring_color(s) /
 *    avatarRingColor); members without one fall back to the tier color
 *  - checkmark (bottom-right, scales with avatar) for human/member badges
 *  - users with no badge and no API ring color: plain avatar */
export default function Avatar({ url, name, size = 40, user }: AvatarProps) {
  const human = isHumanBadge(user);
  const tier = tierOf(user);
  const badge = badgeOf(user);
  const hay = `${tier ?? ""} ${badge ?? ""}`.toUpperCase();
  const isMemberPlus = hay.includes("PLUS") || hay.includes("PREMIUM") || hay.includes("+");
  const isMember = isMemberPlus || hay.includes("MEMBER") || hay.includes("MEMBERSHIP") || hay.includes("PAID") || hay.includes("SUBSCRIBER");
  const tierColor = isMemberPlus ? MEMBER_PLUS_COLOR : MEMBER_COLOR;

  const ringColors = ringColorsOf(user);
  const showCheck = human || isMember;
  const ringStyle: CSSProperties | undefined = ringColors.length
    ? ringColors.length > 1
      ? {
          // gradient border: transparent border + two-layer background
          border: "2px solid transparent",
          background: `linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(135deg, ${ringColors.join(", ")}) border-box`,
        }
      : { borderColor: ringColors[0] }
    : isMember
      ? { borderColor: tierColor }
      : undefined;
  const checkColor = ringColors[0] ?? (isMember ? tierColor : ACCENT);
  const checkSize = Math.max(12, Math.round(size * 0.26));

  const inner = url ? (
    <img className="avatar" src={url} alt={name ?? ""} width={size} height={size} loading="lazy" />
  ) : (
    <div className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size / 2 }}>
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
  return (
    <span className="avatar-wrap" style={{ width: size + 6, height: size + 6 }}>
      <span className="avatar-ring" style={ringStyle}>
        {inner}
      </span>
      {showCheck && (
        <span
          className="avatar-check"
          style={{
            background: checkColor,
            width: checkSize,
            height: checkSize,
            fontSize: Math.round(checkSize * 0.66),
          }}
        >
          ✓
        </span>
      )}
    </span>
  );
}
