import { badgeOf, isHumanBadge, ringColorOf, tierOf } from "../util";

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  /** the user object — badge/tier/ring are derived from it (tolerant of field names) */
  user?: unknown;
  /** explicit ring color override (hex); used only when the user is a Member */
  ringColor?: string | null;
}

const DEFAULT_HUMAN_RING = "#ff384f"; // brand pink (--accent)
const MEMBER_COLOR = "#0089f7";
const MEMBER_PLUS_COLOR = "#ffd257";

/** Avatar with membership ring + corner checkmark.
 *  - Member/Member+ users: colored ring (user-chosen color if set, else tier
 *    color) + checkmark in the top-right corner, sized relative to the avatar
 *  - Human-verified: checkmark (no ring unless also a member)
 *  - Everyone else: no colored border at all */
export default function Avatar({ url, name, size = 40, user, ringColor }: AvatarProps) {
  const human = isHumanBadge(user);
  const tier = tierOf(user);
  const badge = badgeOf(user);
  const hay = `${tier ?? ""} ${badge ?? ""}`.toUpperCase();
  const isMemberPlus = hay.includes("PLUS") || hay.includes("PREMIUM") || hay.includes("+");
  const isMember = !isMemberPlus && (hay.includes("MEMBER") || hay.includes("MEMBERSHIP") || hay.includes("PAID") || hay.includes("SUBSCRIBER"));
  const tierColor = isMemberPlus ? MEMBER_PLUS_COLOR : MEMBER_COLOR;

  const ring = isMember ? ringColor ?? ringColorOf(user) ?? tierColor : null;
  const showCheck = human || isMember || isMemberPlus;
  const checkColor = isMember || isMemberPlus ? tierColor : ring ?? DEFAULT_HUMAN_RING;
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
      <span className="avatar-ring" style={ring ? { borderColor: ring } : undefined}>
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
