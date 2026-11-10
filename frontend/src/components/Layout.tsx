import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../hooks";

export default function Layout() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

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
          <Link to={`/u/${user.username}`} className="muted">
            @{user.username}
          </Link>
        )}
        <button onClick={onLogout}>Log out</button>
      </header>
      <Outlet />
    </div>
  );
}
