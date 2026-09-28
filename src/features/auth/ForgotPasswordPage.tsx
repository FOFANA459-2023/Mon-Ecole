import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const schema = useMemo(() => z.object({ email: z.email(t("validation.email")) }), [t]);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiRequest("/auth/password/reset/", { method: "POST", body: values, auth: false });
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  });

  return (
    <AuthLayout title={t("auth.forgotTitle")} subtitle={sent ? undefined : t("auth.forgotSubtitle")}>
      {sent ? (
        <Alert>
          <MailCheck />
          <AlertDescription>{t("auth.linkSent")}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <Field label={t("auth.email")} htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
          </Field>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}
      <Link to="/login" className="text-primary mt-6 inline-block text-sm hover:underline">
        ← {t("auth.backToLogin")}
      </Link>
    </AuthLayout>
  );
}
