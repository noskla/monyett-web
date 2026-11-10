import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks";

/** Phase 0 shell: proves the session works. Feed UI lands in Phase 1. */
export default function Home() {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
    window.location.reload();
  }

  return (
    <div className="container">
      <header className="topbar">
        <strong>monyett-web</strong>
        <span className="muted">signed in as {user?.username ?? user?.name ?? "…"}</span>
        <button onClick={onLogout}>Log out</button>
      </header>
      <p className="muted">Phase 0 complete — session works. Feed, post detail and profiles come in Phase 1.</p>
    </div>
  );
}
