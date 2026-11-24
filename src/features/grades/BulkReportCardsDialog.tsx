import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Download, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Field } from "@/components/common";
import { LevelSelect, OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api/client";
import type { Job } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";
import { downloadJobResult, jobPercent, useJob } from "@/lib/jobs";

import { GRADES_KEY } from "./api";

type Scope = "class" | "level" | "school";
type Period = "term" | "year";

/**
 * Report cards for a class, a level or the whole school, made in the background: the dialog follows the
 * job's progress and offers the file (one PDF, or a ZIP with one PDF per class) when it is ready.
 */
export function BulkReportCardsDialog({
  yearId,
  classId,
  levelId,
  termId,
  termName,
  onClose,
}: {
  yearId: number;
  classId: number;
  levelId: number | null;
  termId: number;
  termName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const seesAll = can("classes.view_all");
  const [scope, setScope] = useState<Scope>("class");
  const [level, setLevel] = useState<number | null>(levelId);
  const [period, setPeriod] = useState<Period>("term");
  const [jobId, setJobId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const job = useJob(jobId).data;

  const start = async () => {
    setStarting(true);
    try {
      const created = await api.post<Job>("/report-cards/jobs/", {
        academic_year: yearId,
        term: period === "term" ? termId : null,
        class_group: scope === "class" ? classId : null,
        level: scope === "level" ? level : null,
      });
      setJobId(created.id ?? null);
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setStarting(false);
    }
  };

  const status = job?.status;
  useEffect(() => {
    // New versions appear in the students' lists of issued report cards.
    if (status === "done") void queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
  }, [status, queryClient]);
  const outcome = (job?.outcome ?? {}) as { cards?: number; new?: number; classes?: number };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("grades.bulk.title")}</DialogTitle>
          <DialogDescription>{t("grades.bulk.hint")}</DialogDescription>
        </DialogHeader>
        {jobId === null ? (
          <div className="grid gap-4">
            <Field label={t("grades.bulk.scope")} htmlFor="bulk-scope">
              <OptionSelect<Scope>
                id="bulk-scope"
                value={scope}
                onChange={(v) => v && setScope(v)}
                options={[
                  { value: "class", label: t("grades.bulk.thisClass") },
                  ...(seesAll
                    ? [
                        { value: "level" as const, label: t("grades.bulk.level") },
                        { value: "school" as const, label: t("grades.bulk.school") },
                      ]
                    : []),
                ]}
              />
            </Field>
            {scope === "level" && (
              <Field label={t("classes.level")} htmlFor="bulk-level">
                <LevelSelect id="bulk-level" value={level} onChange={setLevel} />
              </Field>
            )}
            <Field label={t("grades.bulk.period")} htmlFor="bulk-period">
              <OptionSelect<Period>
                id="bulk-period"
                value={period}
                onChange={(v) => v && setPeriod(v)}
                options={[
                  { value: "term", label: termName },
                  { value: "year", label: t("grades.cards.year") },
                ]}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3" aria-live="polite">
            {job?.status === "failed" ? (
              <p className="text-destructive flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t("grades.bulk.failed")}
              </p>
            ) : job?.status === "done" ? (
              <p className="flex items-start gap-2 text-sm">
                <CircleCheck className="text-success mt-0.5 size-4 shrink-0" />
                {t("grades.bulk.done", { count: outcome.cards ?? 0, fresh: outcome.new ?? 0 })}
              </p>
            ) : (
              <>
                <Progress value={jobPercent(job)} aria-label={t("grades.bulk.progress")} />
                <p className="text-muted-foreground text-sm tabular-nums">
                  {job && job.total
                    ? t("grades.bulk.progressCount", { done: job.done ?? 0, total: job.total })
                    : t("grades.bulk.queued")}
                </p>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          {jobId === null && (
            <Button onClick={() => void start()} disabled={starting || (scope === "level" && level === null)}>
              {t("grades.bulk.start")}
            </Button>
          )}
          {job?.status === "done" && job.has_result && (
            <Button
              onClick={() => downloadJobResult(job).catch((error) => toast.error(errorMessage(error, t)))}
            >
              <Download /> {t("grades.bulk.download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
