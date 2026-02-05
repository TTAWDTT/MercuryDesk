import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { ThemeProvider, CssBaseline } from "@mui/material";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { fetchJson, getToken, setToken } from "./api";
import theme from "./theme";

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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SWRConfig
        value={{
          fetcher: (key: string) => fetchJson(key),
          shouldRetryOnError: false,
          revalidateOnFocus: false
        }}
      >
        {!authed ? (
          <Login onAuthed={() => setAuthed(true)} />
        ) : (
          <Dashboard onLogout={logout} />
        )}
      </SWRConfig>
    </ThemeProvider>
  );
}