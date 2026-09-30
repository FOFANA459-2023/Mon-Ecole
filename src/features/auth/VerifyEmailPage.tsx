import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { Spinner } from "@/components/common";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

import { AuthLayout } from "./AuthLayout";

type State = { kind: "checking" } | { kind: "done"; email: string } | { kind: "failed"; message: string };

/** The link in an invitation email: confirms the address, then sends the person to sign in. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(
    token ? { kind: "checking" } : { kind: "failed", message: t("auth.invalidLink") },
  );
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    apiRequest<{ email: string }>("/auth/verify-email/", { method: "POST", body: { token }, auth: false })
      .then((data) => setState({ kind: "done", email: data.email }))
      .catch((error: unknown) => setState({ kind: "failed", message: errorMessage(error, t) }));
  }, [token, t]);

  return (
    <AuthLayout title={t("auth.verifyTitle")}>
      {state.kind === "checking" && <Spinner className="mx-auto my-8 size-6" />}
      {state.kind === "done" && (
        <div className="grid gap-6">
          <Alert>
            <CheckCircle2 />
            <AlertDescription>{t("auth.verifyDone", { email: state.email })}</AlertDescription>
          </Alert>
          <Button asChild size="lg">
            {/* The address travels in router state, not in the URL (no email in history or server logs). */}
            <Link to="/login" state={{ email: state.email }}>
              {t("auth.signIn")}
            </Link>
          </Button>
        </div>
      )}
      {state.kind === "failed" && (
        <div className="grid gap-6">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
          <Button asChild variant="outline">
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
