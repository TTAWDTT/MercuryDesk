import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken } from '../api';

interface AuthContextType {
  authed: boolean;
  setAuthed: (v: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authed: false,
  setAuthed: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setAuthed(false);
    };
    window.addEventListener('mercurydesk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('mercurydesk:unauthorized', onUnauthorized);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authed, setAuthed, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
