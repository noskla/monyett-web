// Typed fetch wrapper. All Monnett traffic goes through the same-origin BFF:
// /auth/* for session, /m/* for allowlisted upstream passthrough.
// Tokens never touch JS — they live in the HttpOnly encrypted cookie.

import type { ApiErrorBody, Envelope } from "./types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | Envelope<T>
    | ApiErrorBody
    | null;
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code, err?.message ?? res.statusText);
  }
  return body as T;
}

function qs(params?: Record<string, string | number | undefined>): string {
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

  mGet: <T>(path: string, params?: Record<string, string | number | undefined>) =>
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
};
