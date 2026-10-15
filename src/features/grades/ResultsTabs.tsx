import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "classes", to: "/results", end: true },
  { key: "reports", to: "/results/reports", end: false },
];

/** Results & report cards: a class's results, and the academic reports. */
export function ResultsTabs() {
  const { t } = useTranslation();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label={t("grades.resultsTitle")}>
      {TABS.map((tab) => (
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
          {t(`grades.tabs.${tab.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
