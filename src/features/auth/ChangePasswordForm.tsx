import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { z } from "zod";

import { Field } from "@/components/common";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { SessionResponse } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors } from "@/lib/forms";

import { changePasswordSchema } from "./passwordSchema";

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const { applySession } = useAuth();

  const schema = useMemo(() => changePasswordSchema(t), [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const data = await api.post<SessionResponse>("/auth/password/change/", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      applySession(data);
      form.reset();
      toast.success(t("auth.changeDone"));
      onDone?.();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["current_password", "new_password"], t);
      if (message) toast.error(message);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field label={t("auth.currentPassword")} htmlFor="current_password" error={errors.current_password?.message}>
        <PasswordInput id="current_password" autoComplete="current-password" {...form.register("current_password")} />
      </Field>
      <Field label={t("auth.newPassword")} htmlFor="new_password" error={errors.new_password?.message}>
        <PasswordInput id="new_password" autoComplete="new-password" {...form.register("new_password")} />
      </Field>
      <Field label={t("auth.confirmPassword")} htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="justify-self-start">
        {isSubmitting ? t("common.saving") : t("auth.setPassword")}
      </Button>
    </form>
  );
}
