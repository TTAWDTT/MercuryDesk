import React, { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Settings from "./components/Settings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { fetchJson, getToken, setToken } from "./api";
import { ThemeProvider } from "./theme";

function AnimatedRoutes({ authed, setAuthed, logout }: { authed: boolean, setAuthed: (v: boolean) => void, logout: () => void }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
    </AnimatePresence>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setAuthed(false);
    };
    window.addEventListener("mercurydesk:unauthorized", onUnauthorized);
    return () => window.removeEventListener("mercurydesk:unauthorized", onUnauthorized);
  }, []);

  function logout() {
    setToken(null);
    setAuthed(false);
  }

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <SWRConfig
          value={{
            fetcher: (key: string) => fetchJson(key),
            shouldRetryOnError: true,
            errorRetryCount: 3,
            errorRetryInterval: 2000,
            revalidateOnFocus: true,
            focusThrottleInterval: 10000,
          }}
        >
          <BrowserRouter>
            <AnimatedRoutes authed={authed} setAuthed={setAuthed} logout={logout} />
          </BrowserRouter>
        </SWRConfig>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
