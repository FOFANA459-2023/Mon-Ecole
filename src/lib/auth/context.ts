import { createContext, useContext } from "react";

import type { Me, MembershipInfo, SessionResponse } from "@/lib/api/types";

export type AuthStatus = "loading" | "anonymous" | "authenticated";
export type LogoutReason = "manual" | "idle" | "expired";

export type AuthContextValue = {
  status: AuthStatus;
  user: Me | null;
  /** The membership for the school currently selected (null until signed in). */
  membership: MembershipInfo | null;
  login: (login: string, password: string) => Promise<Me>;
  logout: (reason?: LogoutReason) => Promise<void>;
  /** Store a fresh session returned by the API (e.g. after a password change). */
  applySession: (session: SessionResponse) => void;
  refreshUser: () => Promise<void>;
  selectSchool: (schoolId: number) => void;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
