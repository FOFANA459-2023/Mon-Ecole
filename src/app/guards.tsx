import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";

import { BrandMark, FullPageSpinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/context";

/** Signed-in area: sends visitors to /login and enforces a pending password change. */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous" || !user) {
    const next = location.pathname + location.search;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (user.memberships.length === 0) {
    // The platform owner before any school exists: only the platform area makes sense.
    if (user.is_platform_admin) {
      return location.pathname.startsWith("/platform") ? <Outlet /> : <Navigate to="/platform" replace />;
    }
    return <NoSchoolAccess />;
  }
  return <Outlet />;
}

/** The platform owner's pages (every school); the API refuses everyone else too. */
export function RequirePlatformOwner() {
  const { user } = useAuth();
  if (!user?.is_platform_admin) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Pages like /login that make no sense once signed in. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Route-level permission gate; the API applies the same rule. */
export function RequirePermission({ anyOf }: { anyOf: string[] }) {
  const { canAny } = useAuth();
  if (anyOf.length > 0 && !canAny(anyOf)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function NoSchoolAccess() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandMark className="size-12" />
      <h1 className="text-xl font-semibold">{t("auth.noAccessTitle")}</h1>
      <p className="text-muted-foreground max-w-sm">{t("auth.noAccessBody")}</p>
      <Button variant="outline" onClick={() => void logout()}>
        <LogOut /> {t("nav.logout")}
      </Button>
    </div>
  );
}
