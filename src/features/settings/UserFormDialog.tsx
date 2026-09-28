import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { PasswordInput } from "@/components/PasswordInput";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import type { Member } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors } from "@/lib/forms";

import { useRoles } from "./api";

const FIELDS = ["email", "first_name", "last_name", "phone", "language", "role_ids", "password"] as const;

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
      z
        .object({
          email: z.email(t("validation.email")),
          first_name: z.string().trim().min(1, t("validation.required")),
          last_name: z.string().trim().min(1, t("validation.required")),
          phone: z.string().trim(),
          language: z.enum(["fr", "en"]),
          role_ids: z.array(z.number()).min(1, t("validation.rolesRequired")),
          set_password: z.boolean(),
          password: z.string(),
        })
        .refine((v) => editing || !v.set_password || v.password.length >= 10, {
          path: ["password"],
          message: t("validation.passwordLength"),
        }),
    [t, editing],
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
      set_password: false,
      password: "",
    },
  });
  const setPassword = useWatch({ control: form.control, name: "set_password" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (member) {
        await api.patch(`/users/${member.id}/`, {
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
          language: values.language,
          role_ids: values.role_ids,
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
          ...(values.set_password ? { password: values.password } : {}),
        });
        toast.success(values.set_password ? t("settings.users.created") : t("settings.users.createdInvite"));
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

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("settings.users.roles")}</legend>
            <Controller
              control={form.control}
              name="role_ids"
              render={({ field }) => (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(roles.data ?? []).map((role) => {
                    const checked = field.value.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
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

          {!editing && (
            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="u-setpw">{t("settings.users.setPassword")}</Label>
                  <p className="text-muted-foreground mt-1 text-xs">{t("settings.users.setPasswordHint")}</p>
                </div>
                <Controller
                  control={form.control}
                  name="set_password"
                  render={({ field }) => (
                    <Switch id="u-setpw" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
              {setPassword && (
                <Field
                  label={t("settings.users.tempPassword")}
                  htmlFor="u-password"
                  error={errors.password?.message}
                  hint={t("settings.users.tempPasswordHint")}
                >
                  <PasswordInput id="u-password" autoComplete="new-password" {...form.register("password")} />
                </Field>
              )}
            </div>
          )}
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
