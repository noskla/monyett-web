// Typed fetch wrapper. All Monnett traffic goes through the same-origin BFF:
// /auth/* for session, /m/* for allowlisted upstream passthrough.
// Tokens never touch JS — they live in the HttpOnly encrypted cookie.

import type { ApiErrorBody, Envelope } from "./types";
import { notifyRateLimit } from "./ratelimit";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitedError extends ApiError {
  constructor(public retryAfterSec: number) {
    super(429, "rate_limited", "rate limit exceeded");
    this.name = "RateLimitedError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      // only set JSON content-type for string bodies; FormData sets its own multipart boundary
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | Envelope<T>
    | ApiErrorBody
    | null;
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 60;
    notifyRateLimit(retryAfter);
    throw new RateLimitedError(retryAfter);
  }
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code, err?.message ?? res.statusText);
  }
  return body as T;
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  backendHealth: () => request<{ ok: boolean; environment: string }>("/api/healthz"),
  upstreamHealth: () => request<{ ok: boolean; data?: unknown; error?: string }>("/api/upstream-health"),
  gate: (passcode: string) =>
    request<{ ok: boolean }>("/auth/gate", { method: "POST", body: JSON.stringify({ passcode }) }),
  login: (email: string, password: string) =>
    request<Envelope<unknown>>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  session: () => request<Envelope<import("./types").User>>("/auth/session"),

  mGet: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<Envelope<T>>(`/m/${path}${qs(params)}`),
  mPost: <T>(path: string, body?: unknown) =>
    request<Envelope<T>>(`/m/${path}`, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  mDelete: <T>(path: string) => request<Envelope<T>>(`/m/${path}`, { method: "DELETE" }),

  // Phase 1 endpoints (allowlisted on the backend; paths without the /api prefix)
  feed: (page: number, limit = 20) =>
    api.mGet<import("./types").FeedResponse>("v1/app/feed", { page, limit }),
  post: (publicId: string) => api.mGet<import("./types").Post>(`v1/app/post/${publicId}`),
  comments: (postId: string, page: number, limit = 20) =>
    api.mGet<import("./types").CommentsPage>(`v1/app/posts/${postId}/comments`, { page, limit }),
  byUsername: (username: string) => api.mGet<import("./types").User>(`v1/app/user/by-username/${encodeURIComponent(username)}`),
  profile: (numericId: string) => api.mGet<import("./types").User>(`profile/${numericId}`),
  userPosts: (numericId: string, page: number, size = 20) =>
    api.mGet<unknown>(`users/${numericId}/posts`, { page, pagination_size: size }),

  // Phase 2 writes — idempotent v1 POST/DELETE pairs only (never legacy toggles)
  likePost: (postId: string) =>
    api.mPost<{ liked: boolean; likeCount: number }>(`v1/app/posts/${postId}/like`),
  unlikePost: (postId: string) =>
    api.mDelete<{ liked: boolean; likeCount: number }>(`v1/app/posts/${postId}/like`),
  createComment: (postId: string, comment: string, parentCommentId?: string) =>
    api.mPost<import("./types").Comment>("v1/app/comments", {
      post_id: postId,
      comment,
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    }),
  deleteComment: (commentId: string) => api.mDelete<unknown>(`v1/app/comments/${commentId}`),
  replies: (commentId: string, page: number, limit = 20) =>
    api.mGet<{ replies: import("./types").Comment[]; meta?: import("./types").Pagination }>(`v1/app/comments/${commentId}/replies`, { page, limit }),
  follow: (publicId: string) =>
    api.mPost<{ following: boolean; followerCount: number; followingCount: number }>(`v1/app/users/${publicId}/follow`),
  unfollow: (publicId: string) =>
    api.mDelete<{ following: boolean; followerCount: number; followingCount: number }>(`v1/app/users/${publicId}/follow`),
  searchUsers: (keyword: string, page = 1, pageSize = 20) =>
    api.mGet<unknown>("search", { keyword, page, pageSize, type: "user" }),
  searchTag: (tag: string, page = 1, limit = 20) =>
    api.mGet<{ posts: import("./types").Post[]; meta?: import("./types").Pagination }>("v1/app/search/posts-by-tag", { tag, page, limit }),

  // Phase 3 (feature-flagged on the backend)
  features: () => request<import("./types").Features>("/api/features"),
  createPost: (body: {
    post_type?: "POST" | "STORY";
    description?: string;
    title?: string;
    share_with?: string;
    media_count?: number;
    location?: { latitude?: number; longitude?: number; city?: string; country?: string; address?: string; zip?: string; area?: string };
  }) => api.mPost<string>("v1/app/post/create", { post_type: "POST", ...body }),
  uploadMedia: (postId: string, file: File, mediaIndex = 0) => {
    const fd = new FormData();
    fd.append("postId", postId);
    fd.append("mediaIndex", String(mediaIndex));
    fd.append("file", file);
    return request<Envelope<unknown>>(`/m/v1/app/media/upload`, { method: "POST", body: fd });
  },
  notifications: (page = 1, size = 20, filter?: string) =>
    api.mGet<unknown>("notification", { page, pagination_size: size, ...(filter ? { filter } : {}) }),
  notificationCount: () => api.mGet<unknown>("notification-count"),
  markNotificationSeen: (id: string | number) => api.mPost<unknown>(`notification/seen/${id}`),
  markAllNotificationsSeen: () => api.mPost<unknown>("notification/mark-all-seen"),
  stories: (page = 1, limit = 20) => api.mGet<import("./types").StoriesFeed>("v1/app/stories", { page, limit }),
  userStories: (userId: string) => api.mGet<unknown>(`v1/app/users/${userId}/stories`),
  storyViewers: (publicId: string, page = 1, limit = 20) =>
    api.mGet<unknown>(`v1/app/stories/${publicId}/viewers`, { page, limit }),
  userStoryMonths: (userId: string) => api.mGet<unknown>(`v1/app/users/${userId}/stories/months`),
  userStoryMonth: (userId: string, month: string) => api.mGet<unknown>(`v1/app/users/${userId}/stories/months/${month}`),
  deletePost: (publicId: string) => api.mDelete<unknown>(`v1/app/post/${publicId}`),
  viewStory: (publicId: string, watchedSeconds = 1) =>
    request<Envelope<unknown>>(`/m/v1/app/stories/${publicId}/view?watchedSeconds=${watchedSeconds}`, { method: "POST" }),
  discover: (params: {
    limit?: number;
    cursor?: string;
    startScope?: "GLOBAL" | "COUNTRY" | "CITY";
    city?: string;
    country?: string;
    area?: string;
    includeUnlocated?: boolean;
    lat?: number;
    lng?: number;
    radius?: number;
    members_only?: boolean;
  }) => api.mGet<unknown>("v1/app/feed/discover", params),
};
