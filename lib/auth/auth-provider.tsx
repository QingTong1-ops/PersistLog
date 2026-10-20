"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  refreshSession,
  setAccessToken,
  setUnauthorizedHandler,
} from "@/lib/api/client";
import { live, type AuthUser } from "@/lib/api/live";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    timezone?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = await refreshSession();
      if (cancelled) return;
      if (!token) {
        setStatus("anonymous");
        return;
      }
      try {
        const me = await live.auth.me();
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        clearSession();
        setUser(null);
        setStatus("anonymous");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await live.auth.login(email, password);
    setAccessToken(response.access_token);
    setUser(response.user);
    setStatus("authenticated");
    return response.user;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; displayName: string; timezone?: string }) => {
      const response = await live.auth.register({
        email: input.email,
        password: input.password,
        display_name: input.displayName || undefined,
        timezone: input.timezone ?? "Asia/Shanghai",
      });
      setAccessToken(response.access_token);
      setUser(response.user);
      setStatus("authenticated");
      return response.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await live.auth.logout();
    } catch {
      // The local session is cleared even if the network call fails.
    }
    clearSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const token = await refreshSession();
    if (!token) {
      setUser(null);
      setStatus("anonymous");
      return false;
    }
    try {
      const me = await live.auth.me();
      setUser(me);
      setStatus("authenticated");
      return true;
    } catch {
      clearSession();
      setUser(null);
      setStatus("anonymous");
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
