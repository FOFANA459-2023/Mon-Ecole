import { CalendarRange, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { ClassSelect } from "@/components/pickers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import { useAuth } from "@/lib/auth/context";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { STATUS_STYLES, todayIn, useAbsences, useClassMonth } from "./api";

function daysBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function MonthGrid({ classId, month }: { classId: number | null; month: string }) {
  const { t } = useTranslation();
  const report = useClassMonth(classId, month);
  if (classId === null) return <EmptyState icon={<CalendarRange className="size-8" />} title={t("attendance.chooseClass")} />;
  if (report.isError) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  if (report.isPending) return <Spinner className="mx-auto my-6 size-6" />;
  const { dates, students, totals } = report.data;
  if (dates.length === 0) return <EmptyState icon={<CalendarRange className="size-8" />} title={t("attendance.noRegisters")} />;
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="bg-muted sticky left-0 z-10 min-w-40 px-3 py-2 text-left font-medium">{t("grades.student")}</th>
              {dates.map((d) => (
                <th key={d} scope="col" className="w-7 px-0.5 py-2 text-center font-medium tabular-nums">
                  {Number(d.slice(8))}
                </th>
              ))}
              {(["absent", "late", "excused"] as const).map((status) => (
                <th key={status} scope="col" className="border-l px-2 py-2 text-center font-medium">
                  {t(`attendance.status.${status}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((row) => {
              const byDate = new Map(row.days.map((d) => [d.date, d.status]));
              return (
                <tr key={row.enrollment} className="border-b">
                  <th scope="row" className="bg-background sticky left-0 z-10 px-3 py-1.5 text-left font-medium">
                    <Link to={`/students/${row.student}?tab=attendance`} className="hover:underline">
                      {row.student_name}
                    </Link>
                  </th>
                  {dates.map((d) => {
                    const status = byDate.get(d);
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        {status && (
                          <span
                            title={t(`attendance.status.${status}`)}
                            className={cn(
                              "inline-flex size-5 items-center justify-center rounded text-[10px] font-semibold",
                              STATUS_STYLES[status].soft,
                            )}
                          >
                            {t(`attendance.short.${status}`)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className={cn("border-l px-2 text-center tabular-nums", row.absent > 0 && "text-destructive font-semibold")}>
                    {row.absent}
                  </td>
                  <td className="px-2 text-center tabular-nums">{row.late}</td>
                  <td className="px-2 text-center tabular-nums">{row.excused}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("attendance.monthTotals", {
          days: dates.length,
          present: totals.present,
          absent: totals.absent,
          late: totals.late,
          excused: totals.excused,
        })}
      </p>
    </div>
  );
}

function AbsenceList({ classId, from, to, min }: { classId: number | null; from: string; to: string; min: number }) {
  const { t } = useTranslation();
  const absences = useAbsences({ date_from: from, date_to: to, class_group: classId, min_absences: min });
  if (absences.isError) return <QueryError onRetry={() => void absences.refetch()} />;
  if (absences.isPending) return <Spinner className="mx-auto my-6 size-6" />;
  if (absences.data.length === 0) return <EmptyState icon={<UserX className="size-8" />} title={t("attendance.noAbsences")} />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("grades.student")}</TableHead>
            <TableHead>{t("grades.class")}</TableHead>
            <TableHead className="text-right">{t("attendance.status.absent")}</TableHead>
            <TableHead className="text-right">{t("attendance.status.late")}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">{t("attendance.status.excused")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {absences.data.map((row) => (
            <TableRow key={row.enrollment}>
              <TableCell>
                <Link to={`/students/${row.student}?tab=attendance`} className="font-medium hover:underline">
                  {row.student_name}
                </Link>
                <span className="text-muted-foreground block text-xs">{row.student_number}</span>
              </TableCell>
              <TableCell>{row.class_name}</TableCell>
              <TableCell className="text-destructive text-right font-semibold tabular-nums">{row.absent}</TableCell>
              <TableCell className="text-right tabular-nums">{row.late}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.excused}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Attendance reports: a class's month day by day, and the students missing school the most. */
export function AttendanceReportsPage() {
  const { t } = useTranslation();
  const { membership } = useAuth();
  const currentYear = useCurrentYear();
  const today = todayIn(membership?.school.timezone);
  const [filters, setFilters] = useUrlState({ class: "", month: "", from: "", to: "", min: "1" });
  const classId = toNumberOrNull(filters.class);
  const month = filters.month || today.slice(0, 7);
  const to = filters.to || today;
  const from = filters.from || daysBefore(to, 30);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("attendance.monthTitle")}</CardTitle>
            <CardDescription>{t("attendance.monthHint")}</CardDescription>
          </div>
          <div className="grid grid-cols-[12rem_10rem] gap-2">
            <ClassSelect
              yearId={currentYear?.id}
              value={classId}
              onChange={(v) => setFilters({ class: v ? String(v) : "" })}
              aria-label={t("classes.chooseClass")}
            />
            <Input
              type="month"
              aria-label={t("attendance.month")}
              value={month}
              max={today.slice(0, 7)}
              onChange={(e) => setFilters({ month: e.target.value })}
            />
          </div>
        </CardHeader>
        <CardContent>
          <MonthGrid classId={classId} month={month} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("attendance.absencesTitle")}</CardTitle>
            <CardDescription>
              {classId ? t("attendance.absencesHintClass") : t("attendance.absencesHint")}
            </CardDescription>
          </div>
          <div className="grid grid-cols-[9.5rem_9.5rem_6rem] gap-2">
            <Input type="date" aria-label={t("attendance.from")} value={from} max={to} onChange={(e) => setFilters({ from: e.target.value })} />
            <Input type="date" aria-label={t("attendance.to")} value={to} max={today} onChange={(e) => setFilters({ to: e.target.value })} />
            <Input
              type="number"
              min={1}
              aria-label={t("attendance.minAbsences")}
              title={t("attendance.minAbsences")}
              value={filters.min}
              onChange={(e) => setFilters({ min: e.target.value || "1" })}
            />
          </div>
        </CardHeader>
        <CardContent>
          <AbsenceList classId={classId} from={from} to={to} min={Math.max(1, Number(filters.min) || 1)} />
        </CardContent>
      </Card>
    </div>
  );
}
