import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/context";

import { AuthLayout } from "./AuthLayout";
import { ChangePasswordForm } from "./ChangePasswordForm";

/** First sign-in with the temporary password from the invitation: it must be replaced before continuing. */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthLayout title={t("auth.changeTitle")} subtitle={t("auth.changeForced")}>
      <ChangePasswordForm firstPassword onDone={() => navigate("/", { replace: true })} />
      <Button variant="link" className="mt-4 px-0" onClick={() => void logout()}>
        {t("nav.logout")}
      </Button>
    </AuthLayout>
  );
}
