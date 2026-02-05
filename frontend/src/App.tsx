import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { fetchJson, getToken, setToken } from "./api";

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
    <SWRConfig
      value={{
        fetcher: (key: string) => fetchJson(key),
        shouldRetryOnError: false,
        revalidateOnFocus: false
      }}
    >
      <Dashboard onLogout={logout} />
    </SWRConfig>
  );
}
