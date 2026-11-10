import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import type { Comment, Pagination } from "../types";
import Avatar from "./Avatar";
import CommentComposer from "./CommentComposer";
import UserBadge from "./UserBadge";
import RichText from "./RichText";
import Icon from "./Icon";
import { timeAgo, exactTime, badgeOf, tierOf } from "../util";

interface Props {
  comment: Comment;
  currentUserId?: number;
  currentUserPublicId?: string;
  onDeleted: (commentId: string) => void;
  onReplied: (parentId: string, reply: Comment) => void;
  depth?: number; // nesting level; tree auto-expands only up to MAX_DEPTH
}

const REPLIES_PAGE = 5;   // small first page — don't pull whole threads
const MAX_DEPTH = 2;      // beyond this, replies require a click

/** Comment with auto-loaded (capped) reply tree, icon reply button, delete-own. */
export default function CommentItem({ comment, currentUserId, currentUserPublicId, onDeleted, onReplied, depth = 0 }: Props) {
  const [showReply, setShowReply] = useState(false);
  const [replies, setReplies] = useState<Comment[] | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const author = comment.commented_by;
  const name = author?.name ?? author?.username ?? "unknown";
  const own =
    (currentUserId != null && author?.id === currentUserId) ||
    (currentUserPublicId != null && author?.public_id === currentUserPublicId);
  const cid = comment.public_id;
  const replyCount = comment.replies_count ?? 0;

  const loadReplies = useCallback(
    async (p: number, append: boolean) => {
      if (!cid) return;
      setLoadingReplies(true);
      setError(null);
      try {
        const res = await api.replies(cid, p, REPLIES_PAGE);
        const meta = (res.meta ?? res.data.meta) as Pagination | undefined;
        setPageCount(meta?.pagination?.pageCount ?? null);
        setPage(p);
        setReplies((prev) => (append && prev ? [...prev, ...(res.data.replies ?? [])] : res.data.replies ?? []));
      } catch (e) {
        setError((e as ApiError).message ?? "failed to load replies");
      } finally {
        setLoadingReplies(false);
      }
    },
    [cid],
  );

  // auto-expand a small first page of the tree (bounded depth); longer
  // conversations require clicking "load more" so we don't pull whole threads
  useEffect(() => {
    if (cid && replyCount > 0 && depth < MAX_DEPTH && replies === null && !loadingReplies) {
      loadReplies(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, depth]);

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

  const showLoadMore = replies !== null && (pageCount === null || page < pageCount);
  const needsClickToExpand = replyCount > 0 && replies === null;

  return (
    <div className="comment">
      <Avatar url={author?.avatar_url} name={name} size={32} user={author} />
      <div className="comment-body">
        <div className="comment-head">
          <strong>{name}</strong>
          <UserBadge badge={badgeOf(author)} tier={tierOf(author)} />
          {author?.username && <span className="muted"> @{author.username}</span>}
          <span className="muted small" title={exactTime(comment.created_at)}> {timeAgo(comment.created_at)}</span>
        </div>
        <p className="comment-text">
          <RichText text={comment.comment} />
        </p>
        <div className="comment-actions muted small">
          <span><Icon name="heart" size={13} /> {comment.likes_count ?? 0}</span>
          <button className="link-btn icon-only" onClick={() => setShowReply((s) => !s)} title="Reply" aria-label="Reply">
            <Icon name="comment-1-text" size={14} />
          </button>
          {replyCount > 0 && (
            <span className="muted small">{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
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
              setReplies((prev) => [...(prev ?? []), r]);
              onReplied(cid, r);
            }}
            onError={(m) => setError(m)}
          />
        )}
        {needsClickToExpand && depth >= MAX_DEPTH && (
          <button className="link-btn" onClick={() => loadReplies(1, false)} disabled={loadingReplies}>
            {loadingReplies ? "…" : `show ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
          </button>
        )}
        {replies !== null && (
          <div className="replies">
            {replies.map((r) => (
              <CommentItem
                key={r.public_id}
                comment={r}
                currentUserId={currentUserId}
                currentUserPublicId={currentUserPublicId}
                onDeleted={onDeleted}
                onReplied={onReplied}
                depth={depth + 1}
              />
            ))}
            {showLoadMore && (
              <button className="link-btn" onClick={() => loadReplies(page + 1, true)} disabled={loadingReplies}>
                {loadingReplies ? "…" : "load more replies"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
