import { Navigate, Route, Routes } from "react-router-dom";
import Gate from "./pages/Gate";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Layout from "./components/Layout";
import { useSession } from "./hooks";

export default function App() {
  const { user, loading, gate } = useSession();

  if (loading) return <div className="center">loading…</div>;
  if (gate === "gate") return <Navigate to="/gate" replace />;

  return (
    <Routes>
      <Route path="/gate" element={user ? <Navigate to="/" replace /> : <Gate />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={user ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route path="/" element={<Feed />} />
        <Route path="/post/:publicId" element={<PostDetail />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/search" element={<Search />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
