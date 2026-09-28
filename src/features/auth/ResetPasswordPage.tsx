import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";

import { Field } from "@/components/common";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import { applyApiErrors } from "@/lib/forms";

import { AuthLayout } from "./AuthLayout";
import { newPasswordSchema } from "./passwordSchema";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(uid && token ? null : t("auth.invalidLink"));

  const schema = useMemo(() => newPasswordSchema(t), [t]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiRequest("/auth/password/reset/confirm/", {
        method: "POST",
        body: { uid, token, new_password: values.new_password },
        auth: false,
      });
      setDone(true);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["new_password"], t);
      if (message) setFormError(message);
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <AuthLayout title={t("auth.resetTitle")} subtitle={done ? undefined : t("auth.resetSubtitle")}>
      {done ? (
        <div className="grid gap-6">
          <Alert>
            <CheckCircle2 />
            <AlertDescription>{t("auth.resetDone")}</AlertDescription>
          </Alert>
          <Button asChild size="lg">
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <Field label={t("auth.newPassword")} htmlFor="new_password" error={errors.new_password?.message}>
            <PasswordInput id="new_password" autoComplete="new-password" {...form.register("new_password")} />
          </Field>
          <Field label={t("auth.confirmPassword")} htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
          <Button type="submit" size="lg" disabled={isSubmitting || !uid || !token}>
            {t("auth.setPassword")}
          </Button>
          <Link to="/forgot-password" className="text-primary text-sm hover:underline">
            {t("auth.forgotTitle")}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
