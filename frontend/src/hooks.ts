import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import type { Envelope, User } from "./types";

export interface ApiState<T> {
  data: T | null;
  meta: unknown;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/** Generic query hook: fetch on mount/deps change, manual refetch only (no polling). */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, meta: null, loading: true, error: null, refetch: () => {} });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fn();
      setState({ data: res, meta: null, loading: false, error: null, refetch: run });
    } catch (e) {
      setState({ data: null, meta: null, loading: false, error: e as ApiError, refetch: run });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return state;
}

/** Server-state hook for /m/* envelope responses. */
export function useApi<T>(fn: () => Promise<Envelope<T>>, deps: unknown[] = []): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, meta: null, loading: true, error: null, refetch: () => {} });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fn();
      setState({ data: res.data, meta: res.meta ?? null, loading: false, error: null, refetch: run });
    } catch (e) {
      setState({ data: null, meta: null, loading: false, error: e as ApiError, refetch: run });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return state;
}

export interface SessionState {
  user: User | null;
  loading: boolean;
  /** "gate" = passcode required, "no_session" = need login, null = signed in */
  gate: "gate" | "no_session" | null;
  logout: () => Promise<void>;
}

// One shared bootstrap per page load: App and Layout both call useSession(),
// so without this every mount fires its own /auth/session request.
let sessionPromise: Promise<{ user: User | null; gate: "gate" | "no_session" | null }> | null = null;

/** Unwrap the session user if the API nests it (e.g. {user: {...}} / {profile: {...}}). */
export function normalizeUser(data: any): User | null {
  let u = data;
  if (u && typeof u === "object" && !u.username && !u.name && !u.id) {
    if (u.user && typeof u.user === "object") u = u.user;
    else if (u.profile && typeof u.profile === "object") u = u.profile;
  }
  if (!u || typeof u !== "object") return null;
  if (!u.username && !u.name && !u.id && !u.email) return null;
  return u as User;
}

function bootstrapSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const res = await api.session();
        let u = normalizeUser(res.data);
        // the session user is thin — full profile (badge, avatar ring colors,
        // tier, …) comes from the legacy numeric-ID profile endpoint
        if (u?.id) {
          try {
            const prof = await api.profile(String(u.id));
            const p = normalizeUser(prof.data) ?? (prof.data as Record<string, unknown> | null);
            if (p) {
              const merged: Record<string, any> = { ...p, ...u };
              for (const k of ["badge", "avatar_ring_color", "avatar_ring_colors", "avatarRingColor", "effectiveTier", "verified", "bio", "website", "location", "professionalInfo", "createdAt"]) {
                if (merged[k] == null && (p as Record<string, any>)[k] != null) merged[k] = (p as Record<string, any>)[k];
              }
              u = merged as User;
            }
          } catch {
            /* profile enrichment is best-effort */
          }
        }
        return { user: u, gate: null };
      } catch (e) {
        const err = e as ApiError;
        return { user: null, gate: err.code === "gate" ? ("gate" as const) : ("no_session" as const) };
      }
    })();
  }
  return sessionPromise;
}

/** Test-only: forget the cached bootstrap so a fresh one runs (browser code
 *  reloads the page instead, which achieves the same). */
export function __resetSessionForTests() {
  sessionPromise = null;
}

/** Test-only: run the bootstrap and return its result. */
export function __probeSession() {
  return bootstrapSession();
}

export function useSession(): SessionState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<"gate" | "no_session" | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    bootstrapSession().then((res) => {
      if (mounted.current) {
        setUser(res.user);
        setGate(res.gate);
        setLoading(false);
      }
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setGate("no_session");
  }, []);

  return { user, loading, gate, logout };
}
