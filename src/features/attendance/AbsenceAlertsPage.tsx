import { useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { EmptyState, Field, Pagination, QueryError, Spinner } from "@/components/common";
import { ClassSelect, OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentYear } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { AbsenceAlert, AbsenceAlertStatus } from "@/lib/api/types";
import { useFormatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { ATTENDANCE_KEY, useAbsenceAlerts } from "./api";

const PAGE_SIZE = 25;
const STATUSES: AbsenceAlertStatus[] = ["open", "followed_up", "cleared"];
const DEFAULTS = { status: "open", class: "", page: "1" };

/**
 * High absenteeism: students who reached the school's number of unexcused absences, raised every evening
 * from the registers. Whoever follows one up (a call to the family, a meeting) closes it with a note.
 */
export function AbsenceAlertsPage() {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const status = (STATUSES.includes(filters.status as AbsenceAlertStatus) ? filters.status : "open") as AbsenceAlertStatus;
  const classId = toNumberOrNull(filters.class);
  const page = Math.max(1, Number(filters.page) || 1);
  const alerts = useAbsenceAlerts({ status, class_group: classId, page });
  const [following, setFollowing] = useState<AbsenceAlert | null>(null);

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">{t("attendance.alerts.intro")}</p>
      <div className="grid gap-3 sm:grid-cols-[14rem_16rem]">
        <Field label={t("attendance.alerts.show")} htmlFor="al-status">
          <OptionSelect<AbsenceAlertStatus>
            id="al-status"
            value={status}
            onChange={(v) => v && setFilters({ status: v, page: "1" })}
            options={STATUSES.map((s) => ({ value: s, label: t(`attendance.alerts.statuses.${s}`) }))}
          />
        </Field>
        <Field label={t("classes.chooseClass")} htmlFor="al-class">
          <ClassSelect
            id="al-class"
            yearId={currentYear?.id}
            value={classId}
            onChange={(v) => setFilters({ class: v ? String(v) : "", page: "1" })}
            allLabel={t("classes.allClasses")}
          />
        </Field>
      </div>

      {alerts.isError ? (
        <QueryError error={alerts.error} onRetry={() => void alerts.refetch()} />
      ) : alerts.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : alerts.data.results.length === 0 ? (
        <Card>
          <EmptyState icon={<BellRing className="size-8" />} title={t(`attendance.alerts.none.${status}`)} />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("grades.student")}</TableHead>
                <TableHead className="text-right">{t("attendance.alerts.absences")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("attendance.alerts.period")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {status === "open" ? t("attendance.alerts.raised") : t("attendance.alerts.closed")}
                </TableHead>
                {status === "open" && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.data.results.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Link to={`/students/${alert.student}?tab=attendance`} className="font-medium hover:underline">
                      {alert.student_name}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {alert.class_name} · {alert.student_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-destructive text-right font-semibold tabular-nums">{alert.absences}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {t("attendance.alerts.between", { from: formatDate(alert.since), to: formatDate(alert.last_absence) })}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {status === "open" ? (
                      formatDate(alert.raised_on)
                    ) : (
                      <>
                        {formatDate(alert.closed_on)}
                        {alert.closed_by_name && ` · ${alert.closed_by_name}`}
                        {alert.note && <span className="text-muted-foreground block text-xs">{alert.note}</span>}
                      </>
                    )}
                  </TableCell>
                  {status === "open" && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setFollowing(alert)}>
                        {t("attendance.alerts.followUp")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {alerts.data.count > PAGE_SIZE && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={alerts.data.count}
              onPageChange={(next) => setFilters({ page: String(next) })}
            />
          )}
        </Card>
      )}
      {following && <FollowUpDialog alert={following} onClose={() => setFollowing(null)} />}
    </div>
  );
}

function FollowUpDialog({ alert, onClose }: { alert: AbsenceAlert; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/attendance/alerts/${alert.id}/follow-up/`, { note: note.trim() });
      await queryClient.invalidateQueries({ queryKey: [ATTENDANCE_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("attendance.alerts.followUpTitle", { name: alert.student_name })}</DialogTitle>
          <DialogDescription>
            {t("attendance.alerts.followUpHint", { count: alert.absences })}
          </DialogDescription>
        </DialogHeader>
        <Field label={t("attendance.alerts.note")} htmlFor="al-note">
          <Textarea
            id="al-note"
            maxLength={255}
            rows={3}
            value={note}
            placeholder={t("attendance.alerts.notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving || note.trim() === ""}>
            {t("attendance.alerts.markFollowedUp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
