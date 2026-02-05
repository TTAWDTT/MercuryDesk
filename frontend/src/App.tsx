import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Settings from "./components/Settings";
import { fetchJson, getToken, setToken } from "./api";
import { ThemeProvider } from "./theme";

export default function App() {
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  function logout() {
    setToken(null);
    setAuthed(false);
  }

  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          fetcher: (key: string) => fetchJson(key),
          shouldRetryOnError: false,
          revalidateOnFocus: false
        }}
      >
        <BrowserRouter>
          <Routes>
            {!authed ? (
              <Route path="*" element={<Login onAuthed={() => setAuthed(true)} />} />
            ) : (
              <>
                <Route path="/" element={<Dashboard onLogout={logout} />} />
                <Route path="/settings" element={<Settings onLogout={logout} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      </SWRConfig>
    </ThemeProvider>
  );
}