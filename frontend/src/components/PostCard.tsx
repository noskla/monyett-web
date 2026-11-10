import { Link } from "react-router-dom";
import type { Post } from "../types";
import Avatar from "./Avatar";
import Media from "./Media";
import LikeButton from "./LikeButton";
import UserBadge from "./UserBadge";
import RichText from "./RichText";
import Icon from "./Icon";
import { timeAgo, exactTime, ringColorOf, badgeOf, tierOf } from "../util";

function locationText(post: Post): string {
  const l = post.location;
  if (!l) return "";
  return [l.city ?? l.area, l.country].filter(Boolean).join(", ");
}

/** The dominant feed component: author, text, media, counts.
 *  Only the timestamp links to the post page; the rest of the card is not a link. */
export default function PostCard({ post }: { post: Post }) {
  const author = post.posted_by;
  const authorName = author?.name ?? author?.username ?? "unknown";
  const avatarUrl =
    author?.profile_picture?.url ??
    author?.profile_picture?.compressed_url ??
    (author as { avatar_url?: string } | undefined)?.avatar_url;
  const when = post.publishedAt ?? post.createdAt;
  const loc = locationText(post);

  return (
    <article className="card post-card">
      <header className="post-header">
        <Link to={author?.username ? `/u/${author.username}` : "#"} className="post-author">
          <Avatar url={avatarUrl} name={authorName} size={40} user={author} ringColor={ringColorOf(author)} />
          <span>
            <strong>{authorName}</strong>
            <UserBadge badge={badgeOf(author)} tier={tierOf(author)} />
            {author?.username && <span className="muted"> @{author.username}</span>}
          </span>
        </Link>
        <span className="post-meta">
          <Link to={`/post/${post.publicId}`} className="post-time muted small" title={exactTime(when)}>
            {timeAgo(when)}
          </Link>
          {loc && (
            <span className="post-location muted small" title={loc}>
              <Icon name="map-marker" size={12} /> {loc}
            </span>
          )}
        </span>
      </header>
      <div className="post-body">
        {post.title && (
          <h3 className="post-title">
            <RichText text={post.title} />
          </h3>
        )}
        {post.description && (
          <p className="post-text">
            <RichText text={post.description} />
          </p>
        )}
        <Media media={post.media} />
      </div>
      <footer className="post-footer muted small">
        <LikeButton postId={post.publicId} initialLiked={post.is_liked} initialCount={post.likes_count ?? 0} />
        <span><Icon name="comments" size={15} /> {post.comments_count ?? 0}</span>
        <span><Icon name="share-alt" size={15} /> {post.repost_count ?? 0}</span>
        <span><Icon name="eye" size={15} /> {post.view_count ?? 0}</span>
      </footer>
    </article>
  );
}
