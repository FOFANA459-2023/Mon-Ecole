import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PageHeader, QueryError, Spinner } from "@/components/common";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormatDateTime } from "@/features/cash/api";
import { api } from "@/lib/api/client";
import type { AttendanceStatus, RegisterSheet } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { ATTENDANCE_KEY, STATUS_STYLES, STATUSES, todayIn, useRegister } from "./api";

type Mark = { status: AttendanceStatus; minutes_late: number | null; note: string };

function marksOf(sheet: RegisterSheet): Record<number, Mark> {
  return Object.fromEntries(
    sheet.students.map((s) => [s.enrollment, { status: s.status, minutes_late: s.minutes_late, note: s.note }]),
  );
}

/** One class's register for one day, made for a phone: everyone starts present, tap to mark the others. */
export function RegisterPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { membership } = useAuth();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const { dateTime } = useFormatDateTime();
  const today = todayIn(membership?.school.timezone);
  const date = params.get("date") || today;
  const classId = id ? Number(id) : undefined;
  const register = useRegister(classId, date);
  const [marks, setMarks] = useState<Record<number, Mark> | null>(null);
  const [saving, setSaving] = useState(false);

  const sheet = register.data;
  const saved = useMemo(() => (sheet ? marksOf(sheet) : {}), [sheet]);
  const current = marks ?? saved;
  const dirty = marks !== null && JSON.stringify(marks) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (register.isError) return <QueryError error={register.error} onRetry={() => void register.refetch()} />;
  if (register.isPending || !sheet) return <Spinner className="mx-auto my-10 size-6" />;

  const editable = sheet.can_edit;
  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, Object.values(current).filter((m) => m.status === status).length]),
  ) as Record<AttendanceStatus, number>;
  const update = (enrollment: number, change: Partial<Mark>) =>
    setMarks({ ...current, [enrollment]: { ...current[enrollment], ...change } });

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/attendance/register/", {
        class_group: sheet.class_group,
        date,
        records: sheet.students.map((s) => {
          const mark = current[s.enrollment];
          return {
            enrollment: s.enrollment,
            status: mark.status,
            minutes_late: mark.status === "late" ? mark.minutes_late || null : null,
            note: mark.note,
          };
        }),
      });
      await queryClient.invalidateQueries({ queryKey: [ATTENDANCE_KEY] });
      setMarks(null);
      toast.success(t("attendance.saved"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to={date === today ? "/attendance" : `/attendance?date=${date}`}>
          <ArrowLeft /> {t("attendance.backToDay")}
        </Link>
      </Button>
      <PageHeader
        title={t("attendance.registerTitle", { name: sheet.class_name })}
        description={formatDate(date) + (date === today ? ` · ${t("attendance.today")}` : "")}
      />

      {sheet.register ? (
        <p className="text-muted-foreground mb-3 text-sm">
          {t("attendance.takenBy", { name: sheet.taken_by_name, time: sheet.taken_at ? dateTime(sheet.taken_at) : "" })}
          {sheet.updated_at && ` · ${t("attendance.changedBy", { name: sheet.updated_by_name, time: dateTime(sheet.updated_at) })}`}
        </p>
      ) : (
        editable && <p className="text-muted-foreground mb-3 text-sm">{t("attendance.everyonePresent")}</p>
      )}
      {!editable && (
        <Alert className="mb-4">
          <Info />
          <AlertDescription>
            {date < today && sheet.can_take_today ? t("attendance.pastLocked") : t("attendance.readOnly")}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5" role="status" aria-label={t("attendance.summary")}>
        {STATUSES.map((status) => (
          <span key={status} className={cn("rounded-md px-2 py-1 text-xs font-medium", STATUS_STYLES[status].soft)}>
            {t(`attendance.counts.${status}`, { count: counts[status] })}
          </span>
        ))}
      </div>

      <Card className="gap-0 divide-y py-0">
        {sheet.students.map((student) => {
          const mark = current[student.enrollment];
          return (
            <div key={student.enrollment} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{student.student_name}</p>
                <p className="text-muted-foreground text-xs">{student.student_number}</p>
              </div>
              <div
                className="grid grid-cols-4 gap-1.5 sm:w-96"
                role="radiogroup"
                aria-label={t("attendance.statusOf", { name: student.student_name })}
              >
                {STATUSES.map((status) => {
                  const selected = mark.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!editable}
                      onClick={() => update(student.enrollment, { status })}
                      className={cn(
                        "h-10 rounded-md border text-xs font-medium transition-colors disabled:cursor-default",
                        selected ? STATUS_STYLES[status].on : "bg-background hover:bg-muted text-muted-foreground",
                        !editable && !selected && "opacity-50",
                      )}
                    >
                      {t(`attendance.status.${status}`)}
                    </button>
                  );
                })}
              </div>
              {(mark.status !== "present" || mark.note) && (
                <div className="grid grid-cols-[6.5rem_1fr] gap-2 sm:col-span-2">
                  {mark.status === "late" ? (
                    <Input
                      type="number"
                      min={1}
                      max={600}
                      inputMode="numeric"
                      aria-label={t("attendance.minutesLateOf", { name: student.student_name })}
                      placeholder={t("attendance.minutes")}
                      disabled={!editable}
                      value={mark.minutes_late ?? ""}
                      onChange={(e) =>
                        update(student.enrollment, { minutes_late: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  ) : (
                    <span />
                  )}
                  <Input
                    aria-label={t("attendance.noteOf", { name: student.student_name })}
                    placeholder={t("attendance.notePlaceholder")}
                    maxLength={255}
                    disabled={!editable}
                    value={mark.note}
                    onChange={(e) => update(student.enrollment, { note: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {editable && (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t p-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-2">
            {dirty && (
              <Button variant="ghost" onClick={() => setMarks(null)} disabled={saving}>
                <RotateCcw /> {t("attendance.undo")}
              </Button>
            )}
            <Button onClick={() => void save()} disabled={saving || (!dirty && sheet.register !== null)} className="min-w-40">
              <Save /> {saving ? t("common.saving") : sheet.register ? t("attendance.saveChanges") : t("attendance.saveRegister")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
