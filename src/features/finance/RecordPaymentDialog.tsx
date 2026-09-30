import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Spinner } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentPicker } from "@/features/students/StudentPicker";
import { api } from "@/lib/api/client";
import type { OpenLine, Payment, PaymentMethod, StudentListItem } from "@/lib/api/types";
import { useFormatDate } from "@/lib/dates";
import { applyApiErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { allocateOldestFirst, total } from "./allocation";
import { FINANCE_KEY, PAYMENT_METHODS, useMoney, useStudentAccount } from "./api";
import { printReceipt } from "./receipt";

const today = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentDialog({
  student: fixedStudent,
  invoice,
  onClose,
}: {
  /** Pay for a known student (from their profile or an invoice); otherwise a student is searched for. */
  student?: { id: number; full_name: string };
  /** Pay this invoice's lines only (from the invoice page). */
  invoice?: { id: number; number: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const money = useMoney();
  const [picked, setPicked] = useState<StudentListItem | null>(null);
  const student = fixedStudent ?? picked;
  const account = useStudentAccount(student?.id ?? null);
  // "auto": oldest due first. "manual": the accountant types what each line gets.
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [manual, setManual] = useState<Record<number, string>>({});

  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      amount: z.number(required).positive(t("finance.positiveAmount")),
      date: z
        .string()
        .min(1, required)
        .refine((value) => value <= today(), t("finance.noFutureDate")),
      method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], required),
      reference: z.string().trim().max(100),
      payer_name: z.string().trim().max(150),
      note: z.string().trim().max(255),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: today(), method: "cash", reference: "", payer_name: "", note: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const amount = Number(useWatch({ control: form.control, name: "amount" })) || 0;
  const method = useWatch({ control: form.control, name: "method" });

  const lines: OpenLine[] = useMemo(
    () => (account.data?.open_lines ?? []).filter((line) => !invoice || line.invoice === invoice.id),
    [account.data, invoice],
  );
  const due = total(
    lines.map((line) => Number(line.balance)),
    money.currency,
  );
  const auto = allocateOldestFirst(amount, lines, money.currency);
  const planned = new Map<number, number>(
    mode === "auto" ? auto : lines.map((line) => [line.id, Number(manual[line.id]) || 0]),
  );
  const allocated = total(planned.values(), money.currency);
  const credit = Math.max(0, total([amount, -allocated], money.currency));
  const tooMuchOnLine = mode === "manual" && lines.some((line) => (planned.get(line.id) ?? 0) > Number(line.balance));
  const overAllocated = allocated > amount;
  const invalidPlan = tooMuchOnLine || overAllocated || [...planned.values()].some((value) => value < 0);

  const chooseLines = () => {
    setManual(Object.fromEntries(lines.map((line) => [line.id, auto.get(line.id) ? String(auto.get(line.id)) : ""])));
    setMode("manual");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!student) {
      toast.error(t("finance.chooseStudent"));
      return;
    }
    if (invalidPlan) return;
    // The server allocates oldest first by itself; explicit lines are sent when chosen or limited to an invoice.
    const explicit = mode === "manual" || invoice !== undefined;
    try {
      const payment = await api.post<Payment>("/payments/", {
        ...values,
        student: student.id,
        ...(explicit && {
          allocations: [...planned.entries()]
            .filter(([, value]) => value > 0)
            .map(([invoice_line, value]) => ({ invoice_line, amount: value })),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.paymentRecorded", { number: payment.number }), {
        action: { label: t("finance.printReceipt"), onClick: () => printReceipt(payment, t) },
        duration: 10_000,
      });
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["amount", "date", "method", "reference", "payer_name", "note"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("finance.recordPayment")}</DialogTitle>
          <DialogDescription>
            {fixedStudent
              ? invoice
                ? t("finance.paymentForInvoice", { name: fixedStudent.full_name, number: invoice.number })
                : fixedStudent.full_name
              : t("finance.recordPaymentHint")}
          </DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          {!fixedStudent && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("finance.student")}</p>
              <StudentPicker selected={picked} onSelect={setPicked} />
            </div>
          )}

          {student && account.data && (
            <dl className="bg-muted/50 grid grid-cols-3 gap-2 rounded-lg p-3 text-sm">
              {[
                [t("finance.balance"), account.data.balance, ""],
                [t("finance.overdueAmount"), account.data.overdue, Number(account.data.overdue) > 0 ? "text-destructive" : ""],
                [t("finance.credit"), account.data.credit, ""],
              ].map(([label, value, className]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className={cn("font-semibold tabular-nums", className)}>{money.format(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("finance.amountFor", { currency: money.currency })}
              htmlFor="p-amount"
              error={errors.amount?.message}
            >
              <div className="flex gap-2">
                <Input id="p-amount" type="number" min={0} step="any" {...form.register("amount", { valueAsNumber: true })} />
                {due > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.setValue("amount", due, { shouldValidate: true })}
                  >
                    {t("finance.payAll")}
                  </Button>
                )}
              </div>
            </Field>
            <Field label={t("finance.paymentDate")} htmlFor="p-date" error={errors.date?.message}>
              <Input id="p-date" type="date" max={today()} {...form.register("date")} />
            </Field>
            <Field label={t("finance.method")} htmlFor="p-method" error={errors.method?.message}>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <OptionSelect<PaymentMethod>
                    id="p-method"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
                  />
                )}
              />
            </Field>
            <Field
              label={t("finance.reference")}
              htmlFor="p-reference"
              error={errors.reference?.message}
              hint={method !== "cash" ? t("finance.referenceHint") : undefined}
            >
              <Input id="p-reference" {...form.register("reference")} />
            </Field>
            <Field label={t("finance.payerName")} htmlFor="p-payer" error={errors.payer_name?.message}>
              <Input id="p-payer" {...form.register("payer_name")} placeholder={t("finance.payerPlaceholder")} />
            </Field>
            <Field label={t("common.notes")} htmlFor="p-note" error={errors.note?.message}>
              <Input id="p-note" {...form.register("note")} />
            </Field>
          </div>

          {student && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("finance.whatItPays")}</p>
                {lines.length > 0 &&
                  (mode === "auto" ? (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={chooseLines}>
                      {t("finance.chooseLines")}
                    </Button>
                  ) : (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode("auto")}>
                      {t("finance.oldestFirst")}
                    </Button>
                  ))}
              </div>
              {account.isPending ? (
                <Spinner className="mx-auto my-4 size-5" />
              ) : lines.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("finance.nothingDue")}</p>
              ) : (
                <>
                  {mode === "auto" && <p className="text-muted-foreground text-xs">{t("finance.oldestFirstHint")}</p>}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("finance.description")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("finance.dueDate")}</TableHead>
                        <TableHead className="text-right">{t("finance.stillDue")}</TableHead>
                        <TableHead className="w-36 text-right">{t("finance.paidNow")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => {
                        const value = planned.get(line.id) ?? 0;
                        const tooMuch = mode === "manual" && value > Number(line.balance);
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <span className="block">{line.description}</span>
                              <span className="text-muted-foreground block text-xs">
                                {line.invoice_number}
                                <span className="sm:hidden"> · {formatDate(line.due_date)}</span>
                              </span>
                            </TableCell>
                            <TableCell className={cn("hidden sm:table-cell", line.is_overdue && "text-destructive")}>
                              {formatDate(line.due_date)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{money.format(line.balance)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {mode === "auto" ? (
                                value ? money.format(value) : "—"
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="ml-auto h-8 w-32 text-right"
                                  aria-label={t("finance.paidNowFor", { line: line.description })}
                                  aria-invalid={tooMuch}
                                  value={manual[line.id] ?? ""}
                                  onChange={(e) => setManual((current) => ({ ...current, [line.id]: e.target.value }))}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
              {tooMuchOnLine && <p className="text-destructive text-xs" role="alert">{t("finance.moreThanDue")}</p>}
              {overAllocated && <p className="text-destructive text-xs" role="alert">{t("finance.moreThanPayment")}</p>}
              {credit > 0 && !invalidPlan && (
                <p className="text-sm">
                  {t("finance.keptAsCredit")} : <span className="font-semibold tabular-nums">{money.format(credit)}</span>
                </p>
              )}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="payment-form" disabled={isSubmitting || !student || invalidPlan}>
            {isSubmitting ? t("common.saving") : t("finance.recordPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
