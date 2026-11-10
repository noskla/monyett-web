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
  return u && typeof u === "object" ? (u as User) : null;
}

function bootstrapSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const res = await api.session();
        return { user: normalizeUser(res.data), gate: null };
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
