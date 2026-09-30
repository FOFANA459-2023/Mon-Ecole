import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCashChoice } from "@/features/cash/api";
import { CashSessionNotice } from "@/features/cash/CashSessionNotice";
import { api } from "@/lib/api/client";
import type { PaymentMethod } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

import { FINANCE_KEY, PAYMENT_METHODS, useMoney } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

/** Give a family back some of the student's credit (never more than the credit). */
export function RefundDialog({
  student,
  credit,
  onClose,
}: {
  student: { id: number; full_name: string };
  credit: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const money = useMoney();
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      amount: z
        .number(required)
        .positive(t("finance.positiveAmount"))
        .max(credit, t("finance.refundAtMost", { amount: money.format(credit) })),
      date: z
        .string()
        .min(1, required)
        .refine((value) => value <= today(), t("finance.noFutureDate")),
      method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], required),
      reference: z.string().trim().max(100),
      reason: z.string().trim().min(1, required).max(255),
    });
  }, [t, credit, money]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: credit, date: today(), method: "cash", reference: "", reason: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const method = useWatch({ control: form.control, name: "method" });
  const cash = useCashChoice(method === "cash");

  const onSubmit = form.handleSubmit(async (values) => {
    if (cash.blocked) return;
    try {
      await api.post("/refunds/", { ...values, student: student.id, ...cash.payload });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.refundRecorded", { amount: money.format(values.amount), name: student.full_name }));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["amount", "date", "method", "reference", "reason"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance.refundCredit")}</DialogTitle>
          <DialogDescription>
            {t("finance.refundHint", { name: student.full_name, amount: money.format(credit) })}
          </DialogDescription>
        </DialogHeader>
        <form id="refund-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("finance.amountFor", { currency: money.currency })} htmlFor="f-amount" error={errors.amount?.message}>
            <Input id="f-amount" type="number" min={0} step="any" {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.refundDate")} htmlFor="f-date" error={errors.date?.message}>
              <Input id="f-date" type="date" max={today()} {...form.register("date")} />
            </Field>
            <Field label={t("finance.method")} htmlFor="f-method" error={errors.method?.message}>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <OptionSelect<PaymentMethod>
                    id="f-method"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
                  />
                )}
              />
            </Field>
          </div>
          <Field label={t("common.reason")} htmlFor="f-reason" error={errors.reason?.message}>
            <Input id="f-reason" {...form.register("reason")} placeholder={t("finance.refundReasonPlaceholder")} />
          </Field>
          <Field label={t("finance.reference")} htmlFor="f-reference" error={errors.reference?.message}>
            <Input id="f-reference" {...form.register("reference")} />
          </Field>
          <CashSessionNotice choice={cash} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="refund-form" disabled={isSubmitting || cash.blocked}>
            {isSubmitting ? t("common.saving") : t("finance.refund")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
