import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Field } from "@/components/common";
import { ClassSelect, OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCurrentYear } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

import { invalidateSchooling } from "./api";

export type EnrollmentRef = {
  id: number;
  studentName: string;
  className: string;
  academicYearId: number;
  classId: number;
};

export type EnrollmentAction = "change_class" | "withdraw" | "cancel";

const today = () => new Date().toISOString().slice(0, 10);

function useSubmit(onDone: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (path: string, body: object, success: string) => {
    setBusy(true);
    try {
      await api.post(path, body);
      await invalidateSchooling(queryClient);
      toast.success(success);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function EnrollmentActionDialog({
  action,
  enrollment,
  onClose,
}: {
  action: EnrollmentAction;
  enrollment: EnrollmentRef;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useSubmit(onClose);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const titles = {
    change_class: t("enrollments.changeClass"),
    withdraw: t("enrollments.withdraw"),
    cancel: t("enrollments.cancel"),
  };
  const descriptions = {
    change_class: t("enrollments.changeClassBody", { name: enrollment.studentName, from: enrollment.className }),
    withdraw: t("enrollments.withdrawBody", { name: enrollment.studentName }),
    cancel: t("enrollments.cancelBody"),
  };
  const valid = action === "change_class" ? classId !== null && classId !== enrollment.classId : reason.trim() !== "";

  const submit = () => {
    const base = `/enrollments/${enrollment.id}`;
    if (action === "change_class") {
      void run(`${base}/change-class/`, { class_group: classId, date, reason }, t("enrollments.changed"));
    } else if (action === "withdraw") {
      void run(`${base}/withdraw/`, { date, reason, transfer_to: transferTo }, t("enrollments.withdrawn"));
    } else {
      void run(`${base}/cancel/`, { reason }, t("enrollments.cancelled"));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
          <DialogDescription>{descriptions[action]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {action === "change_class" && (
            <Field label={t("enrollments.newClass")} htmlFor="ea-class">
              <ClassSelect id="ea-class" yearId={enrollment.academicYearId} value={classId} onChange={setClassId} showPlaces />
            </Field>
          )}
          {action !== "cancel" && (
            <Field label={t("common.date")} htmlFor="ea-date">
              <Input id="ea-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          )}
          <Field
            label={action === "withdraw" ? t("enrollments.withdrawReason") : t("common.reason")}
            htmlFor="ea-reason"
          >
            <Input id="ea-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {action === "withdraw" && (
            <Field label={t("enrollments.transferTo")} htmlFor="ea-transfer">
              <Input id="ea-transfer" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant={action === "change_class" ? "default" : "destructive"} onClick={submit} disabled={busy || !valid}>
            {titles[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Enrol a student who already has a record (re-enrolment, or someone who left and came back). */
export function EnrolExistingDialog({
  studentId,
  studentName,
  onClose,
}: {
  studentId: number;
  studentName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const year = useCurrentYear();
  const { busy, run } = useSubmit(onClose);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState<"re_enrolment" | "new" | "transfer_in">("re_enrolment");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("students.enrolTitle", { name: studentName })}</DialogTitle>
          {year && <DialogDescription>{t("dashboard.yearLabel", { name: year.name })}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("enrollments.class")} htmlFor="ee-class">
            <ClassSelect id="ee-class" yearId={year?.id} value={classId} onChange={setClassId} showPlaces />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("common.date")} htmlFor="ee-date">
              <Input id="ee-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("enrollments.kind")} htmlFor="ee-kind">
              <OptionSelect
                id="ee-kind"
                value={kind}
                onChange={(v) => v && setKind(v)}
                options={(["re_enrolment", "new", "transfer_in"] as const).map((k) => ({ value: k, label: t(`kind.${k}`) }))}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || classId === null}
            onClick={() =>
              void run(
                "/enrollments/",
                { student: studentId, class_group: classId, enrollment_date: date, kind },
                t("students.enrolled"),
              )
            }
          >
            {t("students.enrol")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
