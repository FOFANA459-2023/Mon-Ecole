import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, DatabaseBackup, Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader, QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Paginated } from "@/lib/api/client";
import type { Backup } from "@/lib/api/types";
import { downloadFile } from "@/lib/files";
import { formatDateTime, localeFor } from "@/lib/format";
import { errorMessage } from "@/lib/forms";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  running: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  done: "bg-success/15 text-success",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

function useBackups() {
  return useQuery({
    queryKey: ["platform", "backups"],
    queryFn: ({ signal }) => api.get<Paginated<Backup>>("/platform/backups/", { page_size: 50 }, signal),
    // Follow a running backup until it ends.
    refetchInterval: (query) => (query.state.data?.results.some((b) => b.status === "running") ? 3000 : false),
  });
}

/** The platform owner's backups: every 4 hours on its own, or now; the files are kept 30 days. */
export function PlatformBackupsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const backups = useBackups();
  const [starting, setStarting] = useState(false);
  const running = backups.data?.results.some((b) => b.status === "running") ?? false;
  const size = (bytes: number) =>
    new Intl.NumberFormat(localeFor(i18n.language), {
      style: "unit",
      unit: bytes > 1024 * 1024 ? "megabyte" : "kilobyte",
      maximumFractionDigits: 1,
    }).format(bytes > 1024 * 1024 ? bytes / 1024 / 1024 : bytes / 1024);

  const backUpNow = async () => {
    setStarting(true);
    try {
      await api.post("/platform/backups/");
      await queryClient.invalidateQueries({ queryKey: ["platform", "backups"] });
      toast.success(t("platform.backups.started"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/platform">
          <ArrowLeft /> {t("platform.title")}
        </Link>
      </Button>
      <PageHeader
        title={t("platform.backups.title")}
        description={t("platform.backups.subtitle")}
        actions={
          <Button onClick={() => void backUpNow()} disabled={starting || running}>
            <DatabaseBackup /> {running ? t("platform.backups.running") : t("platform.backups.now")}
          </Button>
        }
      />
      {backups.isError ? (
        <QueryError error={backups.error} onRetry={() => void backups.refetch()} />
      ) : backups.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : backups.data.results.length === 0 ? (
        <Card>
          <EmptyState icon={<DatabaseBackup className="size-8" />} title={t("platform.backups.none")} />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("platform.backups.when")}</TableHead>
                <TableHead>{t("platform.backups.kind")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("platform.backups.size")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.data.results.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>
                    {formatDateTime(backup.started_at, i18n.language)}
                    {backup.created_by_name && (
                      <span className="text-muted-foreground block text-xs">{backup.created_by_name}</span>
                    )}
                  </TableCell>
                  <TableCell>{t(`platform.backups.kinds.${backup.kind}`)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("border-transparent", STATUS_STYLES[backup.status ?? "done"])}>
                      {t(`platform.backups.statuses.${backup.status}`)}
                    </Badge>
                    {backup.error && <span className="text-muted-foreground block text-xs">{backup.error}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{backup.size ? size(backup.size) : "—"}</TableCell>
                  <TableCell>
                    {backup.has_file && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("platform.backups.download")}
                        onClick={() =>
                          downloadFile(`/platform/backups/${backup.id}/download/`, undefined, "backup.dump").catch((error) =>
                            toast.error(errorMessage(error, t)),
                          )
                        }
                      >
                        <Download />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <p className="text-muted-foreground mt-3 text-xs">{t("platform.backups.restoreHint")}</p>
    </>
  );
}
