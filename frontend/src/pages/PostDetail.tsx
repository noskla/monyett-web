import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import CommentItem from "../components/CommentItem";
import CommentComposer from "../components/CommentComposer";
import LikeButton from "../components/LikeButton";
import Media from "../components/Media";
import Avatar from "../components/Avatar";
import UserBadge from "../components/UserBadge";
import RichText from "../components/RichText";
import Icon from "../components/Icon";
import { useSession } from "../hooks";
import { timeAgo, avatarOf, ringColorOf, badgeOf, tierOf } from "../util";
import type { Comment, CommentsPage, Pagination, Post } from "../types";

/** Full post + comments. Writes (comment/reply/delete/like) are optimistic
 *  with rollback on error and no auto-retry (PLAN.md §5). */
export default function PostDetail() {
  const { publicId } = useParams<{ publicId: string }>();
  const { user } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  useEffect(() => {
    setPost(null);
    setPostError(null);
    setComments([]);
    setPage(0);
    setPageCount(null);
    if (!publicId) return;
    api
      .post(publicId)
      .then((res) => setPost(res.data))
      .catch((e) => setPostError((e as ApiError).message ?? "failed to load post"));
  }, [publicId]);

  const loadComments = useCallback(
    async (p: number, replace: boolean) => {
      if (!publicId) return;
      setLoadingComments(true);
      setCommentsError(null);
      try {
        const res = await api.comments(publicId, p, 20);
        const pageData = res.data as CommentsPage;
        const meta = (res.meta ?? pageData.meta) as Pagination | undefined;
        setPageCount(meta?.pagination?.pageCount ?? null);
        setPage(p);
        setComments((prev) => (replace ? pageData.comments ?? [] : [...prev, ...(pageData.comments ?? [])]));
      } catch (e) {
        setCommentsError((e as ApiError).message ?? "failed to load comments");
      } finally {
        setLoadingComments(false);
      }
    },
    [publicId],
  );

  useEffect(() => {
    loadComments(1, true);
  }, [loadComments]);

  // optimistic add; rollback on composer error is handled inside the composer
  const onCreated = useCallback((c: Comment) => {
    setComments((prev) => [c, ...prev]);
    setPost((p) => (p ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p));
  }, []);

  const onDeleted = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.public_id !== commentId));
    setPost((p) => (p ? { ...p, comments_count: Math.max(0, (p.comments_count ?? 0) - 1) } : p));
  }, []);

  if (postError) return <p className="error">{postError}</p>;
  if (!post) return <p className="muted">Loading post…</p>;

  const author = post.posted_by;
  const authorName = author?.name ?? author?.username ?? "unknown";

  return (
    <div className="post-detail">
      <article className="card post-card">
        <header className="post-header">
          <span className="post-author">
            <Avatar url={avatarOf(author)} name={authorName} size={40} user={author} ringColor={ringColorOf(author)} />
            <span>
              <strong>{authorName}</strong>
              <UserBadge badge={badgeOf(author)} tier={tierOf(author)} />
              {author?.username && <span className="muted"> @{author.username}</span>}
            </span>
          </span>
          <span className="muted small">{timeAgo(post.publishedAt ?? post.createdAt)}</span>
        </header>
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
        <footer className="post-footer muted small">
          <LikeButton postId={post.publicId} initialLiked={post.is_liked} initialCount={post.likes_count ?? 0} />
          <span><Icon name="comments" size={15} /> {post.comments_count ?? 0}</span>
          <span><Icon name="share-alt" size={15} /> {post.repost_count ?? 0}</span>
        </footer>
      </article>

      <section className="comments">
        <h3>Comments</h3>
        {publicId && (
          <CommentComposer
            postId={publicId}
            onCreated={onCreated}
            onError={(m) => setCommentsError(m)}
          />
        )}
        {commentsError && <p className="error">{commentsError}</p>}
        {comments.map((c) => (
          <CommentItem
            key={c.public_id}
            comment={c}
            currentUserId={user?.id}
            currentUserPublicId={user?.publicId}
            onDeleted={onDeleted}
            onReplied={() => setPost((p) => (p ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p))}
          />
        ))}
        {!loadingComments && comments.length === 0 && !commentsError && (
          <p className="muted">No comments yet.</p>
        )}
        {(pageCount === null || page < pageCount) && (
          <button className="load-more" onClick={() => loadComments(page + 1, false)} disabled={loadingComments}>
            {loadingComments ? "Loading…" : "Load more comments"}
          </button>
        )}
      </section>
    </div>
  );
}
