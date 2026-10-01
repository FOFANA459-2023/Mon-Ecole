import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { PageHeader } from "@/components/common";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "registers", to: "/attendance", end: true, anyOf: [] as string[] },
  { key: "reports", to: "/attendance/reports", end: false, anyOf: [] as string[] },
  { key: "staff", to: "/attendance/staff", end: false, anyOf: ["attendance.staff"] },
];

export function AttendanceLayout() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  return (
    <>
      <PageHeader title={t("attendance.title")} description={t("attendance.subtitle")} />
      <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label={t("attendance.title")}>
        {TABS.filter((tab) => tab.anyOf.length === 0 || canAny(tab.anyOf)).map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {t(`attendance.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
