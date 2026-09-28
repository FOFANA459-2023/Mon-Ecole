import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useAuditLogs } from "./api";

const PAGE_SIZE = 25;
const ACTIONS = [
  "login",
  "logout",
  "login_failed",
  "create",
  "update",
  "delete",
  "password_change",
  "password_reset",
  "password_reset_request",
  "invite_sent",
];
const MODULES = ["auth", "users", "settings", "schools"];

function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "login_failed" || action === "delete") return "destructive";
  if (action === "create" || action === "update") return "default";
  return "secondary";
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function AuditDetail({ entry, onClose }: { entry: AuditLogEntry | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { membership } = useAuth();
  const oldValues = (entry?.old_values ?? {}) as Record<string, unknown>;
  const newValues = (entry?.new_values ?? {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])].sort();

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>{entry.summary || entry.action}</DialogTitle>
              <DialogDescription>
                {formatDateTime(entry.created_at, i18n.language, membership?.school.timezone)} ·{" "}
                {entry.user_name || t("settings.audit.system")} · {entry.ip ?? "—"}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm font-medium">{t("settings.audit.changes")}</p>
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("settings.audit.noChanges")}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("settings.audit.field")}</TableHead>
                      <TableHead>{t("settings.audit.before")}</TableHead>
                      <TableHead>{t("settings.audit.after")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field}>
                        <TableCell className="font-mono text-xs">{field}</TableCell>
                        <TableCell className="text-muted-foreground max-w-48 text-sm break-words whitespace-normal">
                          {display(oldValues[field])}
                        </TableCell>
                        <TableCell className="max-w-48 text-sm break-words whitespace-normal">
                          {display(newValues[field])}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const { membership } = useAuth();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [module, setModule] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const logs = useAuditLogs({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    action: action === "all" ? undefined : action,
    module: module === "all" ? undefined : module,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const actionLabel = (value: string) =>
    ACTIONS.includes(value) ? t(`settings.audit.actions.${value}`) : value;
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_10rem_9.5rem_9.5rem]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder={t("common.search")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
        <Select value={action} onValueChange={resetPage(setAction)}>
          <SelectTrigger className="w-full" aria-label={t("settings.audit.action")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("settings.audit.action")} · {t("common.all")}
            </SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={module} onValueChange={resetPage(setModule)}>
          <SelectTrigger className="w-full" aria-label={t("settings.audit.module")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("settings.audit.module")} · {t("common.all")}
            </SelectItem>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-1">
          <Label htmlFor="audit-from" className="sr-only">
            {t("settings.audit.from")}
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(e) => resetPage(setDateFrom)(e.target.value)}
            title={t("settings.audit.from")}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-to" className="sr-only">
            {t("settings.audit.to")}
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(e) => resetPage(setDateTo)(e.target.value)}
            title={t("settings.audit.to")}
          />
        </div>
      </div>

      {logs.isError ? (
        <QueryError onRetry={() => void logs.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {logs.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : logs.data.results.length === 0 ? (
            <EmptyState title={t("settings.audit.empty")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.audit.date")}</TableHead>
                    <TableHead>{t("settings.audit.user")}</TableHead>
                    <TableHead>{t("settings.audit.action")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("settings.audit.summary")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("settings.audit.ip")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.results.map((entry) => (
                    <TableRow key={entry.id} className="cursor-pointer" onClick={() => setSelected(entry)}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(entry.created_at, i18n.language, membership?.school.timezone)}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm">
                        {entry.user_name || t("settings.audit.system")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariant(entry.action)}>{actionLabel(entry.action)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-md truncate text-sm md:table-cell">
                        {entry.summary}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                        {entry.ip ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} count={logs.data.count} onPageChange={setPage} />
            </>
          )}
        </Card>
      )}
      <AuditDetail entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
