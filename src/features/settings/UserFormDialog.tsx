import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { Member } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors } from "@/lib/forms";

import { useRoles } from "./api";

const FIELDS = ["email", "first_name", "last_name", "phone", "language", "role_ids"] as const;
// Only the platform owner grants the Director role (the API enforces it too).
const DIRECTOR = "director";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit this member; absent = add someone new. */
  member?: Member;
};

export function UserFormDialog({ open, onOpenChange, member }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { membership, user: currentUser, refreshUser } = useAuth();
  const roles = useRoles();
  const editing = Boolean(member);

  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t("validation.email")),
        first_name: z.string().trim().min(1, t("validation.required")),
        last_name: z.string().trim().min(1, t("validation.required")),
        phone: z.string().trim(),
        language: z.enum(["fr", "en"]),
        role_ids: z.array(z.number()).min(1, t("validation.rolesRequired")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      email: member?.user.email ?? "",
      first_name: member?.user.first_name ?? "",
      last_name: member?.user.last_name ?? "",
      phone: member?.user.phone ?? "",
      language: member?.user.language ?? membership?.school.default_language ?? "fr",
      role_ids: member?.roles.map((r) => r.id) ?? [],
    },
  });
  const owner = Boolean(currentUser?.is_platform_admin);
  const isDirector = member?.roles.some((r) => r.key === DIRECTOR) ?? false;
  // A Director's roles are the owner's to change; others never see the Director role.
  const lockedRoles = isDirector && !owner;
  const roleChoices = (roles.data ?? []).filter((role) => owner || role.key !== DIRECTOR);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (member) {
        await api.patch(`/users/${member.id}/`, {
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
          language: values.language,
          ...(lockedRoles ? {} : { role_ids: values.role_ids }),
        });
        toast.success(t("settings.users.updated"));
        if (member.user.id === currentUser?.id) await refreshUser();
      } else {
        await api.post("/users/", {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
          language: values.language,
          role_ids: values.role_ids,
        });
        toast.success(t("settings.users.createdInvite", { email: values.email }));
      }
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELDS, t);
      if (message) toast.error(message);
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("settings.users.editTitle") : t("settings.users.add")}</DialogTitle>
          <DialogDescription>{membership?.school.name}</DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("auth.email")} htmlFor="u-email" error={errors.email?.message}>
            <Input id="u-email" type="email" disabled={editing} {...form.register("email")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.users.firstName")} htmlFor="u-first" error={errors.first_name?.message}>
              <Input id="u-first" {...form.register("first_name")} />
            </Field>
            <Field label={t("settings.users.lastName")} htmlFor="u-last" error={errors.last_name?.message}>
              <Input id="u-last" {...form.register("last_name")} />
            </Field>
            <Field label={t("settings.users.phone")} htmlFor="u-phone" error={errors.phone?.message}>
              <Input id="u-phone" type="tel" {...form.register("phone")} />
            </Field>
            <Field label={t("settings.users.language")} htmlFor="u-language">
              <Controller
                control={form.control}
                name="language"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                    <SelectTrigger id="u-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">{t("languages.fr")}</SelectItem>
                      <SelectItem value="en">{t("languages.en")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <fieldset className="grid gap-2" disabled={lockedRoles}>
            <legend className="mb-1 text-sm font-medium">{t("settings.users.roles")}</legend>
            {lockedRoles && <p className="text-muted-foreground text-xs">{t("settings.users.directorLocked")}</p>}
            <Controller
              control={form.control}
              name="role_ids"
              render={({ field }) => (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(lockedRoles ? (roles.data ?? []) : roleChoices).map((role) => {
                    const checked = field.value.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={lockedRoles}
                          onCheckedChange={(value) =>
                            field.onChange(
                              value ? [...field.value, role.id] : field.value.filter((id) => id !== role.id),
                            )
                          }
                        />
                        <span className="truncate">{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.role_ids && <p className="text-destructive text-xs">{errors.role_ids.message}</p>}
          </fieldset>

          {!editing && <p className="text-muted-foreground text-xs">{t("settings.users.inviteExplained")}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : editing ? t("common.save") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
