import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, Field, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/display";
import { OptionSelect, YearSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear, useLevels } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { FeeAppliesTo, FeeCategory, FeeCategoryKind, FeeSchedule, Level } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { currencyDecimals } from "@/lib/format";
import { applyApiErrors, errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { FINANCE_KEY, useFeeCategories, useFeeSchedules, useMoney } from "./api";

const KINDS: FeeCategoryKind[] = ["registration", "tuition", "exam", "transport", "canteen", "uniform", "supplies", "other"];
const AUDIENCES: FeeAppliesTo[] = ["all", "new", "returning"];

function CategoryDialog({ category, onClose }: { category?: FeeCategory; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(100),
        kind: z.enum(KINDS as [FeeCategoryKind, ...FeeCategoryKind[]]),
        description: z.string().max(255),
        is_active: z.boolean(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      kind: category?.kind ?? "tuition",
      description: category?.description ?? "",
      is_active: category?.is_active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (category) await api.patch(`/fee-categories/${category.id}/`, values);
      else await api.post("/fee-categories/", values);
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "kind", "description"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? t("finance.editCategory") : t("finance.newCategory")}</DialogTitle>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("common.name")} htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" {...form.register("name")} placeholder={t("finance.categoryPlaceholder")} />
          </Field>
          <Field label={t("finance.kind")} htmlFor="c-kind">
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <OptionSelect<FeeCategoryKind>
                  id="c-kind"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  options={KINDS.map((k) => ({ value: k, label: t(`finance.kinds.${k}`) }))}
                />
              )}
            />
          </Field>
          <Field label={t("finance.description")} htmlFor="c-desc" error={errors.description?.message}>
            <Input id="c-desc" {...form.register("description")} />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm font-medium">
            {t("common.active")}
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Split `total` into `count` equal parts in the currency's unit; the remainder goes on the last one. */
function equalParts(total: number, count: number, decimals: number): number[] {
  const unit = 10 ** decimals;
  const cents = Math.round(total * unit);
  const part = Math.floor(cents / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? cents - part * (count - 1) : part) / unit);
}

function ScheduleDialog({
  yearId,
  level,
  schedule,
  onClose,
}: {
  yearId: number;
  level: Level;
  schedule?: FeeSchedule;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const money = useMoney();
  const categories = (useFeeCategories().data ?? []).filter((c) => c.is_active || c.id === schedule?.category);
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      category: z.number(required),
      applies_to: z.enum(AUDIENCES as [FeeAppliesTo, ...FeeAppliesTo[]]),
      amount: z.number(required).positive(t("finance.positiveAmount")),
      installments: z
        .array(
          z.object({
            label: z.string().max(60),
            due_date: z.string().min(1, required),
            amount: z.number(required).positive(t("finance.positiveAmount")),
          }),
        )
        .min(1)
        .max(12),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: schedule?.category,
      applies_to: schedule?.applies_to ?? "all",
      amount: schedule ? Number(schedule.amount) : undefined,
      installments: schedule?.installments?.map((i) => ({ ...i, label: i.label ?? "", amount: Number(i.amount) })) ?? [
        { label: "", due_date: "", amount: 0 },
      ],
    },
  });
  const installments = useFieldArray({ control: form.control, name: "installments" });
  const { errors, isSubmitting } = form.formState;
  const amount = useWatch({ control: form.control, name: "amount" }) || 0;
  const planned = useWatch({ control: form.control, name: "installments" }).reduce(
    (sum, i) => sum + (Number(i.amount) || 0),
    0,
  );
  const mismatch = Math.abs(planned - amount) > 1e-9;

  const splitEqually = () => {
    const parts = equalParts(amount, installments.fields.length, currencyDecimals(money.currency));
    parts.forEach((value, i) => form.setValue(`installments.${i}.amount`, value, { shouldValidate: true }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (mismatch) {
      form.setError("installments", { message: t("finance.installmentsMismatch") });
      return;
    }
    const payload = { ...values, academic_year: yearId, level: level.id };
    try {
      if (schedule) await api.patch(`/fee-schedules/${schedule.id}/`, payload);
      else await api.post("/fee-schedules/", payload);
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["category", "applies_to", "amount", "installments"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(schedule ? "finance.editFee" : "finance.newFee", { level: level.name })}</DialogTitle>
          <DialogDescription>{t("finance.feeHint")}</DialogDescription>
        </DialogHeader>
        <form id="schedule-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.category")} htmlFor="f-cat" error={errors.category?.message}>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <OptionSelect
                    id="f-cat"
                    value={field.value ? String(field.value) : null}
                    onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                    options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                    placeholder={t("finance.category")}
                  />
                )}
              />
            </Field>
            <Field label={t("finance.appliesTo")} htmlFor="f-aud">
              <Controller
                control={form.control}
                name="applies_to"
                render={({ field }) => (
                  <OptionSelect<FeeAppliesTo>
                    id="f-aud"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={AUDIENCES.map((a) => ({ value: a, label: t(`finance.audiences.${a}`) }))}
                  />
                )}
              />
            </Field>
          </div>
          <Field label={t("finance.amountFor", { currency: money.currency })} htmlFor="f-amount" error={errors.amount?.message}>
            <Input id="f-amount" type="number" min={0} step="any" {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("finance.installments")}</p>
              <Button type="button" variant="ghost" size="sm" onClick={splitEqually} disabled={!amount}>
                {t("finance.splitEqually")}
              </Button>
            </div>
            {installments.fields.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_9.5rem_8rem_auto] items-start gap-2">
                <Input
                  placeholder={t("finance.installmentLabel", { n: index + 1 })}
                  aria-label={t("finance.installmentLabel", { n: index + 1 })}
                  {...form.register(`installments.${index}.label`)}
                />
                <Input
                  type="date"
                  aria-label={t("finance.dueDate")}
                  aria-invalid={Boolean(errors.installments?.[index]?.due_date)}
                  {...form.register(`installments.${index}.due_date`)}
                />
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={t("finance.amount")}
                  aria-invalid={Boolean(errors.installments?.[index]?.amount)}
                  {...form.register(`installments.${index}.amount`, { valueAsNumber: true })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.remove")}
                  disabled={installments.fields.length === 1}
                  onClick={() => installments.remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={installments.fields.length >= 12}
                onClick={() => installments.append({ label: "", due_date: "", amount: 0 })}
              >
                <Plus /> {t("finance.addInstallment")}
              </Button>
              <p className={mismatch ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
                {t("finance.plannedOf", { planned: money.format(planned), total: money.format(amount) })}
              </p>
            </div>
            {(errors.installments?.message || errors.installments?.root?.message) && (
              <p className="text-destructive text-sm">
                {errors.installments?.message ?? errors.installments?.root?.message}
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="schedule-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const money = useMoney();
  const manage = can("finance.fees.manage");
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState({ year: "" });
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const categories = useFeeCategories();
  const levels = (useLevels().data ?? []).filter((l) => l.is_active);
  const schedules = useFeeSchedules(yearId);
  const [categoryDialog, setCategoryDialog] = useState<{ category?: FeeCategory } | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<{ level: Level; schedule?: FeeSchedule } | null>(null);
  const [deleting, setDeleting] = useState<FeeSchedule | null>(null);

  if (categories.isError || schedules.isError) {
    return <QueryError onRetry={() => void queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] })} />;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("finance.categories")}</CardTitle>
            <CardDescription>{t("finance.categoriesHint")}</CardDescription>
          </div>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => setCategoryDialog({})}>
              <Plus /> {t("finance.newCategory")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {categories.isPending ? (
            <Spinner className="mx-auto size-5" />
          ) : categories.data.length === 0 ? (
            <EmptyState icon={<Tags className="size-8" />} title={t("finance.noCategories")} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.data.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!manage}
                  onClick={() => setCategoryDialog({ category: c })}
                  className="hover:bg-muted flex items-center gap-2 rounded-full border px-3 py-1 text-sm disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {c.name}
                  <span className="text-muted-foreground text-xs">{t(`finance.kinds.${c.kind}`)}</span>
                  {!c.is_active && <StatusBadge status="archived" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("finance.schedules")}</h2>
          <p className="text-muted-foreground text-sm">{t("finance.schedulesHint")}</p>
        </div>
        <div className="w-56">
          <YearSelect value={yearId} onChange={(v) => setFilters({ year: v ? String(v) : "" })} aria-label={t("classes.year")} />
        </div>
      </div>

      {schedules.isPending && yearId !== null ? (
        <Spinner className="mx-auto size-6" />
      ) : (
        levels.map((level) => {
          const rows = (schedules.data ?? []).filter((s) => s.level === level.id);
          const total = rows.filter((s) => s.applies_to !== "returning").reduce((sum, s) => sum + Number(s.amount), 0);
          return (
            <Card key={level.id} className="gap-0 overflow-hidden py-0">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <p className="font-medium">{level.name}</p>
                  {rows.length > 0 && (
                    <p className="text-muted-foreground text-xs">{t("finance.newStudentTotal", { amount: money.format(total) })}</p>
                  )}
                </div>
                {manage && yearId !== null && (
                  <Button variant="ghost" size="sm" onClick={() => setScheduleDialog({ level })}>
                    <Plus /> {t("finance.addFee")}
                  </Button>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="text-muted-foreground px-4 py-3 text-sm">{t("finance.noFees")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance.category")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("finance.appliesTo")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("finance.installments")}</TableHead>
                      <TableHead className="text-right">{t("finance.amount")}</TableHead>
                      {manage && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.category_name}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary">{t(`finance.audiences.${s.applies_to ?? "all"}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                          {(s.installments ?? []).map((i) => formatDate(i.due_date)).join(" · ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money.format(s.amount)}</TableCell>
                        {manage && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setScheduleDialog({ level, schedule: s })}>
                                  <Pencil /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
                                  <Trash2 /> {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          );
        })
      )}

      {categoryDialog && <CategoryDialog category={categoryDialog.category} onClose={() => setCategoryDialog(null)} />}
      {scheduleDialog && yearId !== null && (
        <ScheduleDialog
          yearId={yearId}
          level={scheduleDialog.level}
          schedule={scheduleDialog.schedule}
          onClose={() => setScheduleDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("common.delete")}
        description={t("finance.confirmDeleteFee", { name: deleting?.category_name ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.delete(`/fee-schedules/${deleting.id}/`);
            await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
            toast.success(t("common.saved"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </div>
  );
}
