import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import PostCard from "../components/PostCard";
import Icon from "../components/Icon";
import { COUNTRIES, TOP_CITIES } from "../data/geo";
import type { Post } from "../types";

type Scope = "GLOBAL" | "COUNTRY" | "CITY" | "NEARBY";

const LS_KEY = "monnett.discover";

function loadSaved(): Partial<{ scope: Scope; country: string; city: string; radius: number }> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Discover feed. Requires startScope OR lat+lng+radius (API 400s otherwise).
 *  Remembers the last chosen scope/country/city and auto-loads on mount. */
export default function Discover() {
  const saved = useMemo(loadSaved, []);
  const [scope, setScope] = useState<Scope>(saved.scope ?? "GLOBAL");
  const [country, setCountry] = useState(saved.country ?? "");
  const [countryFilter, setCountryFilter] = useState("");
  const [city, setCity] = useState(saved.city ?? "");
  const [cityFilter, setCityFilter] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [radius, setRadius] = useState(saved.radius ?? 25);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [membersOnly, setMembersOnly] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const countries = useMemo(
    () => COUNTRIES.filter((c) => c.toLowerCase().includes(countryFilter.toLowerCase())),
    [countryFilter],
  );
  const cities = useMemo(() => {
    const list = TOP_CITIES[country] ?? [];
    return list.filter((c) => c.toLowerCase().includes(cityFilter.toLowerCase()));
  }, [country, cityFilter]);

  const effectiveCity = customCity.trim() || city;

  function buildParams(cur: string | null): Record<string, string | number | boolean | undefined> {
    const base: Record<string, string | number | boolean | undefined> = {
      limit: 20,
      cursor: cur ?? undefined,
      members_only: membersOnly || undefined,
    };
    if (scope === "NEARBY") {
      return { ...base, lat: coords?.lat, lng: coords?.lng, radius };
    }
    return {
      ...base,
      startScope: scope,
      ...(scope === "CITY" ? { city: effectiveCity || undefined, country: country || undefined } : {}),
      ...(scope === "COUNTRY" ? { country: country || undefined } : {}),
      ...(scope === "GLOBAL" ? { includeUnlocated: true } : {}),
    };
  }

  // per-scope validity — mirrors the API contract (CITY needs city AND country,
  // COUNTRY needs country, NEARBY needs lat+lng+radius, GLOBAL always ok)
  const paramsValid = useMemo(() => {
    if (scope === "GLOBAL") return true;
    if (scope === "NEARBY") return coords !== null && radius > 0;
    if (scope === "COUNTRY") return !!country;
    return !!country && !!effectiveCity; // CITY
  }, [scope, coords, radius, country, effectiveCity]);

  const validityHint = !paramsValid
    ? scope === "NEARBY"
      ? "Location needed for Nearby — use “Use my location”."
      : scope === "CITY"
        ? "City scope needs a country and a city."
        : "Choose a country first."
    : null;

  const load = useCallback(
    async (cur: string | null, replace: boolean) => {
      const params = buildParams(cur);
      const hasScope = params.startScope != null;
      const hasRadius = params.lat != null && params.lng != null && params.radius != null;
      if (!hasScope && !hasRadius) {
        setError(scope === "NEARBY" ? "Location needed for Nearby — use “Use my location”." : "Pick a country (and city) or switch to Nearby.");
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
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
    [scope, country, effectiveCity, radius, coords, membersOnly],
  );

  // persist choices (incl. effective/custom city) and auto-search once the
  // current scope's values are complete — debounced so we wait until the user
  // finishes typing/picking instead of firing a 400 mid-entry
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ scope, country, city: effectiveCity, radius }));
    } catch {
      /* ignore */
    }
    if (!paramsValid) {
      setSearched(false);
      return;
    }
    const t = setTimeout(() => load(null, true), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, country, effectiveCity, radius, coords, membersOnly, paramsValid]);

  function onScopeChange(s: Scope) {
    setScope(s);
    setPosts([]);
    setCursor(null);
    setSearched(false);
  }

  function useMyLocation() {
    setError(null);
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Location permission denied — pick another scope."),
    );
  }

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h2><Icon name="discover" size={18} /> Discover</h2>
      </div>
      <div className="discover-controls card">
        <div className="compose-row">
          <select value={scope} onChange={(e) => onScopeChange(e.target.value as Scope)}>
            <option value="GLOBAL">Global</option>
            <option value="COUNTRY">Country</option>
            <option value="CITY">City</option>
            <option value="NEARBY">Nearby (radius)</option>
          </select>
          {(scope === "CITY" || scope === "COUNTRY") && (
            <div className="combo" title="Country">
              <span className="combo-icon"><Icon name="search-1" size={13} /></span>
              <input
                placeholder="Search countries…"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              />
              <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); setCustomCity(""); }}>
                <option value="">Country…</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          {scope === "CITY" && country && (
            <div className="geo-picker">
              {cities.length > 0 && (
                <div className="combo" title="City">
                  <span className="combo-icon"><Icon name="search-1" size={13} /></span>
                  <input
                    placeholder="Search top cities…"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                  />
                  <select value={city} onChange={(e) => { setCity(e.target.value); setCustomCity(""); }}>
                    <option value="">Top cities…</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="combo combo-custom" title="Custom city">
                <span className="combo-icon"><Icon name="map-marker-1" size={13} /></span>
                <input
                  placeholder="custom city name"
                  value={customCity}
                  onChange={(e) => { setCustomCity(e.target.value); setCity(""); }}
                />
              </div>
            </div>
          )}
          {scope === "NEARBY" && (
            <>
              <button className="link-btn" onClick={useMyLocation}>
                <Icon name="map-marker-1" size={14} /> {coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "Use my location"}
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
      {validityHint && !loading && <p className="muted">{validityHint}</p>}
      {posts.map((p) => (
        <PostCard key={p.publicId ?? p.id} post={p} />
      ))}
      {!loading && posts.length === 0 && !error && searched && <p className="muted">No posts found for this scope.</p>}
      {cursor && (
        <button className="load-more" onClick={() => load(cursor, false)} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
