import { useQueryClient } from "@tanstack/react-query";
import { Save, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { StaffAttendanceStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";
import { useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { ATTENDANCE_KEY, STAFF_STATUSES, STATUS_STYLES, todayIn, useStaffSheet } from "./api";

type Entry = { status: StaffAttendanceStatus; minutes_late: number | null; note: string };

/** Who came to work: one row per member of staff, present unless marked otherwise. */
export function StaffAttendancePage() {
  const { t } = useTranslation();
  const { membership } = useAuth();
  const queryClient = useQueryClient();
  const today = todayIn(membership?.school.timezone);
  const [filters, setFilters] = useUrlState({ date: "" });
  const date = filters.date || today;
  const sheet = useStaffSheet(date);
  const [changes, setChanges] = useState<{ date: string; entries: Record<number, Entry> } | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = useMemo(
    () =>
      Object.fromEntries(
        (sheet.data?.staff ?? []).map((s) => [s.staff, { status: s.status, minutes_late: s.minutes_late, note: s.note }]),
      ) as Record<number, Entry>,
    [sheet.data],
  );
  const current = changes?.date === date ? changes.entries : saved;
  const recorded = (sheet.data?.staff ?? []).some((s) => s.recorded);
  const dirty = changes?.date === date && JSON.stringify(changes.entries) !== JSON.stringify(saved);
  const update = (staff: number, change: Partial<Entry>) =>
    setChanges({ date, entries: { ...current, [staff]: { ...current[staff], ...change } } });

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/attendance/staff/", {
        date,
        entries: Object.entries(current).map(([staff, entry]) => ({
          staff: Number(staff),
          status: entry.status,
          minutes_late: entry.status === "late" ? entry.minutes_late || null : null,
          note: entry.note,
        })),
      });
      await queryClient.invalidateQueries({ queryKey: [ATTENDANCE_KEY] });
      setChanges(null);
      toast.success(t("attendance.saved"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setSaving(false);
    }
  };

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
        <Button onClick={() => void save()} disabled={saving || (recorded && !dirty) || !sheet.data?.staff.length}>
          <Save /> {saving ? t("common.saving") : t("attendance.saveStaff")}
        </Button>
      </div>
      {!recorded && sheet.data && sheet.data.staff.length > 0 && (
        <p className="text-muted-foreground text-sm">{t("attendance.staffNotRecorded")}</p>
      )}
      {sheet.isError ? (
        <QueryError onRetry={() => void sheet.refetch()} />
      ) : sheet.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : sheet.data.staff.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-8" />} title={t("attendance.noStaff")} />
        </Card>
      ) : (
        <Card className="gap-0 divide-y py-0">
          {sheet.data.staff.map((person) => {
            const entry = current[person.staff];
            return (
              <div key={person.staff} className="grid gap-2 px-3 py-2.5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{person.full_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {person.position || t(`staffType.${person.staff_type}`, { defaultValue: person.staff_type })}
                  </p>
                </div>
                <div
                  className="grid grid-cols-5 gap-1.5 md:w-[28rem]"
                  role="radiogroup"
                  aria-label={t("attendance.statusOf", { name: person.full_name })}
                >
                  {STAFF_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={entry.status === status}
                      onClick={() => update(person.staff, { status })}
                      className={cn(
                        "h-9 rounded-md border text-xs font-medium transition-colors",
                        entry.status === status ? STATUS_STYLES[status].on : "bg-background hover:bg-muted text-muted-foreground",
                      )}
                    >
                      {t(`attendance.status.${status}`)}
                    </button>
                  ))}
                </div>
                {(entry.status !== "present" || entry.note) && (
                  <div className="grid grid-cols-[6.5rem_1fr] gap-2 md:col-span-2">
                    {entry.status === "late" ? (
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        aria-label={t("attendance.minutesLateOf", { name: person.full_name })}
                        placeholder={t("attendance.minutes")}
                        value={entry.minutes_late ?? ""}
                        onChange={(e) => update(person.staff, { minutes_late: e.target.value ? Number(e.target.value) : null })}
                      />
                    ) : (
                      <span />
                    )}
                    <Input
                      aria-label={t("attendance.noteOf", { name: person.full_name })}
                      placeholder={t("attendance.notePlaceholder")}
                      maxLength={255}
                      value={entry.note}
                      onChange={(e) => update(person.staff, { note: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
