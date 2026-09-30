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
import type { Expense, ExpenseCategory, PaymentMethod } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

import { EXPENSE_CATEGORIES, FINANCE_KEY, PAYMENT_METHODS, useMoney } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const money = useMoney();
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      date: z
        .string()
        .min(1, required)
        .refine((value) => value <= today(), t("finance.noFutureDate")),
      category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]], required),
      amount: z.number(required).positive(t("finance.positiveAmount")),
      method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], required),
      payee: z.string().trim().max(150),
      reference: z.string().trim().max(100),
      description: z.string().trim().min(1, required).max(255),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: today(), method: "cash", payee: "", reference: "", description: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const method = useWatch({ control: form.control, name: "method" });
  const cash = useCashChoice(method === "cash");

  const onSubmit = form.handleSubmit(async (values) => {
    if (cash.blocked) return;
    try {
      const expense = await api.post<Expense>("/expenses/", { ...values, ...cash.payload });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.expenseRecorded", { number: expense.number }));
      onClose();
    } catch (error) {
      const message = applyApiErrors(
        error,
        form.setError,
        ["date", "category", "amount", "method", "payee", "reference", "description"],
        t,
      );
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("finance.recordExpense")}</DialogTitle>
          <DialogDescription>{t("finance.recordExpenseHint")}</DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label={t("finance.description")} htmlFor="e-description" error={errors.description?.message} className="sm:col-span-2">
            <Input id="e-description" {...form.register("description")} placeholder={t("finance.expensePlaceholder")} />
          </Field>
          <Field label={t("finance.expenseCategory")} htmlFor="e-category" error={errors.category?.message}>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <OptionSelect<ExpenseCategory>
                  id="e-category"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`finance.expenseCategories.${c}`) }))}
                  placeholder={t("finance.chooseCategory")}
                />
              )}
            />
          </Field>
          <Field label={t("finance.amountFor", { currency: money.currency })} htmlFor="e-amount" error={errors.amount?.message}>
            <Input id="e-amount" type="number" min={0} step="any" {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <Field label={t("finance.expenseDate")} htmlFor="e-date" error={errors.date?.message}>
            <Input id="e-date" type="date" max={today()} {...form.register("date")} />
          </Field>
          <Field label={t("finance.method")} htmlFor="e-method" error={errors.method?.message}>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <OptionSelect<PaymentMethod>
                  id="e-method"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
                />
              )}
            />
          </Field>
          <Field label={t("finance.payee")} htmlFor="e-payee" error={errors.payee?.message}>
            <Input id="e-payee" {...form.register("payee")} />
          </Field>
          <Field label={t("finance.reference")} htmlFor="e-reference" error={errors.reference?.message}>
            <Input id="e-reference" {...form.register("reference")} />
          </Field>
          <div className="sm:col-span-2">
            <CashSessionNotice choice={cash} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="expense-form" disabled={isSubmitting || cash.blocked}>
            {isSubmitting ? t("common.saving") : t("finance.recordExpense")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
