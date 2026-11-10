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

  // NOTE: never short-circuit to <Navigate> before <Routes> — that would
  // unmount the very page we redirect to (e.g. the gate page itself).
  const needsGate = gate === "gate";

  return (
    <Routes>
      <Route path="/gate" element={user && !needsGate ? <Navigate to="/" replace /> : <Gate />} />
      <Route
        path="/login"
        element={needsGate ? <Navigate to="/gate" replace /> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          needsGate ? <Navigate to="/gate" replace /> : user ? <Layout /> : <Navigate to="/login" replace />
        }
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
