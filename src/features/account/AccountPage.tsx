import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChangePasswordForm } from "@/features/auth/ChangePasswordForm";
import { api } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors } from "@/lib/forms";

const FIELDS = ["first_name", "last_name", "phone", "language"] as const;

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();

  const schema = useMemo(
    () =>
      z.object({
        first_name: z.string().trim().min(1, t("validation.required")),
        last_name: z.string().trim().min(1, t("validation.required")),
        phone: z.string().trim(),
        language: z.enum(["fr", "en"]),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: user
      ? { first_name: user.first_name, last_name: user.last_name, phone: user.phone, language: user.language }
      : undefined,
  });

  if (!user) return null;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const me = await api.patch<Me>("/me/", values);
      await refreshUser();
      if (me.language !== i18n.language) await i18n.changeLanguage(me.language);
      toast.success(t("account.saved"));
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELDS, t);
      if (message) toast.error(message);
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <>
      <PageHeader title={t("account.title")} description={t("account.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("account.profile")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.users.firstName")} htmlFor="first_name" error={errors.first_name?.message}>
                  <Input id="first_name" autoComplete="given-name" {...form.register("first_name")} />
                </Field>
                <Field label={t("settings.users.lastName")} htmlFor="last_name" error={errors.last_name?.message}>
                  <Input id="last_name" autoComplete="family-name" {...form.register("last_name")} />
                </Field>
              </div>
              <Field label={t("auth.email")} htmlFor="email">
                <Input id="email" value={user.email} disabled readOnly />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.users.phone")} htmlFor="phone" error={errors.phone?.message}>
                  <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} />
                </Field>
                <Field label={t("common.language")} htmlFor="language">
                  <Controller
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(value) => value && field.onChange(value)}>
                        <SelectTrigger id="language" className="w-full">
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
              <Button type="submit" disabled={isSubmitting} className="justify-self-start">
                {isSubmitting ? t("common.saving") : t("common.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.changeTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
