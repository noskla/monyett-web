import { useState } from "react";
import { ApiError, api } from "../api";

interface Props {
  publicId?: string;
  initialFollowing?: boolean;
  onState?: (following: boolean, followerCount?: number) => void;
}

/** Optimistic follow/unfollow via idempotent v1 POST/DELETE (public UUID).
 *  Rollback + error message on failure; no auto-retry. */
export default function FollowButton({ publicId, initialFollowing = false, onState }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!publicId || pending) return;
    const was = following;
    setFollowing(!was);
    setError(null);
    setPending(true);
    try {
      const res = was ? await api.unfollow(publicId) : await api.follow(publicId);
      if (res.data && typeof res.data.following === "boolean") {
        setFollowing(res.data.following);
        onState?.(res.data.following, res.data.followerCount);
      } else {
        onState?.(!was);
      }
    } catch (e) {
      setFollowing(was);
      setError((e as ApiError).message ?? "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="follow-button">
      <button className={following ? "following" : ""} onClick={toggle} disabled={pending || !publicId}>
        {pending ? "…" : following ? "Following" : "Follow"}
      </button>
      {error && <span className="error small"> {error}</span>}
    </span>
  );
}
