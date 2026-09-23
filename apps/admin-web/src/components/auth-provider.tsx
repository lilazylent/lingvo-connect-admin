"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import type { AuthStage, AuthState } from "@/lib/types";
import { LoadingState } from "@/components/ui";

type AuthContextValue = {
  state: AuthState | null;
  loading: boolean;
  refresh: () => Promise<AuthState | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const stageRoute: Record<AuthStage, string> = {
  CHANGE_PASSWORD: "/auth/change-password",
  TWO_FACTOR_SETUP: "/auth/2fa/setup",
  TWO_FACTOR_VERIFY: "/auth/2fa/verify",
  AUTHENTICATED: "/admin",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const next = await api<AuthState>("/api/admin/auth/session");
      setState(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Initial synchronization with the server-side session store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ state, loading, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthGate({ children, adminOnly = false, permission }: { children: React.ReactNode; adminOnly?: boolean; permission?: string }) {
  const { state, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!state) router.replace(`/login?expired=1&returnTo=${encodeURIComponent(pathname)}`);
    else if (state.stage !== "AUTHENTICATED") router.replace(stageRoute[state.stage]);
    else if (adminOnly && state.user.role !== "ADMIN" && !state.user.permissions.includes("USERS_MANAGE")) router.replace("/admin/access-denied");
    else if (permission && state.user.role !== "ADMIN" && !state.user.permissions.includes(permission)) router.replace("/admin/access-denied");
  }, [adminOnly, loading, pathname, permission, router, state]);

  if (loading || !state || state.stage !== "AUTHENTICATED") return <LoadingState label="Проверяем защищённую сессию" />;
  if (adminOnly && state.user.role !== "ADMIN" && !state.user.permissions.includes("USERS_MANAGE")) return null;
  if (permission && state.user.role !== "ADMIN" && !state.user.permissions.includes(permission)) return null;
  return children;
}
