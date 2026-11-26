import {
  CalendarCheck,
  ClipboardPen,
  Landmark,
  Megaphone,
  Receipt,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useAuth } from "@/lib/auth/context";

/** The everyday tasks, one click from the dashboard. Each person only sees the ones their role allows. */
const ACTIONS: { key: string; to: string; permission: string; icon: LucideIcon }[] = [
  { key: "enrol", to: "/enrollments/new", permission: "enrollments.create", icon: UserPlus },
  { key: "register", to: "/attendance", permission: "attendance.record", icon: CalendarCheck },
  { key: "marks", to: "/assessments", permission: "grades.enter", icon: ClipboardPen },
  { key: "payment", to: "/finance/payments", permission: "finance.payment.record", icon: Receipt },
  { key: "cash", to: "/cash-register", permission: "cash.open", icon: Landmark },
  { key: "staff", to: "/teachers", permission: "staff.create", icon: Users },
  { key: "announce", to: "/administration", permission: "administration.manage", icon: Megaphone },
];

export function QuickActions() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const actions = ACTIONS.filter((action) => can(action.permission));
  if (actions.length === 0) return null;
  return (
    <nav aria-label={t("dashboard.quick.label")} className="mb-6">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {actions.map(({ key, to, icon: Icon }) => (
          <li key={key}>
            <Link
              to={to}
              className="bg-card hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-ring flex h-full items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
            >
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-4" />
              </span>
              <span className="leading-tight">{t(`dashboard.quick.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
