import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { GradebookStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STYLES: Record<GradebookStatus, string> = {
  open: "bg-muted text-muted-foreground border-transparent",
  submitted: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  published: "bg-success/15 text-success border-transparent",
};

/** In progress / Submitted / Published. */
export function GradebookStatusBadge({ status, className }: { status: GradebookStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STYLES[status], className)}>
      {t(`grades.status.${status}`)}
    </Badge>
  );
}
