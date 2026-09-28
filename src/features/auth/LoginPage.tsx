import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";

import { Field } from "@/components/common";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";

import { AuthLayout } from "./AuthLayout";

/** Only follow same-app paths after sign-in (no open redirects). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        login: z.string().trim().min(1, t("validation.required")),
        password: z.string().min(1, t("validation.required")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { login: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.login, values.password);
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_credentials") {
        setFormError(t("auth.invalidCredentials"));
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(t("auth.tooManyAttempts"));
      } else {
        setFormError(errorMessage(error, t));
      }
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <AuthLayout title={t("auth.signInTitle")} subtitle={t("auth.signInSubtitle")}>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field label={t("auth.login")} htmlFor="login" error={errors.login?.message}>
          <Input id="login" autoComplete="username" autoFocus {...form.register("login")} />
        </Field>
        <Field label={t("auth.password")} htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-primary text-sm hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
    </AuthLayout>
  );
}
