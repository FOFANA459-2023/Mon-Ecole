import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/context";
import { useIdleTimeout } from "@/lib/auth/useIdleTimeout";

import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
