import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Outlet } from "react-router";

import { PageHeader } from "@/components/common";
import { cn } from "@/lib/utils";

import { useVisibleSettingsTabs } from "./useVisibleSettingsTabs";

export function SettingsLayout() {
  const { t } = useTranslation();
  const tabs = useVisibleSettingsTabs();
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label={t("settings.title")}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {t(`settings.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

export function SettingsIndexRedirect() {
  const tabs = useVisibleSettingsTabs();
  return <Navigate to={tabs[0]?.to ?? "/"} replace />;
}
