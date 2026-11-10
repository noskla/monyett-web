// Shapes mirroring docs/openapi-prod.json. IDs stay opaque strings: v1 uses
// UUIDs, legacy endpoints use numeric IDs — never substitute one for the other.

export interface PaginationDetails {
  page?: number;
  pageSize?: number;
  total?: number;
  pageCount?: number;
}
export interface Pagination {
  pagination?: PaginationDetails;
}

export interface MediaFile {
  url?: string;
  thumbnail_url?: string;
  compressed_url?: string;
  mime?: string;
  status?: string;
}

export interface User {
  id?: number;
  publicId?: string;
  public_id?: string;
  username?: string;
  name?: string;
  display_name?: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  profile_picture?: MediaFile;
  verified?: boolean;
  badge?: string;
  effectiveTier?: string;
  website?: string;
  professionalInfo?: string;
  createdAt?: string;
  location?: { city?: string; country?: string; address?: string; area?: string; zip?: string } | null;
  avatar_ring_color?: string;
  avatar_ring_colors?: string[];
  avatarRingColor?: { hexCode?: string; colors?: string[] };
  is_following?: boolean;
  isFollowing?: boolean;
  is_follower?: boolean;
  has_stories?: boolean;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
}

export interface Post {
  id?: number;
  publicId?: string;
  title?: string;
  description?: string;
  post_type?: string;
  createdAt?: string;
  publishedAt?: string;
  location?: { city?: string; country?: string; address?: string; area?: string } | null;
  posted_by?: User;
  media?: MediaFile[];
  likes_count?: number;
  is_liked?: boolean;
  comments_count?: number;
  repost_count?: number;
  view_count?: number;
  is_reposted?: boolean;
  is_repost?: boolean;
  repost_caption?: string;
}

export interface TimelineGroup {
  date_key?: string;
  posts: Post[];
}

export interface FeedResponse {
  timeline: TimelineGroup[];
  meta?: Pagination;
  message?: string;
}

export interface Comment {
  public_id?: string;
  post_id?: string;
  parent_comment_id?: string | null;
  comment?: string;
  created_at?: string;
  commented_by?: User;
  likes_count?: number;
  replies_count?: number;
  is_liked?: boolean;
  pinned?: boolean;
}

export interface CommentsPage {
  comments: Comment[];
  meta?: Pagination;
}

export interface Envelope<T> {
  data: T;
  meta?: unknown;
}

export interface ApiErrorBody {
  error: { status: number; message: string; code?: string };
}

export interface StoryItem {
  id?: number;
  publicId?: string;
  description?: string;
  media?: MediaFile[];
  is_viewed?: boolean;
  created_at?: string;
}

export interface StoryUser {
  id?: number;
  publicId?: string;
  username?: string;
  name?: string;
  profile_picture?: MediaFile;
  avatar_url?: string;
  has_unseen?: boolean;
  ring_color?: string;
  ring_colors?: string[];
  badge?: string;
  stories?: StoryItem[];
}

export interface StoriesFeed {
  users: StoryUser[];
  current_user?: StoryUser;
  meta?: Pagination;
}

export interface Notification {
  id?: number | string;
  type?: string;
  message?: string;
  is_seen?: boolean;
  created_at?: string;
  createdAt?: string;
  actor?: User;
  post?: Post;
}

export interface Features {
  createPost: boolean;
  notifications: boolean;
  stories: boolean;
  discover: boolean;
}
