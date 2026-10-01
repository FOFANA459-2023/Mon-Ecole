import { CalendarCheck, CheckCircle2, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormatDateTime } from "@/features/cash/api";
import { useAuth } from "@/lib/auth/context";
import { useUrlState } from "@/lib/useUrlState";

import { STATUS_STYLES, todayIn, useAttendanceDay } from "./api";

/** The day's classes (a teacher's own) and their registers: the first screen a teacher opens each morning. */
export function AttendanceDayPage() {
  const { t } = useTranslation();
  const { membership } = useAuth();
  const { time } = useFormatDateTime();
  const today = todayIn(membership?.school.timezone);
  const [filters, setFilters] = useUrlState({ date: "" });
  const date = filters.date || today;
  const day = useAttendanceDay(date);
  const rows = day.data ?? [];
  const taken = rows.filter((r) => r.register !== null).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("attendance.day")}
          <Input
            type="date"
            className="w-44"
            value={date}
            max={today}
            onChange={(e) => setFilters({ date: e.target.value === today ? "" : e.target.value })}
          />
        </label>
        {rows.length > 0 && (
          <p className="text-muted-foreground text-sm" role="status">
            {t("attendance.takenCount", { taken, total: rows.length })}
          </p>
        )}
      </div>

      {day.isError ? (
        <QueryError onRetry={() => void day.refetch()} />
      ) : day.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarCheck className="size-8" />} title={t("attendance.noClasses")}>
            {t("attendance.noClassesHint")}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const link = `/attendance/classes/${row.class_group}${date === today ? "" : `?date=${date}`}`;
            return (
              <Card key={row.class_group} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.class_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.level_name} · {t("attendance.studentCount", { count: row.student_count })}
                    </p>
                  </div>
                  {row.register ? (
                    <Badge variant="outline" className="bg-success/15 text-success border-transparent">
                      <CheckCircle2 /> {t("attendance.taken")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">
                      {t("attendance.notTaken")}
                    </Badge>
                  )}
                </div>
                {row.register ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {(["absent", "late", "excused"] as const).map((status) => (
                        <span key={status} className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status].soft}`}>
                          {t(`attendance.counts.${status}`, { count: row[status] })}
                        </span>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("attendance.takenBy", { name: row.taken_by_name, time: row.taken_at ? time(row.taken_at) : "" })}
                    </p>
                  </>
                ) : null}
                <Button asChild variant={row.register || !row.can_take ? "outline" : "default"} className="mt-auto">
                  <Link to={link}>
                    <ClipboardList />
                    {row.register
                      ? row.can_take
                        ? t("attendance.openToChange")
                        : t("attendance.view")
                      : row.can_take
                        ? t("attendance.take")
                        : t("attendance.view")}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
