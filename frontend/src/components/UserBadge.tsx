interface Props {
  /** Free-form badge string from MinimalUserDTO.badge / CommentAuthorV1Dto.badge */
  badge?: string | null;
  /** SubscriptionTier from UserProfile.effectiveTier: FREE | MEMBERSHIP | MEMBERSHIP_PLUS */
  tier?: string | null;
}

function normalize(badge?: string | null, tier?: string | null): { label: string; kind: string } | null {
  const raw = `${badge ?? ""} ${tier ?? ""}`.toUpperCase();
  if (raw.includes("MEMBERSHIP_PLUS") || raw.includes("MEMBER_PLUS") || raw.includes("PLUS") || raw.includes("PREMIUM") || raw.includes("+")) {
    return { label: "Member+", kind: "member-plus" };
  }
  if (raw.includes("MEMBER") || raw.includes("MEMBERSHIP") || raw.includes("PAID") || raw.includes("SUBSCRIBER")) {
    return { label: "Member", kind: "member" };
  }
  if (raw.includes("VERIFIED")) return { label: "✓", kind: "verified" };
  if (raw.includes("HUMAN")) return { label: "Human", kind: "human" };
  if (badge && badge.trim()) return { label: badge.trim(), kind: "other" };
  return null;
}

/** Membership/verified badge next to a username. Renders nothing when absent. */
export default function UserBadge({ badge, tier }: Props) {
  const b = normalize(badge, tier);
  if (!b) return null;
  return (
    <span className={`badge badge-${b.kind}`} title={b.label}>
      {b.label}
    </span>
  );
}
