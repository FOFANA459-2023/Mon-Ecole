import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { PageHeader } from "@/components/common";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

const TABS: { key: string; to: string; end: boolean; anyOf?: string[] }[] = [
  { key: "announcements", to: "/administration", end: true },
  { key: "calendar", to: "/administration/calendar", end: false },
  { key: "departments", to: "/administration/departments", end: false },
  { key: "documents", to: "/administration/documents", end: false },
  { key: "reports", to: "/administration/reports", end: false, anyOf: ["reports.view"] },
];

/** Administration (ToR §16): announcements, the school calendar, departments, official documents, reports. */
export function AdministrationLayout() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  return (
    <>
      <PageHeader title={t("administration.title")} description={t("administration.subtitle")} />
      <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label={t("administration.title")}>
        {TABS.filter((tab) => !tab.anyOf || canAny(tab.anyOf)).map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {t(`administration.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
