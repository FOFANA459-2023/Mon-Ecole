import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { PermissionGroup, Role } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { usePermissionGroups, useRoles } from "./api";

const SUPER_ADMIN = "super_admin";

function PermissionMatrix({
  groups,
  value,
  onChange,
  locked,
}: {
  groups: PermissionGroup[];
  value: string[];
  onChange: (codes: string[]) => void;
  locked: boolean;
}) {
  const selected = new Set(value);

  const toggleGroup = (group: PermissionGroup, on: boolean) => {
    const codes = group.permissions.map((p) => p.code);
    onChange(on ? [...new Set([...value, ...codes])] : value.filter((c) => !codes.includes(c)));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => {
        const count = group.permissions.filter((p) => selected.has(p.code)).length;
        const all = count === group.permissions.length;
        return (
          <fieldset key={group.module} className="rounded-lg border p-3" disabled={locked}>
            <legend className="sr-only">{group.label}</legend>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={all ? true : count > 0 ? "indeterminate" : false}
                onCheckedChange={(v) => toggleGroup(group, v === true)}
                disabled={locked}
              />
              {group.label}
              <span className="text-muted-foreground ml-auto text-xs font-normal">
                {count}/{group.permissions.length}
              </span>
            </label>
            <div className="grid gap-1.5 pl-6">
              {group.permissions.map((perm) => (
                <label key={perm.code} className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(perm.code)}
                    disabled={locked}
                    onCheckedChange={(v) =>
                      onChange(v ? [...value, perm.code] : value.filter((c) => c !== perm.code))
                    }
                  />
                  <span className="text-foreground">{perm.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function RoleDialog({
  open,
  onOpenChange,
  role,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role;
  groups: PermissionGroup[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const locked = role?.key === SUPER_ADMIN;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(100),
        description: z.string().trim().max(255),
        permissions: z.array(z.string()),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: role?.name ?? "", description: role?.description ?? "", permissions: role?.permissions ?? [] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (role) {
        await api.patch(`/roles/${role.id}/`, values);
        toast.success(t("settings.roles.updated"));
      } else {
        await api.post("/roles/", values);
        toast.success(t("settings.roles.created"));
      }
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      await refreshUser();
      onOpenChange(false);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "description", "permissions"], t);
      if (message) toast.error(message);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{role ? t("settings.roles.editTitle") : t("settings.roles.createTitle")}</DialogTitle>
          <DialogDescription>{t("settings.roles.subtitle")}</DialogDescription>
        </DialogHeader>
        <form id="role-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.roles.name")} htmlFor="r-name" error={errors.name?.message}>
              <Input id="r-name" {...form.register("name")} />
            </Field>
            <Field label={t("settings.roles.description")} htmlFor="r-desc" error={errors.description?.message}>
              <Input id="r-desc" {...form.register("description")} />
            </Field>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t("settings.roles.permissions")}</p>
            {locked && (
              <Alert>
                <Lock />
                <AlertDescription>{t("settings.roles.superAdminLocked")}</AlertDescription>
              </Alert>
            )}
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <PermissionMatrix groups={groups} value={field.value} onChange={field.onChange} locked={locked} />
              )}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="role-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const groups = usePermissionGroups();
  const [dialog, setDialog] = useState<{ open: boolean; role?: Role }>({ open: false });
  const [toDelete, setToDelete] = useState<Role | null>(null);

  if (roles.isPending || groups.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  if (roles.isError || groups.isError) {
    return (
      <QueryError
        onRetry={() => {
          void roles.refetch();
          void groups.refetch();
        }}
      />
    );
  }

  const remove = async (role: Role) => {
    try {
      await api.delete(`/roles/${role.id}/`);
      toast.success(t("settings.roles.deleted"));
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">{t("settings.roles.subtitle")}</p>
        <Button onClick={() => setDialog({ open: true })}>
          <Plus /> {t("settings.roles.add")}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.data.map((role) => (
          <Card key={role.id} className="gap-3">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="text-primary size-4" />
                  {role.name}
                </CardTitle>
                {role.is_system && <Badge variant="secondary">{t("settings.roles.system")}</Badge>}
              </div>
              {role.description && <CardDescription>{role.description}</CardDescription>}
            </CardHeader>
            <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {t("settings.roles.members", { count: role.member_count })}
              </span>
              <span>{t("dashboard.permissionsCount", { count: role.permissions?.length ?? 0 })}</span>
            </CardContent>
            <CardFooter className="mt-auto gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, role })}>
                <Pencil /> {t("common.edit")}
              </Button>
              {!role.is_system && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(role)}>
                  <Trash2 /> {t("common.delete")}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <RoleDialog
        key={dialog.role?.id ?? "new"}
        open={dialog.open}
        role={dialog.role}
        groups={groups.data}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("common.delete")}
        description={t("settings.roles.confirmDelete", { name: toDelete?.name ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
      />
    </>
  );
}
