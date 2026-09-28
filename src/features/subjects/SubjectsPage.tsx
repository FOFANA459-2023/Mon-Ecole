import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, Field, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchInput, StatusBadge } from "@/components/display";
import { LevelSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubjects } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { Subject } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

const DEFAULTS = { q: "", level: "", page: "1" };
const PAGE_SIZE = 50;

function SubjectDialog({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(100),
        code: z
          .string()
          .trim()
          .min(1, t("validation.required"))
          .max(20)
          .regex(/^[A-Za-z0-9_-]+$/, t("validation.alphanumeric")),
        level: z.number().nullable(),
        default_coefficient: z.number(t("validation.required")).min(0.1).max(99),
        is_active: z.boolean(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subject?.name ?? "",
      code: subject?.code ?? "",
      level: subject?.level ?? null,
      default_coefficient: subject ? Number(subject.default_coefficient) : 1,
      is_active: subject?.is_active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (subject) await api.patch(`/subjects/${subject.id}/`, values);
      else await api.post("/subjects/", values);
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(subject ? t("subjects.updated") : t("subjects.created"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "code", "level", "default_coefficient"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? t("subjects.editSubject") : t("subjects.newSubject")}</DialogTitle>
        </DialogHeader>
        <form id="subject-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-[1fr_7rem] gap-4">
            <Field label={t("subjects.name")} htmlFor="s-name" error={errors.name?.message}>
              <Input id="s-name" {...form.register("name")} />
            </Field>
            <Field label={t("subjects.code")} htmlFor="s-code" error={errors.code?.message}>
              <Input id="s-code" className="uppercase" {...form.register("code")} />
            </Field>
          </div>
          <Field label={t("subjects.level")} htmlFor="s-level">
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <LevelSelect id="s-level" value={field.value} onChange={field.onChange} allLabel={t("subjects.allLevels")} />
              )}
            />
          </Field>
          <Field
            label={t("subjects.defaultCoefficient")}
            htmlFor="s-coef"
            error={errors.default_coefficient?.message}
            hint={t("subjects.coefficientHint")}
          >
            <Input id="s-coef" type="number" step="0.5" min={0.1} {...form.register("default_coefficient", { valueAsNumber: true })} />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm font-medium">
            {t("subjects.active")}
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
          <Button type="submit" form="subject-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const manage = can("subjects.manage");
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const subjects = useSubjects({ search, level: filters.level, page, page_size: PAGE_SIZE });
  const [dialog, setDialog] = useState<{ subject?: Subject } | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  return (
    <>
      <PageHeader
        title={t("subjects.title")}
        description={t("subjects.subtitle")}
        actions={
          manage && (
            <Button onClick={() => setDialog({})}>
              <Plus /> {t("subjects.newSubject")}
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} />
        <LevelSelect
          value={toNumberOrNull(filters.level)}
          onChange={(v) => setFilters({ level: v ? String(v) : "" })}
          allLabel={t("academics.allLevels")}
          aria-label={t("subjects.level")}
        />
      </div>
      {subjects.isError ? (
        <QueryError onRetry={() => void subjects.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {subjects.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : subjects.data.results.length === 0 ? (
            <EmptyState icon={<BookOpen className="size-8" />} title={t("subjects.noSubjects")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t("subjects.code")}</TableHead>
                    <TableHead>{t("subjects.name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("subjects.level")}</TableHead>
                    <TableHead className="text-right">{t("subjects.defaultCoefficient")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("common.status")}</TableHead>
                    {manage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.data.results.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {s.level_name || t("subjects.allLevels")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(s.default_coefficient)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge status={s.is_active ? "active" : "archived"} />
                      </TableCell>
                      {manage && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ subject: s })}>
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
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={subjects.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {dialog && <SubjectDialog subject={dialog.subject} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("common.delete")}
        description={t("subjects.confirmDelete", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.delete(`/subjects/${deleting.id}/`);
            await queryClient.invalidateQueries({ queryKey: ["subjects"] });
            toast.success(t("subjects.deleted"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </>
  );
}
