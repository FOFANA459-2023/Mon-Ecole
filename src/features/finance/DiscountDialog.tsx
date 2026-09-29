import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { OptionSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StudentPicker } from "@/features/students/StudentPicker";
import { api } from "@/lib/api/client";
import type { DiscountKind, DiscountReason, StudentDiscount, StudentListItem } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

import { FINANCE_KEY, useFeeCategories, useMoney } from "./api";

const REASONS: DiscountReason[] = ["scholarship", "sibling", "staff_child", "hardship", "other"];
const ALL_CATEGORIES = "all";

export function DiscountDialog({
  discount,
  student: fixedStudent,
  defaultYearId,
  onClose,
}: {
  discount?: StudentDiscount;
  /** When opened from a student's profile. */
  student?: { id: number; full_name: string };
  defaultYearId: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const money = useMoney();
  const categories = (useFeeCategories().data ?? []).filter((c) => c.is_active || c.id === discount?.category);
  const [picked, setPicked] = useState<StudentListItem | null>(null);
  const studentId = discount?.student ?? fixedStudent?.id ?? picked?.id ?? null;

  const schema = useMemo(() => {
    const required = t("validation.required");
    return z
      .object({
        academic_year: z.number(required),
        category: z.number().nullable(),
        kind: z.enum(["percent", "fixed"]),
        value: z.number(required).positive(t("finance.positiveAmount")),
        reason: z.enum(REASONS as [DiscountReason, ...DiscountReason[]]),
        note: z.string().max(255),
        is_active: z.boolean(),
      })
      .refine((v) => v.kind !== "percent" || v.value <= 100, { path: ["value"], message: t("finance.percentMax") })
      .refine((v) => v.kind !== "fixed" || v.category !== null, { path: ["category"], message: t("finance.fixedNeedsCategory") });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      academic_year: discount?.academic_year ?? defaultYearId ?? undefined,
      category: discount?.category ?? null,
      kind: discount?.kind ?? "percent",
      value: discount ? Number(discount.value) : undefined,
      reason: discount?.reason ?? "scholarship",
      note: discount?.note ?? "",
      is_active: discount?.is_active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!studentId) {
      toast.error(t("finance.chooseStudent"));
      return;
    }
    try {
      if (discount) await api.patch(`/student-discounts/${discount.id}/`, values);
      else await api.post("/student-discounts/", { ...values, student: studentId });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["academic_year", "category", "kind", "value", "reason", "note"], t);
      if (message) toast.error(message);
    }
  });

  const studentName = discount?.student_name ?? fixedStudent?.full_name;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{discount ? t("finance.editDiscount") : t("finance.newDiscount")}</DialogTitle>
          <DialogDescription>{studentName ?? t("finance.discountHint")}</DialogDescription>
        </DialogHeader>
        <form id="discount-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          {!studentName && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("finance.student")}</p>
              <StudentPicker selected={picked} onSelect={setPicked} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("classes.year")} htmlFor="d-year" error={errors.academic_year?.message}>
              <Controller
                control={form.control}
                name="academic_year"
                render={({ field }) => <YearSelect id="d-year" value={field.value ?? null} onChange={field.onChange} />}
              />
            </Field>
            <Field label={t("finance.category")} htmlFor="d-cat" error={errors.category?.message}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <OptionSelect
                    id="d-cat"
                    value={field.value !== null ? String(field.value) : ALL_CATEGORIES}
                    onChange={(v) => field.onChange(v && v !== ALL_CATEGORIES ? Number(v) : null)}
                    options={[
                      { value: ALL_CATEGORIES, label: t("finance.allCategories") },
                      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                    ]}
                  />
                )}
              />
            </Field>
            <Field label={t("finance.discountKind")} htmlFor="d-kind">
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <OptionSelect<DiscountKind>
                    id="d-kind"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={[
                      { value: "percent", label: t("finance.percent") },
                      { value: "fixed", label: t("finance.fixed", { currency: money.currency }) },
                    ]}
                  />
                )}
              />
            </Field>
            <Field
              label={kind === "percent" ? t("finance.percentValue") : t("finance.amountFor", { currency: money.currency })}
              htmlFor="d-value"
              error={errors.value?.message}
            >
              <Input id="d-value" type="number" min={0} step="any" {...form.register("value", { valueAsNumber: true })} />
            </Field>
            <Field label={t("common.reason")} htmlFor="d-reason">
              <Controller
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <OptionSelect<DiscountReason>
                    id="d-reason"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={REASONS.map((r) => ({ value: r, label: t(`finance.reasons.${r}`) }))}
                  />
                )}
              />
            </Field>
            <Field label={t("common.notes")} htmlFor="d-note" error={errors.note?.message}>
              <Input id="d-note" {...form.register("note")} />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm font-medium">
            {t("common.active")}
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </label>
          <p className="text-muted-foreground text-xs">{t("finance.discountAppliesLater")}</p>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="discount-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
