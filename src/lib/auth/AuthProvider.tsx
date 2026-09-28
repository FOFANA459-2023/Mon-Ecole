import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { apiRequest, refreshAccessToken, session } from "@/lib/api/client";
import type { Me, SessionResponse } from "@/lib/api/types";

import { AuthContext, type AuthContextValue, type AuthStatus, type LogoutReason } from "./context";

const schoolKey = (userId: number) => `monecole:school:${userId}`;

function rememberedSchool(user: Me): number | null {
  const ids = user.memberships.map((m) => m.school.id);
  try {
    const stored = Number(localStorage.getItem(schoolKey(user.id)));
    if (ids.includes(stored)) return stored;
  } catch {
    // Storage unavailable: fall through to the first school.
  }
  return ids[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<Me | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const loggingOut = useRef(false);

  const applyUser = useCallback(
    (me: Me) => {
      const selected = rememberedSchool(me);
      session.setSchoolId(selected);
      setSchoolId(selected);
      setUser(me);
      setStatus("authenticated");
      if (me.language !== i18n.language) void i18n.changeLanguage(me.language);
    },
    [i18n],
  );

  const clearSession = useCallback(() => {
    session.clear();
    queryClient.clear();
    setUser(null);
    setSchoolId(null);
    setStatus("anonymous");
  }, [queryClient]);

  const logout = useCallback(
    async (reason: LogoutReason = "manual") => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      try {
        await apiRequest("/auth/logout/", { method: "POST", auth: false });
      } catch {
        // Already signed out on the server, or offline: clear locally anyway.
      } finally {
        clearSession();
        loggingOut.current = false;
      }
      if (reason === "idle") toast.info(t("auth.idleLogout"));
      if (reason === "expired") toast.warning(t("auth.sessionExpired"));
    },
    [clearSession, t],
  );

  // Resume an existing session from the refresh cookie, once per page load.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        setStatus((current) => (current === "loading" ? "anonymous" : current));
        return;
      }
      try {
        applyUser(await apiRequest<Me>("/me/"));
      } catch {
        clearSession();
      }
    })();
  }, [applyUser, clearSession]);

  useEffect(() => {
    session.onSessionExpired(() => void logout("expired"));
    return () => session.onSessionExpired(null);
  }, [logout]);

  const applySession = useCallback(
    (data: SessionResponse) => {
      session.setAccessToken(data.access);
      applyUser(data.user);
    },
    [applyUser],
  );

  const login = useCallback(
    async (loginValue: string, password: string) => {
      const data = await apiRequest<SessionResponse>("/auth/login/", {
        method: "POST",
        body: { login: loginValue, password },
        auth: false,
      });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    const me = await apiRequest<Me>("/me/");
    setUser(me);
  }, []);

  const selectSchool = useCallback(
    (id: number) => {
      if (!user) return;
      try {
        localStorage.setItem(schoolKey(user.id), String(id));
      } catch {
        // Not remembered across visits, but still applied now.
      }
      session.setSchoolId(id);
      setSchoolId(id);
      queryClient.removeQueries();
    },
    [queryClient, user],
  );

  const membership = useMemo(
    () => user?.memberships.find((m) => m.school.id === schoolId) ?? null,
    [user, schoolId],
  );

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(membership?.permissions ?? []);
    return {
      status,
      user,
      membership,
      login,
      logout,
      applySession,
      refreshUser,
      selectSchool,
      can: (code) => permissions.has(code),
      canAny: (codes) => codes.some((code) => permissions.has(code)),
    };
  }, [status, user, membership, login, logout, applySession, refreshUser, selectSchool]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
