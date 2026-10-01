import { CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import { ApiError } from "@/lib/api/client";
import { useFormatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { STATUS_STYLES, STATUSES, useStudentAttendance } from "./api";

/** The "Attendance" tab of a student's profile: this year's totals and every absence or lateness. */
export function StudentAttendanceTab({ studentId }: { studentId: number }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const year = useCurrentYear();
  const summary = useStudentAttendance(studentId, year?.id ?? null);

  if (summary.isError) {
    if (summary.error instanceof ApiError && summary.error.status === 404) {
      return (
        <Card>
          <EmptyState icon={<CalendarCheck className="size-8" />} title={t("attendance.noRegistersForStudent")} />
        </Card>
      );
    }
    return <QueryError onRetry={() => void summary.refetch()} />;
  }
  if (summary.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  const data = summary.data;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="gap-1 p-4">
          <p className="text-muted-foreground text-xs">{t("attendance.daysRecorded")}</p>
          <p className="text-2xl font-semibold tabular-nums">{data.days}</p>
        </Card>
        {STATUSES.map((status) => (
          <Card key={status} className="gap-1 p-4">
            <p className="text-muted-foreground text-xs">{t(`attendance.status.${status}`)}</p>
            <p className={cn("text-2xl font-semibold tabular-nums", status === "absent" && data.absent > 0 && "text-destructive")}>
              {data[status]}
            </p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("attendance.eventsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("attendance.noEvents")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("grades.class")}</TableHead>
                    <TableHead>{t("common.notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.map((event) => (
                    <TableRow key={`${event.date}-${event.class_name}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(event.date)}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLES[event.status].soft)}>
                          {t(`attendance.status.${event.status}`)}
                          {event.minutes_late ? ` · ${t("attendance.minutesShort", { count: event.minutes_late })}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{event.class_name}</TableCell>
                      <TableCell className="text-muted-foreground">{event.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
