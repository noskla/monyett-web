import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import CommentItem from "../components/CommentItem";
import Media from "../components/Media";
import Avatar from "../components/Avatar";
import { timeAgo, avatarOf } from "../util";
import type { Comment, CommentsPage, Pagination, Post } from "../types";

/** Full post + paginated comments (read-only in Phase 1; writes are Phase 2). */
export default function PostDetail() {
  const { publicId } = useParams<{ publicId: string }>();
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

  if (postError) return <p className="error">{postError}</p>;
  if (!post) return <p className="muted">Loading post…</p>;

  const author = post.posted_by;
  const authorName = author?.name ?? author?.username ?? "unknown";

  return (
    <div className="post-detail">
      <article className="card post-card">
        <header className="post-header">
          <span className="post-author">
            <Avatar url={avatarOf(author)} name={authorName} size={40} />
            <span>
              <strong>{authorName}</strong>
              {author?.username && <span className="muted"> @{author.username}</span>}
            </span>
          </span>
          <span className="muted small">{timeAgo(post.publishedAt ?? post.createdAt)}</span>
        </header>
        {post.title && <h3 className="post-title">{post.title}</h3>}
        {post.description && <p className="post-text">{post.description}</p>}
        <Media media={post.media} />
        <footer className="post-footer muted small">
          <span>♥ {post.likes_count ?? 0}</span>
          <span>💬 {post.comments_count ?? 0}</span>
          <span>🔁 {post.repost_count ?? 0}</span>
        </footer>
      </article>

      <section className="comments">
        <h3>Comments</h3>
        {commentsError && <p className="error">{commentsError}</p>}
        {comments.map((c) => (
          <CommentItem key={c.public_id} comment={c} />
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
