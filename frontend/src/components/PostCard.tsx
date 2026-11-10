import { Link } from "react-router-dom";
import type { Post } from "../types";
import Avatar from "./Avatar";
import Media from "./Media";
import LikeButton from "./LikeButton";
import UserBadge from "./UserBadge";
import { timeAgo } from "../util";

/** The dominant feed component: author, text, media, counts. */
export default function PostCard({ post }: { post: Post }) {
  const author = post.posted_by;
  const authorName = author?.name ?? author?.username ?? "unknown";
  const avatarUrl =
    author?.profile_picture?.url ??
    author?.profile_picture?.compressed_url ??
    (author as { avatar_url?: string } | undefined)?.avatar_url;

  return (
    <article className="card post-card">
      <header className="post-header">
        <Link to={author?.username ? `/u/${author.username}` : "#"} className="post-author">
          <Avatar url={avatarUrl} name={authorName} size={40} />
          <span>
            <strong>{authorName}</strong>
            <UserBadge badge={author?.badge} tier={author?.effectiveTier} />
            {author?.username && <span className="muted"> @{author.username}</span>}
          </span>
        </Link>
        <span className="muted small">{timeAgo(post.publishedAt ?? post.createdAt)}</span>
      </header>
      <Link to={`/post/${post.publicId}`} className="post-body">
        {post.title && <h3 className="post-title">{post.title}</h3>}
        {post.description && <p className="post-text">{post.description}</p>}
        <Media media={post.media} />
      </Link>
      <footer className="post-footer muted small">
        <LikeButton postId={post.publicId} initialLiked={post.is_liked} initialCount={post.likes_count ?? 0} />
        <span>💬 {post.comments_count ?? 0}</span>
        <span>🔁 {post.repost_count ?? 0}</span>
        <span>👁 {post.view_count ?? 0}</span>
      </footer>
    </article>
  );
}
