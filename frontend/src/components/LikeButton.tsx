import { useState } from "react";
import { ApiError, api } from "../api";

interface LikeButtonProps {
  postId?: string;
  initialLiked?: boolean;
  initialCount?: number;
}

/** Optimistic like/unlike via the idempotent v1 pair. On error: rollback +
 * inline message. No auto-retry (PLAN.md §5) — the user can press again. */
export default function LikeButton({ postId, initialLiked = false, initialCount = 0 }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!postId || pending) return;
    const wasLiked = liked;
    const wasCount = count;
    setLiked(!wasLiked); // optimistic
    setCount(wasCount + (wasLiked ? -1 : 1));
    setError(null);
    setPending(true);
    try {
      const res = wasLiked ? await api.unlikePost(postId) : await api.likePost(postId);
      // trust the server state when present
      if (res.data && typeof res.data.liked === "boolean") setLiked(res.data.liked);
      if (res.data && typeof res.data.likeCount === "number") setCount(res.data.likeCount);
    } catch (e) {
      setLiked(wasLiked); // rollback
      setCount(wasCount);
      setError((e as ApiError).message ?? "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="like-button">
      <button
        className={`like-btn${liked ? " liked" : ""}`}
        onClick={toggle}
        disabled={pending || !postId}
        title={liked ? "Unlike" : "Like"}
      >
        {liked ? "♥" : "♡"} {count}
      </button>
      {error && <span className="error small"> {error}</span>}
    </span>
  );
}
