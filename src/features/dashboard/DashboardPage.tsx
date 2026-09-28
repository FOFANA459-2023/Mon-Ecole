import {
  ArrowRight,
  Building2,
  CalendarCheck,
  GraduationCap,
  History,
  ReceiptText,
  School,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/context";

type Kpi = { key: string; icon: LucideIcon; phase: number; permission?: string };

const KPIS: Kpi[] = [
  { key: "students", icon: GraduationCap, phase: 2 },
  { key: "classes", icon: School, phase: 2 },
  { key: "teachers", icon: Users, phase: 2 },
  { key: "collected", icon: Wallet, phase: 3, permission: "finance.view" },
  { key: "outstanding", icon: ReceiptText, phase: 3, permission: "finance.view" },
  { key: "presentToday", icon: CalendarCheck, phase: 4, permission: "attendance.view" },
];

const SETUP_STEPS = [
  { key: "setupProfile", to: "/settings/school", permission: "settings.manage", icon: Building2 },
  { key: "setupUsers", to: "/settings/users", permission: "users.manage", icon: UserPlus },
  { key: "setupRoles", to: "/settings/roles", permission: "users.manage", icon: ShieldCheck },
  { key: "setupAudit", to: "/settings/audit", permission: "audit.view", icon: History },
];

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, membership, can } = useAuth();
  if (!user || !membership) return null;

  const kpis = KPIS.filter((kpi) => !kpi.permission || can(kpi.permission));
  const steps = SETUP_STEPS.filter((step) => can(step.permission));

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: user.first_name || user.full_name })}
        description={t("dashboard.subtitle", { school: membership.school.name })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.key} className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center justify-between px-5">
              <CardDescription className="text-sm font-medium">{t(`dashboard.kpi.${kpi.key}`)}</CardDescription>
              <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
                <kpi.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-muted-foreground/60 text-3xl font-semibold tabular-nums">—</p>
              <p className="text-muted-foreground mt-1 text-xs">{t("dashboard.availableIn", { phase: kpi.phase })}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {steps.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboard.setupTitle")}</CardTitle>
              <CardDescription>{t("dashboard.setupSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {steps.map((step) => (
                <Link
                  key={step.key}
                  to={step.to}
                  className="hover:bg-muted group flex items-center gap-4 rounded-lg border p-3 transition-colors"
                >
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <step.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`dashboard.${step.key}`)}</span>
                    <span className="text-muted-foreground block text-sm">{t(`dashboard.${step.key}Hint`)}</span>
                  </span>
                  <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.accessTitle")}</CardTitle>
            <CardDescription>{membership.school.name}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                {t("dashboard.roles")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {membership.roles.map((role) => (
                  <Badge key={role.key} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("dashboard.permissionsCount", { count: membership.permissions.length })}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
