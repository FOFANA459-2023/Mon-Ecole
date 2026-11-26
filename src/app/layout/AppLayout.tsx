import { Eye } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/context";
import { useIdleTimeout } from "@/lib/auth/useIdleTimeout";

import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Reminds the platform owner that they are inside a client's school: they look and maintain, the school's
 * Director manages its team. */
function OwnerViewBanner() {
  const { t } = useTranslation();
  const { user, membership } = useAuth();
  const viewing = user?.is_platform_admin && membership?.roles.some((role) => role.key === "platform_admin");
  if (!viewing || !membership) return null;
  return (
    <div className="bg-primary/5 text-primary border-primary/15 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm sm:px-6 lg:px-8">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{t("nav.ownerView", { school: membership.school.name })}</span>
      <Link to="/platform" className="font-medium underline-offset-4 hover:underline">
        {t("nav.backToPlatform")}
      </Link>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { membership, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onIdle = useCallback(() => void logout("idle"), [logout]);
  useIdleTimeout(membership?.school.idle_timeout_minutes, onIdle);

  return (
    <div className="flex min-h-svh">
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-svh w-64 shrink-0 lg:block">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 p-0 [&>button]:text-white"
        >
          <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
          <SheetDescription className="sr-only">{t("app.name")}</SheetDescription>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <OwnerViewBanner />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
