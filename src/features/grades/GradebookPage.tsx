import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Info, LockOpen, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Field, PageHeader, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { GradebookDetail } from "@/lib/api/types";
import { errorMessage } from "@/lib/forms";

import { GRADES_KEY, useGradebook, useGradebookSheet } from "./api";
import { GradebookStatusBadge } from "./GradebookStatusBadge";
import { MarksGrid } from "./MarksGrid";
import { RulesPanel } from "./RulesPanel";

type Step = "submit" | "publish" | "send-back" | "reopen";

function ReasonDialog({
  step,
  gradebook,
  onDone,
  onClose,
}: {
  step: "send-back" | "reopen";
  gradebook: GradebookDetail;
  onDone: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/gradebooks/${gradebook.id}/${step}/`, { reason });
      await onDone();
      toast.success(t(`grades.done.${step}`));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`grades.steps.${step}`)}</DialogTitle>
          <DialogDescription>{t(`grades.confirm.${step}`)}</DialogDescription>
        </DialogHeader>
        <Field label={t("common.reason")} htmlFor="gb-reason">
          <Textarea id="gb-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !reason.trim()}>
            {busy ? t("common.saving") : t(`grades.steps.${step}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GradebookPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const gradebookId = id ? Number(id) : undefined;
  const gradebook = useGradebook(gradebookId);
  const sheet = useGradebookSheet(gradebookId);
  const [step, setStep] = useState<Step | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });

  if (gradebook.isError) return <QueryError error={gradebook.error} onRetry={() => void gradebook.refetch()} />;
  if (gradebook.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  const book = gradebook.data;
  const { can } = book;
  const tab = params.get("tab") ?? (book.assessments.length === 0 && can.edit ? "rules" : "marks");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to={`/assessments?term=${book.term}`}>
          <ArrowLeft /> {t("grades.backToList")}
        </Link>
      </Button>
      <PageHeader
        title={`${book.subject_name} — ${book.class_name}`}
        description={[
          book.term_name,
          book.teacher_name || t("grades.noTeacher"),
          t("grades.coefficientShort", { value: Number(book.coefficient) }),
        ].join(" · ")}
        actions={
          <>
            <GradebookStatusBadge status={book.status} className="self-center" />
            {can.submit && (
              <Button onClick={() => setStep("submit")}>
                <Send /> {t("grades.steps.submit")}
              </Button>
            )}
            {can.send_back && (
              <Button variant="outline" onClick={() => setStep("send-back")}>
                <Undo2 /> {t("grades.steps.send-back")}
              </Button>
            )}
            {can.publish && (
              <Button onClick={() => setStep("publish")}>
                <CheckCircle2 /> {t("grades.steps.publish")}
              </Button>
            )}
            {can.reopen && (
              <Button variant="outline" onClick={() => setStep("reopen")}>
                <LockOpen /> {t("grades.steps.reopen")}
              </Button>
            )}
          </>
        }
      />

      {book.status === "open" && book.status_note && (
        <Alert className="mb-4">
          <Info />
          <AlertDescription>{t("grades.returnedNote", { note: book.status_note })}</AlertDescription>
        </Alert>
      )}
      {book.status !== "open" && (
        <Alert className="mb-4">
          <Info />
          <AlertDescription>{t(`grades.lockedNote.${book.status}`)}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="marks">{t("grades.tabs.marks")}</TabsTrigger>
          <TabsTrigger value="rules">{t("grades.tabs.rules")}</TabsTrigger>
        </TabsList>
        <TabsContent value="marks">
          {sheet.isError ? (
            <QueryError onRetry={() => void sheet.refetch()} />
          ) : sheet.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : (
            <MarksGrid gradebook={book} sheet={sheet.data} />
          )}
        </TabsContent>
        <TabsContent value="rules">
          <RulesPanel gradebook={book} />
        </TabsContent>
      </Tabs>

      {(step === "submit" || step === "publish") && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setStep(null)}
          title={t(`grades.steps.${step}`)}
          description={t(`grades.confirm.${step}`)}
          confirmLabel={t(`grades.steps.${step}`)}
          onConfirm={async () => {
            try {
              await api.post(`/gradebooks/${book.id}/${step}/`);
              await refresh();
              toast.success(t(`grades.done.${step}`));
            } catch (error) {
              toast.error(errorMessage(error, t));
            }
          }}
        />
      )}
      {(step === "send-back" || step === "reopen") && (
        <ReasonDialog step={step} gradebook={book} onDone={refresh} onClose={() => setStep(null)} />
      )}
    </>
  );
}
