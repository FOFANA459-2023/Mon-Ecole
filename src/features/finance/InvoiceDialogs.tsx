import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { ClassSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StudentPicker } from "@/features/students/StudentPicker";
import { api } from "@/lib/api/client";
import type { GenerateInvoicesResult, Invoice, StudentListItem } from "@/lib/api/types";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { FINANCE_KEY, useFeeCategories, useMoney } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

export function GenerateInvoicesDialog({ defaultYearId, onClose }: { defaultYearId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [yearId, setYearId] = useState<number | null>(defaultYearId);
  const [classId, setClassId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!yearId) return;
    setBusy(true);
    try {
      const result = await api.post<GenerateInvoicesResult>("/invoices/generate/", {
        academic_year: yearId,
        class_group: classId,
      });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.generated", { count: result.created }), {
        description: [
          result.skipped ? t("finance.alreadyInvoiced", { count: result.skipped }) : "",
          result.without_fees ? t("finance.withoutFees", { count: result.without_fees }) : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
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
          <DialogTitle>{t("finance.generateTitle")}</DialogTitle>
          <DialogDescription>{t("finance.generateHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("classes.year")} htmlFor="g-year">
            <YearSelect id="g-year" value={yearId} onChange={(v) => (setYearId(v), setClassId(null))} />
          </Field>
          <Field label={t("classes.chooseClass")} htmlFor="g-class">
            <ClassSelect id="g-class" yearId={yearId} value={classId} onChange={setClassId} allLabel={t("classes.allClasses")} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !yearId}>
            {busy ? t("common.saving") : t("finance.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManualInvoiceDialog({
  defaultYearId,
  student: fixedStudent,
  onClose,
}: {
  defaultYearId: number | null;
  /** Invoice a known student (from their profile); otherwise a student is searched for. */
  student?: { id: number; full_name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const money = useMoney();
  const categories = (useFeeCategories().data ?? []).filter((c) => c.is_active);
  const [picked, setPicked] = useState<StudentListItem | null>(null);
  const student = fixedStudent ?? picked;
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      academic_year: z.number(required),
      issue_date: z.string().min(1, required),
      notes: z.string().max(1000),
      lines: z
        .array(
          z
            .object({
              category: z.number(required),
              description: z.string().trim().min(1, required).max(200),
              due_date: z.string().min(1, required),
              amount: z.number(required).positive(t("finance.positiveAmount")),
              discount: z.number(required).min(0),
            })
            .refine((line) => line.discount <= line.amount, {
              path: ["discount"],
              message: t("finance.discountTooLarge"),
            }),
        )
        .min(1),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      academic_year: defaultYearId ?? undefined,
      issue_date: today(),
      notes: "",
      lines: [{ description: "", due_date: today(), amount: 0, discount: 0 }] as Values["lines"],
    },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control, name: "lines" });
  const total = watched.reduce((sum, line) => sum + (Number(line.amount) || 0) - (Number(line.discount) || 0), 0);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!student) {
      toast.error(t("finance.chooseStudent"));
      return;
    }
    try {
      const invoice = await api.post<Invoice>("/invoices/", { ...values, student: student.id });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.invoiceIssued", { number: invoice.number }));
      onClose();
      navigate(`/finance/invoices/${invoice.id}`);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["academic_year", "issue_date", "notes"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("finance.newInvoice")}</DialogTitle>
          <DialogDescription>{fixedStudent?.full_name ?? t("finance.newInvoiceHint")}</DialogDescription>
        </DialogHeader>
        <form id="invoice-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          {!fixedStudent && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("finance.student")}</p>
              <StudentPicker selected={picked} onSelect={setPicked} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("classes.year")} htmlFor="i-year" error={errors.academic_year?.message}>
              <Controller
                control={form.control}
                name="academic_year"
                render={({ field }) => <YearSelect id="i-year" value={field.value ?? null} onChange={field.onChange} />}
              />
            </Field>
            <Field label={t("finance.issueDate")} htmlFor="i-date" error={errors.issue_date?.message}>
              <Input id="i-date" type="date" {...form.register("issue_date")} />
            </Field>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">{t("finance.lines")}</p>
            {lines.fields.map((line, index) => {
              const lineErrors = errors.lines?.[index];
              return (
                <div key={line.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_9rem]">
                  <Controller
                    control={form.control}
                    name={`lines.${index}.category`}
                    render={({ field }) => (
                      <OptionSelect
                        value={field.value ? String(field.value) : null}
                        onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                        options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                        placeholder={t("finance.category")}
                        aria-label={t("finance.category")}
                      />
                    )}
                  />
                  <Input
                    placeholder={t("finance.description")}
                    aria-label={t("finance.description")}
                    aria-invalid={Boolean(lineErrors?.description)}
                    {...form.register(`lines.${index}.description`)}
                  />
                  <Input
                    type="date"
                    aria-label={t("finance.dueDate")}
                    {...form.register(`lines.${index}.due_date`)}
                  />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:col-span-3">
                    <Field label={t("finance.amount")} htmlFor={`line-${index}-amount`} error={lineErrors?.amount?.message}>
                      <Input
                        id={`line-${index}-amount`}
                        type="number"
                        min={0}
                        step="any"
                        {...form.register(`lines.${index}.amount`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Field
                      label={t("finance.discount")}
                      htmlFor={`line-${index}-discount`}
                      error={lineErrors?.discount?.message}
                    >
                      <Input
                        id={`line-${index}-discount`}
                        type="number"
                        min={0}
                        step="any"
                        {...form.register(`lines.${index}.discount`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="self-end"
                      aria-label={t("common.remove")}
                      disabled={lines.fields.length === 1}
                      onClick={() => lines.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {(lineErrors?.category || lineErrors?.description) && (
                    <p className="text-destructive text-xs sm:col-span-3">
                      {lineErrors.category?.message ?? lineErrors.description?.message}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  lines.append({ description: "", due_date: today(), amount: 0, discount: 0 } as Values["lines"][number])
                }
              >
                <Plus /> {t("finance.addLine")}
              </Button>
              <p className="text-sm">
                {t("common.total")} : <span className="font-semibold tabular-nums">{money.format(total)}</span>
              </p>
            </div>
          </div>
          <Field label={t("common.notes")} htmlFor="i-notes" error={errors.notes?.message}>
            <Textarea id="i-notes" rows={2} {...form.register("notes")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="invoice-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("finance.issue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelInvoiceDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/invoices/${invoice.id}/cancel/`, { reason });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.invoiceCancelled", { number: invoice.number }));
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
          <DialogTitle>{t("finance.cancelInvoice", { number: invoice.number })}</DialogTitle>
          <DialogDescription>{t("finance.cancelInvoiceHint")}</DialogDescription>
        </DialogHeader>
        <Field label={t("common.reason")} htmlFor="c-reason">
          <Textarea id="c-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.close")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? t("common.saving") : t("finance.confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
