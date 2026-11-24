import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, Field, QueryError, Spinner } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaffList } from "@/features/people/api";
import { api } from "@/lib/api/client";
import type { Department } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { ADMIN_KEY, useDepartments } from "./api";

/** School departments (Sciences, Languages, Administration...), their head and how many staff they have. */
export function DepartmentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manager = can("administration.manage");
  const departments = useDepartments();
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const queryClient = useQueryClient();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("administration.departments.intro")}</p>
        {manager && (
          <Button onClick={() => setEditing("new")}>
            <Plus /> {t("administration.departments.new")}
          </Button>
        )}
      </div>
      {departments.isError ? (
        <QueryError error={departments.error} onRetry={() => void departments.refetch()} />
      ) : departments.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : departments.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Network className="size-8" />} title={t("administration.departments.none")} />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("administration.departments.head")}</TableHead>
                <TableHead className="text-right">{t("administration.departments.staff")}</TableHead>
                {manager && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.data.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>
                    <Link to={`/teachers?department=${department.id}`} className="font-medium hover:underline">
                      {department.name}
                    </Link>
                    {department.description && (
                      <span className="text-muted-foreground block text-xs">{department.description}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{department.head_name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{department.staff_count}</TableCell>
                  {manager && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(department)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.delete")}
                        onClick={() => setDeleting(department)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing && <DepartmentDialog department={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("administration.departments.deleteTitle")}
          description={t("administration.departments.deleteHint", { name: deleting.name })}
          confirmLabel={t("common.delete")}
          onConfirm={async () => {
            try {
              await api.delete(`/departments/${deleting.id}/`);
              await queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
              await queryClient.invalidateQueries({ queryKey: ["staff"] });
              toast.success(t("common.deleted"));
            } catch (error) {
              toast.error(errorMessage(error, t));
            }
          }}
        />
      )}
    </div>
  );
}

function DepartmentDialog({ department, onClose }: { department: Department | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const staff = useStaffList({ status: "active", page_size: 200 }).data?.results ?? [];
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(100),
        description: z.string().trim().max(255),
        head: z.number().nullable(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: department?.name ?? "",
      description: department?.description ?? "",
      head: department?.head ?? null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (department) await api.patch(`/departments/${department.id}/`, values);
      else await api.post("/departments/", values);
      await queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "description", "head"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{department ? t("administration.departments.edit") : t("administration.departments.new")}</DialogTitle>
          <DialogDescription>{t("administration.departments.hint")}</DialogDescription>
        </DialogHeader>
        <form id="department-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("common.name")} htmlFor="dep-name" error={errors.name?.message}>
            <Input id="dep-name" maxLength={100} {...form.register("name")} />
          </Field>
          <Field label={t("administration.departments.description")} htmlFor="dep-description" error={errors.description?.message}>
            <Input id="dep-description" maxLength={255} {...form.register("description")} />
          </Field>
          <Field label={t("administration.departments.head")} htmlFor="dep-head" error={errors.head?.message}>
            <Controller
              control={form.control}
              name="head"
              render={({ field }) => (
                <OptionSelect
                  id="dep-head"
                  value={field.value !== null ? String(field.value) : null}
                  onChange={(v) => field.onChange(v ? Number(v) : null)}
                  allLabel={t("common.none")}
                  options={staff.map((s) => ({ value: String(s.id), label: s.full_name }))}
                />
              )}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="department-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
