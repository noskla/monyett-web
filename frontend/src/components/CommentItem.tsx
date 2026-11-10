import { useState } from "react";
import { ApiError, api } from "../api";
import type { Comment } from "../types";
import Avatar from "./Avatar";
import CommentComposer from "./CommentComposer";
import UserBadge from "./UserBadge";
import RichText from "./RichText";
import Icon from "./Icon";
import { timeAgo, ringColorOf, badgeOf, tierOf } from "../util";

interface Props {
  comment: Comment;
  currentUserId?: number;
  currentUserPublicId?: string;
  onDeleted: (commentId: string) => void;
  onReplied: (parentId: string, reply: Comment) => void;
}

/** Comment with reply composer, nested replies, and delete-own. */
export default function CommentItem({ comment, currentUserId, currentUserPublicId, onDeleted, onReplied }: Props) {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const author = comment.commented_by;
  const name = author?.name ?? author?.username ?? "unknown";
  const own =
    (currentUserId != null && author?.id === currentUserId) ||
    (currentUserPublicId != null && author?.public_id === currentUserPublicId);
  const cid = comment.public_id;

  async function loadReplies() {
    if (!cid) return;
    setLoadingReplies(true);
    setError(null);
    try {
      const res = await api.replies(cid, 1, 50);
      setReplies(res.data.replies ?? []);
      setShowReplies(true);
    } catch (e) {
      setError((e as ApiError).message ?? "failed to load replies");
    } finally {
      setLoadingReplies(false);
    }
  }

  async function onDelete() {
    if (!cid || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteComment(cid);
      onDeleted(cid);
    } catch (e) {
      setError((e as ApiError).message ?? "failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div className="comment">
      <Avatar url={author?.avatar_url} name={name} size={32} user={author} ringColor={ringColorOf(author)} />
      <div className="comment-body">
        <div className="comment-head">
          <strong>{name}</strong>
          <UserBadge badge={badgeOf(author)} tier={tierOf(author)} />
          {author?.username && <span className="muted"> @{author.username}</span>}
          <span className="muted small"> {timeAgo(comment.created_at)}</span>
        </div>
        <p className="comment-text">
          <RichText text={comment.comment} />
        </p>
        <div className="comment-actions muted small">
          <span><Icon name="heart" size={13} /> {comment.likes_count ?? 0}</span>
          <button className="link-btn" onClick={() => setShowReply((s) => !s)}>reply</button>
          {(comment.replies_count ?? 0) > 0 && (
            <button className="link-btn" onClick={showReplies ? () => setShowReplies(false) : loadReplies} disabled={loadingReplies}>
              {loadingReplies ? "…" : showReplies ? "hide replies" : `${comment.replies_count} replies`}
            </button>
          )}
          {own && (
            <button className="link-btn danger" onClick={onDelete} disabled={deleting}>
              {deleting ? "…" : "delete"}
            </button>
          )}
          {error && <span className="error"> {error}</span>}
        </div>
        {showReply && cid && (
          <CommentComposer
            postId={comment.post_id ?? ""}
            parentCommentId={cid}
            autoFocus
            placeholder="Write a reply…"
            onCreated={(r) => {
              setShowReply(false);
              setReplies((prev) => [...prev, r]);
              setShowReplies(true);
              onReplied(cid, r);
            }}
            onError={(m) => setError(m)}
          />
        )}
        {showReplies && replies.map((r) => (
          <div className="comment reply" key={r.public_id}>
            <Avatar url={r.commented_by?.avatar_url} name={r.commented_by?.name ?? r.commented_by?.username} size={28} user={r.commented_by} ringColor={ringColorOf(r.commented_by)} />
            <div className="comment-body">
              <div className="comment-head">
                <strong>{r.commented_by?.name ?? r.commented_by?.username ?? "unknown"}</strong>
                <span className="muted small"> {timeAgo(r.created_at)}</span>
              </div>
              <p className="comment-text">{r.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
