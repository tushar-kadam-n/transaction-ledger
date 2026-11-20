import { useEffect, useRef, useState, type ReactNode } from "react";
import { getAccessToken, login as loginRequest, logout as logoutRequest, refreshAccessToken, setAccessToken, setAuthenticationFailureHandler } from "./api";
import type { AuthTokenResponse } from "./api";
import { AuthContext } from "./auth-context";

function userFromEmail(email: string) { return { email }; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const mounted = useRef(true);

  function applyToken(response: AuthTokenResponse, email?: string) {
    setAccessToken(response.access_token);
    if (mounted.current) {
      setToken(response.access_token);
      if (email) setUser(userFromEmail(email));
    }
  }

  async function refreshSession() {
    const response = await refreshAccessToken();
    applyToken(response);
  }

  useEffect(() => {
    mounted.current = true;
    setAuthenticationFailureHandler(() => {
      setAccessToken(null);
      if (mounted.current) { setToken(null); setUser(null); }
    });
    refreshAccessToken().then((response) => {
      setAccessToken(response.access_token);
      if (mounted.current) setToken(response.access_token);
    }).catch(() => {
      setAccessToken(null);
      if (mounted.current) { setToken(null); setUser(null); }
    }).finally(() => { if (mounted.current) setIsRestoring(false); });
    return () => { mounted.current = false; };
  }, []);

  async function login(email: string, password: string) {
    const response = await loginRequest({ email, password });
    applyToken(response, email.trim().toLowerCase());
  }

  async function logout() {
    try { await logoutRequest(); } finally {
      setAccessToken(null); setToken(null); setUser(null);
    }
  }

  const value = { isAuthenticated: Boolean(token), isRestoring, user, accessToken: token, login, logout, refreshSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

