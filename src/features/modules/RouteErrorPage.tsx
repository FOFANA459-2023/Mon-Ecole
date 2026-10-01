import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";

import { BrandMark } from "@/components/common";
import { Button } from "@/components/ui/button";

/** Browser translation (or an extension) rewrote the page's text under React: the usual cause of this. */
function looksLikeTranslation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "NotFoundError" &&
    /removeChild|insertBefore/.test(error.message)
  );
}

/** Shown instead of React Router's developer screen when a page crashes. */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (error) console.error(error);
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandMark className="size-12" />
      <h1 className="text-xl font-semibold">{t("errors.crashTitle")}</h1>
      <p className="text-muted-foreground max-w-md">
        {looksLikeTranslation(error) ? t("errors.crashTranslation") : t("errors.crashBody")}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>
          <RotateCcw /> {t("errors.reload")}
        </Button>
        <Button variant="outline" onClick={() => window.location.assign("/")}>
          {t("errors.goHome")}
        </Button>
      </div>
    </div>
  );
}
