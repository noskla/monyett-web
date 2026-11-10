import { Link, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../hooks";

export default function Layout() {
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
        <Link to="/" className="brand">
          <strong>monyett-web</strong>
        </Link>
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
