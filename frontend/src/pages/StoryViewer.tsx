import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import Media from "../components/Media";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { useSession } from "../hooks";
import { avatarOf, timeAgo } from "../util";
import type { StoriesFeed, StoryItem, StoryUser, User } from "../types";

const PHOTO_MS = 5000;

/** Story viewer: progress bars, auto-advance (5s photo / video end), pause on
 *  hold, left/right tap zones, viewers + delete for own stories, marks viewed. */
export default function StoryViewer() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [userStories, setUserStories] = useState<StoryUser | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<User[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!publicId) return;
    api
      .stories(1, 50)
      .then((res) => {
        const feed = res.data as StoriesFeed;
        const found = [...(feed.users ?? []), ...(feed.current_user ? [feed.current_user] : [])].find(
          (u) => u.publicId === publicId,
        );
        if (!found) throw new ApiError(404, "not_found", "stories not found for this user");
        // current_user may be a stub — fill identity/avatar from the session user
        setUserStories(
          found.publicId && user?.publicId === found.publicId
            ? { ...found, ...user, stories: found.stories, has_unseen: found.has_unseen }
            : found,
        );
        setIndex(0);
      })
      .catch((e) => setError((e as ApiError).message ?? "failed to load stories"));
  }, [publicId, user]);

  const story: StoryItem | undefined = userStories?.stories?.[index];
  const isOwn = !!user && (userStories?.publicId === user.publicId);
  const isVideo = story?.media?.some((m) => m.mime?.startsWith("video/"));

  const next = useCallback(() => {
    if (!userStories?.stories) return;
    if (index + 1 < userStories.stories.length) setIndex(index + 1);
    else navigate("/");
  }, [index, userStories, navigate]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // auto-advance for photos; videos advance on ended
  useEffect(() => {
    if (!story || paused || isVideo) return;
    timer.current = window.setTimeout(next, PHOTO_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [story?.publicId, paused, isVideo, next]);

  // mark viewed
  useEffect(() => {
    if (story?.publicId) api.viewStory(story.publicId, 1).catch(() => {});
  }, [story?.publicId]);

  // viewers of own story
  useEffect(() => {
    if (showViewers && isOwn && story?.publicId) {
      api
        .storyViewers(story.publicId, 1, 50)
        .then((res) => {
          const raw = res.data as unknown;
          const o = raw as Record<string, unknown> | null;
          setViewers((Array.isArray(raw) ? raw : o?.viewers ?? o?.users ?? o?.data ?? []) as User[]);
        })
        .catch(() => {});
    }
  }, [showViewers, isOwn, story?.publicId]);

  async function onDelete() {
    if (!story?.publicId) return;
    try {
      await api.deletePost(story.publicId);
      setConfirmDelete(false);
      next();
    } catch (e) {
      setError((e as ApiError).message ?? "failed to delete story");
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!userStories || !story) return <p className="muted">Loading story…</p>;

  return (
    <div
      className="story-viewer"
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onClick={(e) => {
        const x = e.clientX / window.innerWidth;
        if (x < 0.3) prev();
        else next();
      }}
    >
      <div className="story-progress">
        {userStories.stories?.map((s, i) => (
          <span key={s.publicId} className={`story-prog${i < index ? " done" : ""}${i === index ? " now" : ""}`} />
        ))}
      </div>
      <header className="story-head">
        <Avatar url={avatarOf(userStories)} name={userStories.name ?? userStories.username} size={36} user={userStories} />
        <strong>{userStories.name ?? userStories.username}</strong>
        <span className="muted small" title={story.created_at}>{timeAgo(story.created_at)}</span>
        {isOwn && (
          <>
            <button className="link-btn" onClick={(e) => { e.stopPropagation(); setShowViewers((s) => !s); }}>
              <Icon name="eye" size={15} /> viewers
            </button>
            <button className="link-btn danger" onClick={(e) => { e.stopPropagation(); setConfirmDelete((c) => !c); }}>
              <Icon name="trash-can" size={15} />
            </button>
          </>
        )}
        <button className="link-btn" onClick={(e) => { e.stopPropagation(); navigate("/"); }}><Icon name="x" size={16} /></button>
      </header>
      {confirmDelete && (
        <div className="story-confirm" onClick={(e) => e.stopPropagation()}>
          <button className="danger-btn" onClick={onDelete}>Delete this story?</button>
        </div>
      )}
      {showViewers && (
        <div className="story-viewers" onClick={(e) => e.stopPropagation()}>
          {viewers.length === 0 && <p className="muted small">No viewers yet.</p>}
          {viewers.map((v, i) => (
            <div key={String(v.publicId ?? v.id ?? i)} className="story-viewer-row">
              <Avatar url={avatarOf(v)} name={v.name ?? v.username} size={28} user={v} />
              <span>{v.name ?? v.username}</span>
            </div>
          ))}
        </div>
      )}
      <div className="story-media" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            key={story.publicId}
            className="media-item"
            src={story.media?.find((m) => m.mime?.startsWith("video/"))?.url}
            controls={false}
            autoPlay
            playsInline
            onEnded={next}
          />
        ) : (
          <Media media={story.media} />
        )}
        {story.description && <p className="story-caption">{story.description}</p>}
      </div>
      <p className="muted small center">tap right/left for next/prev · hold to pause</p>
    </div>
  );
}
