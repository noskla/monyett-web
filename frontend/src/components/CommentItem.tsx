import type { Comment } from "../types";
import Avatar from "./Avatar";
import { timeAgo } from "../util";

export default function CommentItem({ comment }: { comment: Comment }) {
  const author = comment.commented_by;
  const name = author?.name ?? author?.username ?? "unknown";
  return (
    <div className="comment">
      <Avatar url={author?.avatar_url} name={name} size={32} />
      <div className="comment-body">
        <div className="comment-head">
          <strong>{name}</strong>
          {author?.username && <span className="muted"> @{author.username}</span>}
          <span className="muted small"> {timeAgo(comment.created_at)}</span>
        </div>
        <p className="comment-text">{comment.comment}</p>
        <div className="muted small">
          ♥ {comment.likes_count ?? 0}
          {(comment.replies_count ?? 0) > 0 && <span> · {comment.replies_count} replies</span>}
        </div>
      </div>
    </div>
  );
}
