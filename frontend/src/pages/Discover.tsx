import { useCallback, useState } from "react";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import Icon from "../components/Icon";
import type { Post } from "../types";

type Scope = "GLOBAL" | "COUNTRY" | "CITY" | "NEARBY";

/** Discover feed. The API requires startScope OR lat+lng+radius (else 400):
 *  - GLOBAL/COUNTRY/CITY -> area feed, {items, next_cursor}
 *  - NEARBY -> radius feed, {posts, next_cursor}
 *  Both response shapes are handled. */
export default function Discover() {
  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [radius, setRadius] = useState(25);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [membersOnly, setMembersOnly] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildParams(cur: string | null): Record<string, string | number | boolean | undefined> {
    const base: Record<string, string | number | boolean | undefined> = { limit: 20, cursor: cur ?? undefined, members_only: membersOnly || undefined };
    if (scope === "NEARBY") {
      const p: Record<string, string | number | boolean | undefined> = { ...base, lat: coords?.lat, lng: coords?.lng, radius };
      return p;
    }
    const p: Record<string, string | number | boolean | undefined> = {
      ...base,
      startScope: scope,
      ...(scope === "CITY" ? { city: city || undefined, country: country || undefined } : {}),
      ...(scope === "COUNTRY" ? { country: country || undefined } : {}),
      ...(scope === "GLOBAL" ? { includeUnlocated: true } : {}),
    };
    return p;
  }

  const load = useCallback(
    async (cur: string | null, replace: boolean) => {
      const params = buildParams(cur);
      // client-side guard mirroring the API contract: startScope or lat+lng+radius required
      const hasScope = params.startScope != null;
      const hasRadius = params.lat != null && params.lng != null && params.radius != null;
      if (!hasScope && !hasRadius) {
        setError(scope === "NEARBY" ? "Location needed for Nearby — use “Use my location”." : "Enter a city/country or switch to Nearby.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.discover(params);
        const raw = res.data as Record<string, unknown>;
        const items = (raw?.items as Record<string, unknown>[] | undefined) ?? [];
        const list: Post[] = items.length
          ? items.map((it) => ((it.post ?? it) as Post))
          : ((raw?.posts as Post[] | undefined) ?? (Array.isArray(raw) ? (raw as Post[]) : []));
        setCursor((raw?.next_cursor as string | null) ?? null);
        setPosts((prev) => (replace ? list : [...prev, ...list]));
      } catch (e) {
        setError((e as ApiError).message ?? "failed to load discover");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, city, country, radius, coords, membersOnly],
  );

  function useMyLocation() {
    setError(null);
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Location permission denied — pick a scope instead."),
    );
  }

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h2><Icon name="compass" size={18} /> Discover</h2>
      </div>
      <div className="discover-controls card">
        <div className="compose-row">
          <select value={scope} onChange={(e) => { setScope(e.target.value as Scope); setPosts([]); setCursor(null); }}>
            <option value="GLOBAL">Global</option>
            <option value="COUNTRY">Country</option>
            <option value="CITY">City</option>
            <option value="NEARBY">Nearby (radius)</option>
          </select>
          {(scope === "CITY" || scope === "COUNTRY") && (
            <>
              {scope === "CITY" && <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />}
              <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </>
          )}
          {scope === "NEARBY" && (
            <>
              <button className="link-btn" onClick={useMyLocation}>
                <Icon name="map-marker" size={14} /> {coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "Use my location"}
              </button>
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
            </>
          )}
          <label className="muted small">
            <input type="checkbox" checked={membersOnly} onChange={(e) => setMembersOnly(e.target.checked)} /> members only
          </label>
          <button onClick={() => load(null, true)} disabled={loading}>{loading ? "…" : "Search"}</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {posts.map((p) => (
        <PostCard key={p.publicId ?? p.id} post={p} />
      ))}
      {!loading && posts.length === 0 && !error && <p className="muted">Pick a scope and search.</p>}
      {cursor && (
        <button className="load-more" onClick={() => load(cursor, false)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
