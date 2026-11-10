import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useQuery } from "../hooks";

/** Login page with upstream health banner: the form is disabled while the
 *  Monnett environment reports down (PLAN.md §4 Phase 0). */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const health = useQuery(() => api.upstreamHealth());

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      navigate("/");
      window.location.reload();
    } catch (e) {
      setError((e as ApiError).message ?? "login failed");
    } finally {
      setBusy(false);
    }
  }

  const upstreamDown = health.data !== null && health.data.ok === false;

  return (
    <div className="center">
      {upstreamDown && (
        <div className="banner error">Monnett API is not reachable ({health.data?.error}) — login disabled.</div>
      )}
      <form className="card login-form" onSubmit={submit}>
        <h1>monyett-web</h1>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button disabled={busy || upstreamDown}>{busy ? "…" : "Sign in"}</button>
        {error && <p className="error">{error}</p>}
        <p className="muted small">
          unofficial personal client · API unsupported, may break without notice
        </p>
      </form>
    </div>
  );
}
