import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  ClipboardPen,
  GraduationCap,
  History,
  Megaphone,
  ReceiptText,
  School,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "@/components/common";
import { ClassSelect, LevelSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcademicYears, useSchoolId } from "@/features/academics/api";
import { api, type Query } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { localeFor } from "@/lib/format";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { BarList, ChartCard, ColumnChart, EmptyChart, RateLineChart, SplitBar } from "./charts";

const SETUP_STEPS = [
  { key: "setupProfile", to: "/settings/school", permission: "settings.manage", icon: Building2 },
  { key: "setupUsers", to: "/settings/users", permission: "users.manage", icon: UserPlus },
  { key: "setupRoles", to: "/settings/roles", permission: "users.manage", icon: ShieldCheck },
  { key: "setupAudit", to: "/settings/audit", permission: "audit.view", icon: History },
];
const PAYMENT_STATUSES = ["paid", "partial", "unpaid", "overdue"] as const;
const DEFAULTS = { year: "", term: "", level: "", class: "", payment: "" };

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
        {loading ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-semibold">{value}</p>}
        <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** One line of the alerts strip: an icon, what needs attention, and where to deal with it. */
function AlertRow({
  icon: Icon,
  tone = "text-muted-foreground",
  children,
  to,
  action,
}: {
  icon: LucideIcon;
  tone?: string;
  children: ReactNode;
  to?: string;
  action?: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {to && action && (
        <Link to={to} className="text-primary text-sm font-medium whitespace-nowrap hover:underline">
          {action} →
        </Link>
      )}
    </li>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, membership, can } = useAuth();
  const schoolId = useSchoolId();
  const formatDate = useFormatDate();
  const years = useAcademicYears().data ?? [];
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const yearId = toNumberOrNull(filters.year);
  const year = years.find((y) => y.id === yearId) ?? years.find((y) => y.is_current);
  const params: Query = {
    academic_year: yearId ?? undefined,
    term: filters.term || undefined,
    level: filters.level || undefined,
    class_group: filters.class || undefined,
    payment_status: filters.payment || undefined,
  };
  const summary = useQuery({
    queryKey: ["dashboard", schoolId, params],
    queryFn: ({ signal }) => api.get<DashboardSummary>("/dashboard/summary/", params, signal),
    enabled: schoolId !== null && can("dashboard.view"),
    placeholderData: keepPreviousData,
  });
  if (!user || !membership) return null;

  const locale = localeFor(i18n.language);
  const number = new Intl.NumberFormat(locale);
  const currency = membership.school.currency;
  const money = (value: number | string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
  const compactMoney = (value: number | string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(
      Number(value),
    );
  const compact = (value: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const percent = (value: string | null | undefined) =>
    value === null || value === undefined ? "—" : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value))} %`;
  const month = (key: string) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(`${key}-01T00:00:00`));
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`));

  const data = summary.data;
  const loading = summary.isPending && can("dashboard.view");
  const noYear = data && data.academic_year === null;
  const steps = SETUP_STEPS.filter((step) => can(step.permission));
  const students = data?.students ?? 0;
  // Teachers see figures for the classes they teach only.
  const mine = data?.scope === "my_classes";
  const finance = data?.finance;
  const attendance = data?.attendance;
  const performance = data?.performance;
  const missing = data?.missing_grades;
  const unpublished = (missing?.open ?? 0) + (missing?.submitted ?? 0);

  const alerts: ReactNode[] = [];
  if ((data?.absence_alerts ?? 0) > 0) {
    alerts.push(
      <AlertRow key="absences" icon={BellRing} tone="text-destructive" to="/attendance/alerts" action={t("dashboard.followUp")}>
        {t("dashboard.absenceAlerts", { count: data?.absence_alerts ?? 0 })}
      </AlertRow>,
    );
  }
  if (finance && finance.students_overdue > 0) {
    alerts.push(
      <AlertRow
        key="overdue"
        icon={TriangleAlert}
        tone="text-destructive"
        to="/finance/invoices?status=overdue"
        action={t("dashboard.alerts.seeInvoices")}
      >
        {t("dashboard.alerts.overdue", { count: finance.students_overdue, amount: money(finance.overdue) })}
      </AlertRow>,
    );
  }
  if (finance && finance.upcoming_deadlines.invoices > 0) {
    alerts.push(
      <AlertRow key="deadlines" icon={CalendarClock} to="/finance/invoices" action={t("dashboard.alerts.seeInvoices")}>
        {t("dashboard.alerts.deadlines", {
          count: finance.upcoming_deadlines.invoices,
          amount: money(finance.upcoming_deadlines.amount),
          days: finance.upcoming_deadlines.days,
        })}
      </AlertRow>,
    );
  }
  for (const exam of data?.upcoming_exams ?? []) {
    alerts.push(
      <AlertRow key={`exam-${exam.id}`} icon={CalendarRange} to="/administration/calendar" action={t("dashboard.alerts.calendar")}>
        {t("dashboard.alerts.exam", { title: exam.title, date: formatDate(exam.start_date) })}
      </AlertRow>,
    );
  }
  if (missing && unpublished > 0) {
    alerts.push(
      <AlertRow
        key="grades"
        icon={ClipboardPen}
        to={`/assessments?term=${missing.term.id}`}
        action={t("dashboard.alerts.seeMarks")}
      >
        {t("dashboard.alerts.missingGrades", {
          count: unpublished,
          submitted: missing.submitted,
          term: missing.term.name,
          date: formatDate(missing.term.end_date),
        })}
      </AlertRow>,
    );
  }
  for (const item of data?.announcements ?? []) {
    alerts.push(
      <AlertRow key={`news-${item.id}`} icon={Megaphone} tone={item.priority === "important" ? "text-destructive" : undefined}>
        <span className="font-medium">{item.title}</span>
        <span className="text-muted-foreground"> · {formatDate(item.publish_at.slice(0, 10))}</span>
      </AlertRow>,
    );
  }

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: user.first_name || user.full_name })}
        description={t("dashboard.subtitle", { school: membership.school.name })}
        actions={
          data?.academic_year && (
            <Badge variant="secondary" className="gap-1.5">
              <CalendarRange className="size-3.5" /> {t("dashboard.yearLabel", { name: data.academic_year.name })}
              {data.filters?.term_name && ` · ${data.filters.term_name}`}
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

      {can("dashboard.view") && !noYear && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label={t("dashboard.filters.label")}>
          <YearSelect
            aria-label={t("classes.year")}
            value={year?.id ?? null}
            onChange={(v) => setFilters({ year: v ? String(v) : "", term: "", class: "" })}
          />
          <OptionSelect
            aria-label={t("grades.term")}
            value={filters.term || (data?.filters?.term ? String(data.filters.term) : null)}
            onChange={(v) => setFilters({ term: v ?? "" })}
            options={(year?.terms ?? []).map((term) => ({ value: String(term.id), label: term.name }))}
            placeholder={t("grades.term")}
          />
          <LevelSelect
            aria-label={t("classes.level")}
            value={toNumberOrNull(filters.level)}
            onChange={(v) => setFilters({ level: v ? String(v) : "", class: "" })}
            allLabel={t("grades.reports.allLevels")}
          />
          <ClassSelect
            aria-label={t("classes.chooseClass")}
            yearId={year?.id}
            value={toNumberOrNull(filters.class)}
            onChange={(v) => setFilters({ class: v ? String(v) : "" })}
            allLabel={t("classes.allClasses")}
          />
          {can("finance.view") && (
            <OptionSelect<(typeof PAYMENT_STATUSES)[number]>
              aria-label={t("dashboard.filters.payment")}
              value={(filters.payment || null) as (typeof PAYMENT_STATUSES)[number] | null}
              onChange={(v) => setFilters({ payment: v ?? "" })}
              allLabel={t("dashboard.filters.allPayments")}
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
          )}
        </div>
      )}

      {alerts.length > 0 && (
        <Card className="mb-4 gap-0 py-3">
          <CardContent>
            <ul className="divide-y" aria-label={t("dashboard.alerts.title")}>
              {alerts}
            </ul>
          </CardContent>
        </Card>
      )}

      {can("dashboard.view") && (
        <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", summary.isFetching && !loading && "opacity-70")}>
          <Kpi
            label={t(mine ? "dashboard.kpi.myStudents" : "dashboard.kpi.students")}
            icon={GraduationCap}
            loading={loading}
            value={number.format(students)}
            caption={t("dashboard.newEnrolments", { count: data?.new_enrollments_30d ?? 0 })}
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
          {can("attendance.view") && (
            <Kpi
              label={t("dashboard.kpi.presentToday")}
              icon={CalendarCheck}
              loading={loading}
              value={data?.attendance_today ? number.format(data.attendance_today.present + data.attendance_today.late) : "—"}
              caption={
                data?.attendance_today
                  ? t("dashboard.attendanceCaption", {
                      absent: data.attendance_today.absent + data.attendance_today.excused,
                      late: data.attendance_today.late,
                      taken: data.attendance_today.registers_taken,
                      classes: data.attendance_today.classes,
                    })
                  : ""
              }
              to="/attendance"
            />
          )}
          {finance && (
            <>
              <Kpi
                label={t("dashboard.kpi.expected")}
                icon={ReceiptText}
                loading={loading}
                value={compactMoney(finance.expected)}
                caption={money(finance.expected)}
                to="/finance/reports?report=summary"
              />
              <Kpi
                label={t("dashboard.kpi.collected")}
                icon={Wallet}
                loading={loading}
                value={compactMoney(finance.collected)}
                caption={t("dashboard.collectionRate", { rate: percent(finance.collection_rate) })}
                to="/finance/payments"
              />
              <Kpi
                label={t("dashboard.kpi.outstanding")}
                icon={ReceiptText}
                loading={loading}
                value={compactMoney(finance.outstanding)}
                caption={t("dashboard.studentsOwing", { count: finance.students_with_balance })}
                to="/finance/reports?report=outstanding"
              />
              <Kpi
                label={t("dashboard.kpi.overdue")}
                icon={TriangleAlert}
                loading={loading}
                value={compactMoney(finance.overdue)}
                caption={t("dashboard.studentsLate", { count: finance.students_overdue })}
                to="/finance/invoices?status=overdue"
              />
            </>
          )}
        </div>
      )}

      {can("dashboard.view") && data && !noYear && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {finance && (
            <ChartCard
              title={t("dashboard.charts.revenueByMonth")}
              description={t("dashboard.charts.revenueByMonthHint")}
              table={{
                columns: [t("dashboard.charts.month"), t("dashboard.charts.amount")],
                rows: finance.by_month.map((m) => [month(m.month), money(m.amount)]),
              }}
            >
              {finance.by_month.some((m) => Number(m.amount) > 0) ? (
                <ColumnChart
                  label={t("dashboard.charts.revenueByMonth")}
                  points={finance.by_month.map((m) => ({ key: m.month, label: month(m.month), value: Number(m.amount) }))}
                  format={money}
                  formatAxis={compact}
                />
              ) : (
                <EmptyChart>{t("dashboard.charts.noPayments")}</EmptyChart>
              )}
            </ChartCard>
          )}
          {finance && (
            <ChartCard
              title={t("dashboard.charts.outstandingByClass")}
              description={t("dashboard.charts.collectedVsOutstanding")}
              table={{
                columns: [t("grades.class"), t("dashboard.charts.amount"), t("dashboard.charts.students")],
                rows: finance.outstanding_by_class.map((r) => [r.class_name, money(r.amount), r.students]),
              }}
            >
              <div className="grid gap-5">
                <SplitBar
                  parts={[
                    { label: t("dashboard.charts.collected"), value: Number(finance.collected) },
                    { label: t("dashboard.charts.outstanding"), value: Number(finance.outstanding) },
                  ]}
                  format={compactMoney}
                />
                {finance.outstanding_by_class.length ? (
                  <BarList
                    items={finance.outstanding_by_class.map((r) => ({
                      key: r.class_name,
                      label: r.class_name === "—" ? t("dashboard.charts.noClass") : r.class_name,
                      value: Number(r.amount),
                      display: compactMoney(r.amount),
                      hint: t("dashboard.studentsOwing", { count: r.students }),
                    }))}
                    format={compactMoney}
                  />
                ) : (
                  <EmptyChart>{t("dashboard.charts.nothingOwed")}</EmptyChart>
                )}
              </div>
            </ChartCard>
          )}
          {attendance && (
            <ChartCard
              title={t("dashboard.charts.attendance")}
              description={t("dashboard.charts.attendanceHint", {
                rate: percent(attendance.rate),
                from: formatDate(attendance.date_from),
                to: formatDate(attendance.date_to),
              })}
              table={{
                columns: [
                  t("common.date"),
                  t("dashboard.charts.rate"),
                  t("attendance.status.absent"),
                  t("attendance.status.late"),
                  t("attendance.status.excused"),
                ],
                rows: attendance.days.map((d) => [formatDate(d.date), percent(d.rate), d.absent, d.late, d.excused]),
              }}
            >
              {attendance.days.length ? (
                <RateLineChart
                  label={t("dashboard.charts.attendance")}
                  points={attendance.days.map((d) => ({
                    key: d.date,
                    label: shortDate(d.date),
                    value: d.rate === null ? null : Number(d.rate),
                  }))}
                  detail={(index) =>
                    t("dashboard.charts.attendanceDetail", {
                      absent: attendance.days[index].absent,
                      late: attendance.days[index].late,
                    })
                  }
                />
              ) : (
                <EmptyChart>{t("dashboard.charts.noRegisters")}</EmptyChart>
              )}
            </ChartCard>
          )}
          {performance && (
            <ChartCard
              title={t("dashboard.charts.performance", { term: performance.term.name })}
              description={t("dashboard.charts.performanceHint", {
                rate: percent(performance.pass_rate),
                counted: performance.counted,
              })}
              table={{
                columns: [t("grades.class"), t("grades.classAverage"), t("dashboard.charts.passRate"), t("dashboard.charts.students")],
                rows: performance.by_class.map((r) => [r.class_name, r.average, percent(r.pass_rate), r.counted]),
              }}
            >
              {performance.counted ? (
                <BarList
                  labelWidth="9rem"
                  items={performance.distribution.map((band) => ({
                    key: band.label || "pass",
                    label: band.below_pass
                      ? t("dashboard.charts.belowPass", { mark: band.label.replace("< ", "") })
                      : band.label || t("dashboard.charts.passedNoHonours"),
                    value: band.count,
                    tone: band.below_pass ? "bg-destructive" : undefined,
                  }))}
                  format={(v) => number.format(v)}
                />
              ) : (
                <EmptyChart>{t("dashboard.charts.noResults")}</EmptyChart>
              )}
            </ChartCard>
          )}
          {(data.by_class?.length ?? 0) > 0 && (
            <ChartCard
              title={t("dashboard.charts.byClass")}
              description={t("dashboard.newEnrolments", { count: data.new_enrollments_30d ?? 0 })}
              table={{
                columns: [t("grades.class"), t("dashboard.charts.students"), t("classes.capacity")],
                rows: (data.by_class ?? []).map((c) => [c.class_name, c.count, c.capacity ?? "—"]),
              }}
            >
              <BarList
                items={(data.by_class ?? []).map((c) => ({
                  key: c.class_group,
                  label: c.class_name,
                  value: c.count,
                  display: c.capacity ? `${number.format(c.count)} / ${number.format(c.capacity)}` : number.format(c.count),
                }))}
                format={(v) => number.format(v)}
              />
            </ChartCard>
          )}
          <div className="grid content-start gap-4">
            {students > 0 && (
              <ChartCard title={t("dashboard.genderSplit")}>
                <SplitBar
                  parts={[
                    { label: t("dashboard.girls"), value: data.students_female ?? 0 },
                    { label: t("dashboard.boys"), value: data.students_male ?? 0 },
                  ]}
                  format={(v) => number.format(v)}
                />
              </ChartCard>
            )}
            {(data.by_level?.length ?? 0) > 0 && (
              <ChartCard
                title={t("dashboard.byLevel")}
                table={{
                  columns: [t("classes.level"), t("dashboard.charts.students")],
                  rows: (data.by_level ?? []).map((l) => [l.level, l.count]),
                }}
              >
                <BarList
                  items={(data.by_level ?? []).map((l) => ({ key: l.level_id, label: l.level, value: l.count }))}
                  format={(v) => number.format(v)}
                />
              </ChartCard>
            )}
          </div>
        </div>
      )}

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
