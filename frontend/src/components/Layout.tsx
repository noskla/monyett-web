import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../hooks";
import Icon from "./Icon";
import type { Features } from "../types";

export default function Layout() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [features, setFeatures] = useState<Features | null>(null);
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    api.features().then(setFeatures).catch(() => setFeatures(null));
  }, []);

  useEffect(() => {
    if (!features?.notifications) return;
    api
      .notificationCount()
      .then((res) => {
        const c = res.data as Record<string, unknown>;
        const n = c?.count ?? c?.unread ?? c?.unreadCount ?? (typeof res.data === "number" ? res.data : null);
        if (typeof n === "number") setUnread(n);
      })
      .catch(() => {});
  }, [features?.notifications]);

  async function onLogout() {
    await logout();
    navigate("/login");
    window.location.reload();
  }

  function onSearch(ev: React.FormEvent) {
    ev.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="container">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="Monnett" className="brand-logo" />
        </Link>
        {user?.username && (
          <Link to={`/u/${user.username}`} className="muted topbar-user">
            @{user.username}
          </Link>
        )}
        <button onClick={onLogout}><Icon name="exit" size={14} /> Log out</button>
      </header>
      <div className="layout-grid">
        <main className="main-col">
          <Outlet />
        </main>
        <aside className="sidebar">
          <nav className="side-nav card">
            <Link to="/"><Icon name="home" size={16} /> Feed</Link>
            {features?.discover && <Link to="/discover"><Icon name="compass" size={16} /> Discover</Link>}
            {features?.notifications && (
              <Link to="/notifications">
                <Icon name="bell" size={16} /> Notifications
                {unread !== null && unread > 0 && <span className="unread-pill">{unread}</span>}
              </Link>
            )}
            <form className="side-search" onSubmit={onSearch}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users or #tag" />
              <button type="submit" aria-label="search"><Icon name="search" size={15} /></button>
            </form>
            {features?.createPost && (
              <button className="compose-btn" onClick={() => navigate("/compose")}>
                <Icon name="plus" size={15} /> New post
              </button>
            )}
          </nav>
          <p className="muted small side-note">
            unofficial personal client · API unsupported, may break without notice
          </p>
        </aside>
      </div>
    </div>
  );
}
