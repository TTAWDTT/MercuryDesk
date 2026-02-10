import React from "react";
import { SWRConfig } from "swr";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Settings from "./components/Settings";
import NotFound from "./components/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { fetchJson } from "./api";
import { ThemeProvider } from "./theme";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";

function AnimatedRoutes() {
  const { authed } = useAuth();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {!authed ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
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
                <AnimatedRoutes />
              </BrowserRouter>
            </SWRConfig>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
