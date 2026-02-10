import React, { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import { ApiError, login, register, setToken } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { LoginPanel } from "./login/LoginPanel";

export default function Login() {
  const theme = useTheme();
  const { setAuthed } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "demo@example.com" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "password123" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return isValidEmail && password.length >= 8 && !busy;
  }, [email, password, busy]);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      const token = await login(email, password);
      setToken(token.access_token);
      setAuthed(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("邮箱或密码不正确");
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterAndLogin() {
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      await onLogin();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError("该邮箱已注册");
      else setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit) onLogin();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Container maxWidth="xs" sx={{ zIndex: 1 }}>
        <LoginPanel
          email={email}
          password={password}
          busy={busy}
          canSubmit={canSubmit}
          error={error}
          shadowColor={theme.palette.text.primary}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          onRegisterAndLogin={onRegisterAndLogin}
        />

        <Box textAlign="center" mt={4}>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.5, letterSpacing: "0.02em" }}>
            © 2026 MercuryDesk
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

