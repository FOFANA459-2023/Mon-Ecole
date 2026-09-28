import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="7" fill="currentColor" className="text-primary" />
      <path d="M16 7 5 12.5 16 18l9-4.5V20h2v-7.5L16 7Z" fill="#5fd3b8" />
      <path d="M10 16.2v4.3c0 1.7 2.7 3.5 6 3.5s6-1.8 6-3.5v-4.3L16 19.2l-6-3Z" fill="#fff" />
    </svg>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("text-muted-foreground size-5 animate-spin", className)} aria-hidden="true" />;
}

export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-label={t("common.loading")}>
      <Spinner className="size-8" />
    </div>
  );
}

export function QueryError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{t("errors.loadFailed")}</AlertTitle>
      {onRetry && (
        <AlertDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </AlertDescription>
      )}
    </Alert>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-muted-foreground mb-1">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted-foreground max-w-md text-sm">{children}</div>}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <span>{t("common.results", { count })}</span>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">{t("common.pageOf", { page, pages })}</span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t("common.previous")}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
