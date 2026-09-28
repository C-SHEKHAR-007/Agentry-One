import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export interface AuthUser {
  id: string | null;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: string;
}

type AuthStatus = "loading" | "needsSetup" | "unauthed" | "authed";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  status: "loading",
  user: null,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const setup = await api.get<{ needsSetup: boolean }>("/auth/setup-status");
      if (setup.needsSetup) {
        setStatus("needsSetup");
        setUser(null);
        return;
      }
      const me = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(me.user);
      setStatus("authed");
    } catch {
      setUser(null);
      setStatus("unauthed");
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => null);
    // Drop every cached query so the next person on this browser never sees
    // the previous user's projects, providers, or team list.
    queryClient.clear();
    setUser(null);
    setStatus("unauthed");
  }, [queryClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ status, user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
