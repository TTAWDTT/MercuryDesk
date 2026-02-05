import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { getToken, setToken } from "./api";

export default function App() {
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  function logout() {
    setToken(null);
    setAuthed(false);
  }

  if (!authed) {
    return <Login onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div>
      <div style={{ padding: 10, borderBottom: "1px solid color-mix(in oklab, CanvasText 15%, Canvas)" }} className="row space-between">
        <div style={{ fontWeight: 700 }}>MercuryDesk</div>
        <button className="btn" onClick={logout}>
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

