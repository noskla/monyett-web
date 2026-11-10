import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useSession } from "../hooks";
import Icon from "./Icon";
import NotificationsPanel from "./NotificationsPanel";
import type { Features } from "../types";

export default function Layout() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [features, setFeatures] = useState<Features | null>(null);

  useEffect(() => {
    api.features().then(setFeatures).catch(() => setFeatures(null));
  }, []);

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
        <form className="topbar-search" onSubmit={onSearch}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users or #tag" />
        </form>
        {user?.username && (
          <Link to={`/u/${user.username}`} className="muted topbar-user">
            @{user.username}
          </Link>
        )}
        {features?.createPost && (
          <button className="icon-btn" onClick={() => navigate("/compose")} title="New post" aria-label="New post">
            <Icon name="plus" size={17} />
          </button>
        )}
        <button className="icon-btn" onClick={onLogout} title="Log out" aria-label="Log out">
          <Icon name="exit" size={17} />
        </button>
      </header>
      <div className="layout-grid">
        <main className="main-col">
          <Outlet />
        </main>
        <aside className="sidebar">
          <nav className="side-nav card">
            <Link to="/"><Icon name="home-2" size={16} /> Feed</Link>
            {features?.discover && <Link to="/discover"><Icon name="discover" size={16} /> Discover</Link>}
          </nav>
          {features?.notifications && <NotificationsPanel />}
          <p className="muted small side-note">
            unofficial personal client · API unsupported, may break without notice
          </p>
        </aside>
      </div>
    </div>
  );
}
