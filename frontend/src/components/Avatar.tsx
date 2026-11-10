import type { CSSProperties } from "react";
import { badgeOf, ringColorsOf, tierOf } from "../util";

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  /** the user object — badge/tier/ring are derived from it (tolerant of field names) */
  user?: unknown;
}

const MEMBER_COLOR = "#0089f7";
const MEMBER_PLUS_COLOR = "#ffd257";
const ACCENT = "#ff384f";

/** Avatar for Member/Member+ users: colored border (single color or gradient,
 *  as defined by the API in avatar_ring_color(s)/avatarRingColor) + checkmark
 *  in the bottom-right corner, sized relative to the avatar.
 *  Non-members: plain avatar — no border, no checkmark. */
export default function Avatar({ url, name, size = 40, user }: AvatarProps) {
  const tier = tierOf(user);
  const badge = badgeOf(user);
  const hay = `${tier ?? ""} ${badge ?? ""}`.toUpperCase();
  const isMemberPlus = hay.includes("PLUS") || hay.includes("PREMIUM") || hay.includes("+");
  const isMember = isMemberPlus || hay.includes("MEMBER") || hay.includes("MEMBERSHIP") || hay.includes("PAID") || hay.includes("SUBSCRIBER");
  const tierColor = isMemberPlus ? MEMBER_PLUS_COLOR : MEMBER_COLOR;

  const ringColors = isMember ? ringColorsOf(user) : [];
  const ringStyle: CSSProperties | undefined = !isMember
    ? undefined
    : ringColors.length > 1
      ? {
          // gradient border: transparent border + two-layer background
          border: "2px solid transparent",
          background: `linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(135deg, ${ringColors.join(", ")}) border-box`,
        }
      : { borderColor: ringColors[0] ?? tierColor };

  const showCheck = isMember;
  const checkColor = tierColor;
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
            background: checkColor || ACCENT,
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
