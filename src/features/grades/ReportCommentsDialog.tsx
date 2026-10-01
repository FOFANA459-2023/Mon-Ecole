import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { QueryError, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

import { GRADES_KEY, useReportComments } from "./api";

/** The general comment on each student's report card (class teacher or school management). */
export function ReportCommentsDialog({
  classId,
  termId,
  periodName,
  onClose,
}: {
  classId: number;
  /** Null = the year's (annual) report card. */
  termId: number | null;
  periodName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rows = useReportComments(classId, termId);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const changed = (rows.data ?? []).filter((r) => r.enrollment in drafts && drafts[r.enrollment] !== r.comment);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/report-comments/", {
        class_group: classId,
        term: termId,
        comments: changed.map((r) => ({ enrollment: r.enrollment, comment: drafts[r.enrollment] })),
      });
      await queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("grades.comments.title", { period: periodName })}</DialogTitle>
          <DialogDescription>{t("grades.comments.hint")}</DialogDescription>
        </DialogHeader>
        {rows.isError ? (
          <QueryError error={rows.error} onRetry={() => void rows.refetch()} />
        ) : rows.isPending ? (
          <Spinner className="mx-auto my-6 size-6" />
        ) : (
          <div className="grid gap-3">
            {rows.data.map((row) => (
              <label key={row.enrollment} className="grid gap-1 text-sm font-medium">
                {row.student_name}
                <Textarea
                  rows={2}
                  maxLength={600}
                  value={drafts[row.enrollment] ?? row.comment}
                  onChange={(e) => setDrafts((current) => ({ ...current, [row.enrollment]: e.target.value }))}
                  placeholder={t("grades.comments.placeholder")}
                />
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving || changed.length === 0}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
