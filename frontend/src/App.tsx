import React, { Suspense } from "react";
import { SWRConfig } from "swr";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { fetchJson } from "./api";
import { ThemeProvider } from "./theme";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";

const Dashboard = React.lazy(() => import("./components/Dashboard"));
const Login = React.lazy(() => import("./components/Login"));
const Settings = React.lazy(() => import("./components/Settings"));
const NotFound = React.lazy(() => import("./components/NotFound"));

function RouteLoadingFallback() {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
      <CircularProgress size={28} />
    </Box>
  );
}

function AnimatedRoutes() {
  const { authed } = useAuth();
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
    </Suspense>
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
