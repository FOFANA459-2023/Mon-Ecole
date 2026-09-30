import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";

import { PageHeader } from "@/components/common";
import { cn } from "@/lib/utils";

const FINANCE_TABS = [
  { key: "invoices", to: "/finance/invoices" },
  { key: "payments", to: "/finance/payments" },
  { key: "expenses", to: "/finance/expenses" },
  { key: "fees", to: "/finance/fees" },
  { key: "discounts", to: "/finance/discounts" },
  { key: "reports", to: "/finance/reports" },
] as const;

export function FinanceLayout() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("finance.title")} description={t("finance.subtitle")} />
      <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label={t("finance.title")}>
        {FINANCE_TABS.map((tab) => (
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
            {t(`finance.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
