import type { ReactNode } from "react";
import { vi } from "vitest";

import type { Me } from "@/lib/api/types";
import { AuthContext, type AuthContextValue } from "@/lib/auth/context";

export function makeUser(permissions: string[], overrides: Partial<Me> = {}): Me {
  return {
    id: 1,
    username: "awa",
    email: "awa@test.local",
    first_name: "Awa",
    last_name: "Touré",
    full_name: "Awa Touré",
    phone: "",
    language: "en",
    must_change_password: false,
    is_platform_admin: false,
    memberships: [
      {
        school: {
          id: 10,
          name: "École Alpha",
          code: "alpha",
          logo_url: null,
          currency: "GNF",
          timezone: "Africa/Conakry",
          default_language: "fr",
          idle_timeout_minutes: 30,
        },
        roles: [{ id: 1, key: "teacher", name: "Teacher" }],
        permissions,
      },
    ],
    ...overrides,
  };
}

export function authValue(user: Me | null, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const membership = user?.memberships[0] ?? null;
  const permissions = new Set(membership?.permissions ?? []);
  return {
    status: user ? "authenticated" : "anonymous",
    user,
    membership,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
    refreshUser: vi.fn(),
    selectSchool: vi.fn(),
    can: (code) => permissions.has(code),
    canAny: (codes) => codes.some((code) => permissions.has(code)),
    ...overrides,
  };
}

export function WithAuth({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
