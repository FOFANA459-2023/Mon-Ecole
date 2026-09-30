import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarRange,
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
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolId } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { localeFor } from "@/lib/format";

const SETUP_STEPS = [
  { key: "setupProfile", to: "/settings/school", permission: "settings.manage", icon: Building2 },
  { key: "setupUsers", to: "/settings/users", permission: "users.manage", icon: UserPlus },
  { key: "setupRoles", to: "/settings/roles", permission: "users.manage", icon: ShieldCheck },
  { key: "setupAudit", to: "/settings/audit", permission: "audit.view", icon: History },
];

function Kpi({
  label,
  icon: Icon,
  value,
  caption,
  loading,
  to,
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  caption: ReactNode;
  loading?: boolean;
  to?: string;
}) {
  const body = (
    <Card className="hover:border-primary/40 h-full gap-3 py-5 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between px-5">
        <CardDescription className="text-sm font-medium">{label}</CardDescription>
        <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="px-5">
        {loading ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-semibold tabular-nums">{value}</p>}
        <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, membership, can } = useAuth();
  const schoolId = useSchoolId();
  const summary = useQuery({
    queryKey: ["dashboard", schoolId],
    queryFn: ({ signal }) => api.get<DashboardSummary>("/dashboard/summary/", undefined, signal),
    enabled: schoolId !== null && can("dashboard.view"),
  });
  if (!user || !membership) return null;

  const number = new Intl.NumberFormat(localeFor(i18n.language));
  const data = summary.data;
  const loading = summary.isPending && can("dashboard.view");
  const noYear = data && data.academic_year === null;
  const steps = SETUP_STEPS.filter((step) => can(step.permission));
  const maxLevel = Math.max(1, ...(data?.by_level ?? []).map((l) => l.count));
  const students = data?.students ?? 0;
  // Teachers see figures for the classes they teach only.
  const mine = data?.scope === "my_classes";

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: user.first_name || user.full_name })}
        description={t("dashboard.subtitle", { school: membership.school.name })}
        actions={
          data?.academic_year && (
            <Badge variant="secondary" className="gap-1.5">
              <CalendarRange className="size-3.5" /> {t("dashboard.yearLabel", { name: data.academic_year.name })}
            </Badge>
          )
        }
      />

      {noYear && (
        <Card className="mb-4 border-dashed">
          <CardContent className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-sm">
            {t("dashboard.noYear")}
            {can("settings.manage") && (
              <Link to="/settings/academic" className="text-primary font-medium hover:underline">
                {t("academics.setupLink")} →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {can("dashboard.view") && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            label={t(mine ? "dashboard.kpi.myStudents" : "dashboard.kpi.students")}
            icon={GraduationCap}
            loading={loading}
            value={number.format(students)}
            caption={
              data?.students_female !== undefined
                ? `${number.format(data.students_female)} ${t("dashboard.girls").toLowerCase()} · ${number.format(data.students_male ?? 0)} ${t("dashboard.boys").toLowerCase()}`
                : ""
            }
            to={can("students.view") ? "/students" : undefined}
          />
          <Kpi
            label={t(mine ? "dashboard.kpi.myClasses" : "dashboard.kpi.classes")}
            icon={School}
            loading={loading}
            value={number.format(data?.classes ?? 0)}
            caption={
              data?.capacity ? t("dashboard.capacityUsed", { used: number.format(students), capacity: number.format(data.capacity) }) : ""
            }
            to={can("classes.view") ? "/classes" : undefined}
          />
          <Kpi
            label={t("dashboard.kpi.teachers")}
            icon={Users}
            loading={loading}
            value={number.format(data?.teachers ?? 0)}
            caption={t("dashboard.staffTotal", { count: data?.staff ?? 0 })}
            to={can("staff.view") ? "/teachers" : undefined}
          />
          {can("finance.view") && (
            <>
              <Kpi label={t("dashboard.kpi.collected")} icon={Wallet} value="—" caption={t("dashboard.availableIn", { phase: 3 })} />
              <Kpi label={t("dashboard.kpi.outstanding")} icon={ReceiptText} value="—" caption={t("dashboard.availableIn", { phase: 3 })} />
            </>
          )}
          {can("attendance.view") && (
            <Kpi label={t("dashboard.kpi.presentToday")} icon={CalendarCheck} value="—" caption={t("dashboard.availableIn", { phase: 4 })} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {data?.by_level && data.by_level.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboard.byLevel")}</CardTitle>
              <CardDescription>{t("dashboard.newEnrolments", { count: data.new_enrollments_30d ?? 0 })}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.by_level.map((level) => (
                <div key={level.level_id} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate">{level.level}</span>
                  <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                    <div className="bg-chart-1 h-full rounded-full" style={{ width: `${(level.count / maxLevel) * 100}%` }} />
                  </div>
                  <span className="text-right tabular-nums">{number.format(level.count)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {students > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.genderSplit")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex h-3 overflow-hidden rounded-full">
                <div className="bg-chart-2" style={{ width: `${((data?.students_female ?? 0) / students) * 100}%` }} />
                <div className="bg-chart-1" style={{ width: `${((data?.students_male ?? 0) / students) * 100}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: t("dashboard.girls"), value: data?.students_female ?? 0, color: "bg-chart-2" },
                  { label: t("dashboard.boys"), value: data?.students_male ?? 0, color: "bg-chart-1" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span className="flex-1">{item.label}</span>
                    <span className="tabular-nums">
                      {number.format(item.value)} <span className="text-muted-foreground">({Math.round((item.value / students) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
            <div className="flex flex-wrap gap-1.5">
              {membership.roles.map((role) => (
                <Badge key={role.key} variant="secondary">
                  {role.name}
                </Badge>
              ))}
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
