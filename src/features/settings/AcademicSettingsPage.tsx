import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CheckCircle2, Layers, Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, Field, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/display";
import { useFormatDate } from "@/lib/dates";
import { OptionSelect } from "@/components/pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAcademicYears, useLevels } from "@/features/academics/api";
import { GradingScalesCard } from "@/features/grades/GradingScalesCard";
import { api } from "@/lib/api/client";
import type { AcademicYear, Level, Term } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";

const CYCLES = ["preschool", "primary", "lower_secondary", "upper_secondary", "other"] as const;

function useRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all(
      ["academic-years", "levels", "classes", "dashboard"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}

function YearDialog({ year, onClose }: { year?: AcademicYear; onClose: () => void }) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t("validation.required")).max(20),
          start_date: z.string().min(1, t("validation.required")),
          end_date: z.string().min(1, t("validation.required")),
          term_count: z.enum(["0", "2", "3"]),
          status: z.enum(["open", "closed"]),
        })
        .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: t("validation.endAfterStart") }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: year?.name ?? "",
      start_date: year?.start_date ?? "",
      end_date: year?.end_date ?? "",
      term_count: "3",
      status: year?.status ?? "open",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (year) {
        await api.patch(`/academic-years/${year.id}/`, {
          name: values.name,
          start_date: values.start_date,
          end_date: values.end_date,
          status: values.status,
        });
      } else {
        await api.post("/academic-years/", { ...values, term_count: Number(values.term_count) });
      }
      await refresh();
      toast.success(t("academics.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "start_date", "end_date"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{year ? t("academics.editYear") : t("academics.newYear")}</DialogTitle>
        </DialogHeader>
        <form id="year-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("academics.name")} htmlFor="y-name" error={errors.name?.message}>
            <Input id="y-name" placeholder={t("academics.namePlaceholder")} {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("academics.start")} htmlFor="y-start" error={errors.start_date?.message}>
              <Input id="y-start" type="date" {...form.register("start_date")} />
            </Field>
            <Field label={t("academics.end")} htmlFor="y-end" error={errors.end_date?.message}>
              <Input id="y-end" type="date" {...form.register("end_date")} />
            </Field>
          </div>
          {year ? (
            <Field label={t("academics.yearStatus")} htmlFor="y-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <OptionSelect
                    id="y-status"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={[
                      { value: "open", label: t("status.open") },
                      { value: "closed", label: t("status.closed") },
                    ]}
                  />
                )}
              />
            </Field>
          ) : (
            <Field label={t("academics.termCount")} htmlFor="y-terms">
              <Controller
                control={form.control}
                name="term_count"
                render={({ field }) => (
                  <OptionSelect
                    id="y-terms"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={[
                      { value: "3", label: t("academics.threeTerms") },
                      { value: "2", label: t("academics.twoTerms") },
                      { value: "0", label: t("academics.noTerms") },
                    ]}
                  />
                )}
              />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="year-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TermDialog({ year, term, onClose }: { year: AcademicYear; term?: Term; onClose: () => void }) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const nextOrder = Math.max(0, ...year.terms.map((x) => x.order)) + 1;
  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t("validation.required")).max(50),
          order: z.number(t("validation.required")).int().min(1),
          start_date: z.string().min(1, t("validation.required")),
          end_date: z.string().min(1, t("validation.required")),
        })
        .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: t("validation.endAfterStart") }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: term?.name ?? "",
      order: term?.order ?? nextOrder,
      start_date: term?.start_date ?? "",
      end_date: term?.end_date ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (term) await api.patch(`/terms/${term.id}/`, values);
      else await api.post("/terms/", { ...values, academic_year: year.id });
      await refresh();
      toast.success(t("academics.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "order", "start_date", "end_date"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term ? t("academics.editTerm") : t("academics.addTerm")}</DialogTitle>
        </DialogHeader>
        <form id="term-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <Field label={t("academics.termName")} htmlFor="t-name" error={errors.name?.message}>
              <Input id="t-name" {...form.register("name")} />
            </Field>
            <Field label={t("academics.order")} htmlFor="t-order" error={errors.order?.message}>
              <Input id="t-order" type="number" min={1} {...form.register("order", { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("academics.start")} htmlFor="t-start" error={errors.start_date?.message}>
              <Input id="t-start" type="date" min={year.start_date} max={year.end_date} {...form.register("start_date")} />
            </Field>
            <Field label={t("academics.end")} htmlFor="t-end" error={errors.end_date?.message}>
              <Input id="t-end" type="date" min={year.start_date} max={year.end_date} {...form.register("end_date")} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="term-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LevelDialog({ level, onClose }: { level?: Level; onClose: () => void }) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(50),
        order: z.number(t("validation.required")).int().min(0).max(99),
        cycle: z.enum(CYCLES),
        is_active: z.boolean(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: level?.name ?? "",
      order: level?.order ?? 0,
      cycle: level?.cycle ?? "other",
      is_active: level?.is_active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (level) await api.patch(`/levels/${level.id}/`, values);
      else await api.post("/levels/", values);
      await refresh();
      toast.success(t("academics.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "order", "cycle"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{level ? t("academics.editLevel") : t("academics.newLevel")}</DialogTitle>
        </DialogHeader>
        <form id="level-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("academics.levelName")} htmlFor="l-name" error={errors.name?.message}>
            <Input id="l-name" placeholder="7ème année" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("academics.cycle")} htmlFor="l-cycle">
              <Controller
                control={form.control}
                name="cycle"
                render={({ field }) => (
                  <OptionSelect
                    id="l-cycle"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={CYCLES.map((c) => ({ value: c, label: t(`cycle.${c}`) }))}
                  />
                )}
              />
            </Field>
            <Field label={t("academics.levelOrder")} htmlFor="l-order" error={errors.order?.message}>
              <Input id="l-order" type="number" min={0} {...form.register("order", { valueAsNumber: true })} />
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
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="level-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DialogState =
  | { kind: "year"; year?: AcademicYear }
  | { kind: "term"; year: AcademicYear; term?: Term }
  | { kind: "level"; level?: Level }
  | { kind: "delete"; label: string; path: string; message: string }
  | null;

export function AcademicSettingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canEdit = can("settings.manage");
  const years = useAcademicYears();
  const levels = useLevels();
  const refresh = useRefresh();
  const formatDate = useFormatDate();
  const [dialog, setDialog] = useState<DialogState>(null);

  const setCurrent = async (year: AcademicYear) => {
    try {
      await api.post(`/academic-years/${year.id}/set-current/`);
      await refresh();
      toast.success(t("academics.currentSet"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  const remove = async (path: string) => {
    try {
      await api.delete(path);
      await refresh();
      toast.success(t("academics.deleted"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  if (years.isPending || levels.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  if (years.isError || levels.isError) return <QueryError onRetry={() => void years.refetch()} />;

  return (
    <div className="grid gap-6">
      {!canEdit && (
        <Alert>
          <Lock />
          <AlertDescription>{t("settings.school.readOnlyNotice")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="text-primary size-4" /> {t("academics.years")}
            </CardTitle>
            <CardDescription>{t("academics.yearsHint")}</CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDialog({ kind: "year" })}>
              <Plus /> {t("academics.newYear")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {years.data.length === 0 && <EmptyState title={t("academics.noYears")} />}
          {years.data.map((year) => (
            <div key={year.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{year.name}</p>
                {year.is_current && (
                  <Badge className="bg-primary/10 text-primary border-transparent">
                    <CheckCircle2 /> {t("academics.currentBadge")}
                  </Badge>
                )}
                <StatusBadge status={year.status ?? "open"} />
                <span className="text-muted-foreground text-sm">
                  {formatDate(year.start_date)} → {formatDate(year.end_date)}
                </span>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="ml-auto" aria-label={t("common.actions")}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!year.is_current && (
                        <DropdownMenuItem onSelect={() => void setCurrent(year)}>
                          <CheckCircle2 /> {t("academics.setCurrent")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => setDialog({ kind: "year", year })}>
                        <Pencil /> {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialog({ kind: "term", year })}>
                        <Plus /> {t("academics.addTerm")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setDialog({
                            kind: "delete",
                            label: year.name,
                            path: `/academic-years/${year.id}/`,
                            message: t("academics.confirmDeleteYear", { name: year.name }),
                          })
                        }
                      >
                        <Trash2 /> {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {year.terms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {year.terms.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setDialog({ kind: "term", year, term })}
                      className="bg-muted/60 hover:bg-muted rounded-md px-3 py-1.5 text-left text-xs disabled:cursor-default"
                    >
                      <span className="font-medium">{term.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {formatDate(term.start_date)} – {formatDate(term.end_date)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="text-primary size-4" /> {t("academics.levels")}
            </CardTitle>
            <CardDescription>{t("academics.levelsHint")}</CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDialog({ kind: "level" })}>
              <Plus /> {t("academics.newLevel")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {levels.data.length === 0 ? (
            <EmptyState title={t("academics.noLevels")} />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("academics.order")}</TableHead>
                    <TableHead>{t("academics.levelName")}</TableHead>
                    <TableHead>{t("academics.cycle")}</TableHead>
                    <TableHead>{t("classes.title")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.data.map((level) => (
                    <TableRow key={level.id} className={level.is_active ? "" : "opacity-60"}>
                      <TableCell className="text-muted-foreground tabular-nums">{level.order}</TableCell>
                      <TableCell className="font-medium">{level.name}</TableCell>
                      <TableCell>{t(`cycle.${level.cycle ?? "other"}`)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t("academics.classCount", { count: level.class_count })}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ kind: "level", level })}>
                                <Pencil /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() =>
                                  setDialog({
                                    kind: "delete",
                                    label: level.name,
                                    path: `/levels/${level.id}/`,
                                    message: t("academics.confirmDeleteLevel", { name: level.name }),
                                  })
                                }
                              >
                                <Trash2 /> {t("common.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <GradingScalesCard canEdit={canEdit} />

      {dialog?.kind === "year" && <YearDialog year={dialog.year} onClose={() => setDialog(null)} />}
      {dialog?.kind === "term" && <TermDialog year={dialog.year} term={dialog.term} onClose={() => setDialog(null)} />}
      {dialog?.kind === "level" && <LevelDialog level={dialog.level} onClose={() => setDialog(null)} />}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={t("common.delete")}
          description={dialog.message}
          confirmLabel={t("common.delete")}
          destructive
          onConfirm={() => remove(dialog.path)}
        />
      )}
    </div>
  );
}
