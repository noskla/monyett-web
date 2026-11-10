import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import FollowButton from "../components/FollowButton";
import UserBadge from "../components/UserBadge";
import RichText from "../components/RichText";
import Icon from "../components/Icon";
import { useSession } from "../hooks";
import { avatarOf, ringColorOf, badgeOf, tierOf, locationText } from "../util";
import type { Pagination, Post, User } from "../types";

interface UserStats {
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
}

interface ProfileShape extends User {
  stats?: UserStats;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
}

/** Profile: resolve username -> IDs, then full legacy profile + posts grid.
 *  v1 uses UUIDs, legacy endpoints numeric IDs — both kept, never mixed. */
export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const { user } = useSession();

  useEffect(() => {
    setProfile(null);
    setError(null);
    setPosts([]);
    setPage(0);
    setPageCount(null);
    if (!username) return;
    (async () => {
      try {
        const res = await api.byUsername(username);
        const pub = res.data as User;
        // full profile via legacy numeric-ID endpoint
        const full = await api.profile(String(pub.id)).catch(() => null);
        // own profile: legacy endpoint may lack badge/tier — take them from the session user
        const self = user && (pub.id === user.id || pub.publicId === user.publicId);
        const merged: ProfileShape = {
          ...(full?.data as ProfileShape),
          ...pub,
          id: pub.id,
          publicId: pub.publicId,
          ...(self ? { badge: user?.badge, effectiveTier: user?.effectiveTier } : {}),
        };
        // avatar can live under different keys on the different endpoints — keep the first that resolves
        if (!avatarOf(merged)) {
          const alt = avatarOf(pub) ?? avatarOf(full?.data) ?? avatarOf(user);
          if (alt) (merged as Record<string, unknown>).avatar_url = alt;
        }
        setProfile(merged);
        await loadPosts(String(pub.id), 1, true);
      } catch (e) {
        setError((e as ApiError).message ?? "failed to load profile");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadPosts = useCallback(async (numericId: string, p: number, replace: boolean) => {
    setLoadingPosts(true);
    try {
      const res = await api.userPosts(numericId, p, 20);
      const raw = res.data as unknown;
      const list = Array.isArray(raw)
        ? (raw as Post[])
        : ((raw as { posts?: Post[]; data?: Post[] })?.posts ?? (raw as { data?: Post[] })?.data ?? []);
      const meta = (res.meta ?? (raw as { meta?: Pagination })?.meta) as Pagination | undefined;
      setPageCount(meta?.pagination?.pageCount ?? null);
      setPage(p);
      setPosts((prev) => (replace ? list : [...prev, ...list]));
    } catch {
      // posts list is best-effort; profile header still renders
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p className="muted">Loading profile…</p>;

  const stats = profile.stats;
  const postCount = stats?.postCount ?? profile.postCount;
  // followers/following intentionally not displayed (platform hides them by design)
  const isSelf = !!user && (profile.id === user.id || profile.publicId === user.publicId);

  return (
    <div className="profile">
      <header className="card profile-header">
        <Avatar
          url={avatarOf(profile)}
          name={profile.display_name ?? profile.name ?? profile.username}
          size={96}
          user={profile}
          ringColor={ringColorOf(profile)}
        />
        <div className="profile-info">
          <div className="profile-names">
            <h2>
              {profile.display_name ?? profile.name ?? profile.username}
              <UserBadge badge={badgeOf(profile)} tier={tierOf(profile)} />
              {profile.verified && <span className="verified-check" title="Verified">✓</span>}
            </h2>
            <p className="muted">@{profile.username}</p>
          </div>
          {profile.bio && (
            <p className="bio">
              <RichText text={profile.bio} />
            </p>
          )}
          <div className="profile-meta muted small">
            {locationText(profile.location) && (
              <span><Icon name="map-marker-1" size={12} /> {locationText(profile.location)}</span>
            )}
            {profile.website && (
              <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer">
                <Icon name="share-1" size={12} /> {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.professionalInfo && <span>{profile.professionalInfo}</span>}
            {profile.createdAt && <span>joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
          </div>
          <p className="muted small profile-stats">{postCount ?? posts.length} posts</p>
        </div>
        {!isSelf && (
          <FollowButton
            publicId={profile.publicId}
            initialFollowing={profile.is_following ?? profile.isFollowing}
            onState={(following) => {
              setProfile((p) => (p ? { ...p, is_following: following } : p));
            }}
          />
        )}
      </header>
      <section className="profile-posts">
        {posts.map((p) => (
          <PostCard key={p.publicId ?? p.id} post={p} authorFallback={profile} />
        ))}
        {posts.length === 0 && !loadingPosts && <p className="muted">No posts yet.</p>}
        {(pageCount === null || page < pageCount) && posts.length > 0 && (
          <button
            className="load-more"
            disabled={loadingPosts}
            onClick={() => profile.id && loadPosts(String(profile.id), page + 1, false)}
          >
            {loadingPosts ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
      <p className="muted small">
        <Link to="/">← back to feed</Link>
      </p>
    </div>
  );
}
