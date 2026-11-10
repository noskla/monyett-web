import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";

/** Passcode gate page. The backend sets the HttpOnly gate cookie; the SPA
 *  never stores the passcode itself. */
export default function Gate() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.gate(passcode);
      navigate("/");
      window.location.reload(); // re-run session bootstrap with the gate cookie
    } catch (e) {
      setError((e as ApiError).message ?? "wrong passcode");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card gate-form" onSubmit={submit}>
        <h1>monyett-web</h1>
        <p className="muted">personal client — passcode required</p>
        <input
          type="password"
          placeholder="passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
        />
        <button disabled={busy || !passcode}>{busy ? "…" : "Unlock"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
