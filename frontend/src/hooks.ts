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

export function useSession(): SessionState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<"gate" | "no_session" | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const res = await api.session();
        if (mounted.current) {
          setUser(res.data);
          setGate(null);
        }
      } catch (e) {
        if (mounted.current) {
          const err = e as ApiError;
          setGate(err.code === "gate" ? "gate" : "no_session");
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
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
