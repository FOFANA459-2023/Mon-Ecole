import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-primary text-5xl font-semibold">404</p>
      <h1 className="text-xl font-semibold">{t("errors.notFound")}</h1>
      <p className="text-muted-foreground">{t("errors.notFoundBody")}</p>
      <Button asChild className="mt-2">
        <Link to="/">{t("errors.goHome")}</Link>
      </Button>
    </div>
  );
}
