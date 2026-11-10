import { Navigate, Route, Routes } from "react-router-dom";
import Gate from "./pages/Gate";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { useSession } from "./hooks";

export default function App() {
  const { user, loading, gate } = useSession();

  if (loading) return <div className="center">loading…</div>;
  if (gate === "gate") return <Navigate to="/gate" replace />;

  return (
    <Routes>
      <Route path="/gate" element={user ? <Navigate to="/" replace /> : <Gate />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
