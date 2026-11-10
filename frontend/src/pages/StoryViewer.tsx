import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import Media from "../components/Media";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { avatarOf } from "../util";
import type { StoriesFeed, StoryItem, StoryUser } from "../types";

/** Read-only story viewer: shows a user's stories one by one, marks each as
 *  viewed via POST v1/app/stories/{publicId}/view. */
export default function StoryViewer() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<StoryUser | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        setUser(found);
      })
      .catch((e) => setError((e as ApiError).message ?? "failed to load stories"));
  }, [publicId]);

  const story: StoryItem | undefined = user?.stories?.[index];

  useEffect(() => {
    if (story?.publicId) {
      api.viewStory(story.publicId, 1).catch(() => {});
    }
  }, [story?.publicId]);

  function next() {
    if (!user?.stories) return;
    if (index + 1 < user.stories.length) setIndex(index + 1);
    else navigate("/");
  }

  if (error) return <p className="error">{error}</p>;
  if (!user || !story) return <p className="muted">Loading story…</p>;

  return (
    <div className="story-viewer" onClick={next}>
      <header className="story-head">
        <Avatar url={avatarOf(user)} name={user.name ?? user.username} size={36} user={user} />
        <strong>{user.name ?? user.username}</strong>
        <span className="muted small">{index + 1}/{user.stories?.length ?? 0}</span>
        <button className="link-btn" onClick={(e) => { e.stopPropagation(); navigate("/"); }}><Icon name="times" size={16} /></button>
      </header>
      <div className="story-media">
        <Media media={story.media} />
        {story.description && <p className="story-caption">{story.description}</p>}
        {!story.media?.length && !story.description && <p className="muted">…</p>}
      </div>
      <p className="muted small center">tap for next</p>
    </div>
  );
}
