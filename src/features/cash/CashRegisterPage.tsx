import { Landmark, LockOpen, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { EmptyState, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { StatusBadge } from "@/components/display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMoney } from "@/features/finance/api";
import type { CashRegister } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

import { useCashRegisters, useCashSessions, useFormatDateTime } from "./api";
import { CloseSessionDialog, OpenSessionDialog, RegisterDialog } from "./CashDialogs";

const PAGE_SIZE = 20;

type Dialog =
  | { kind: "open"; register: CashRegister }
  | { kind: "close"; register: CashRegister }
  | { kind: "register"; register?: CashRegister };

/** The school's registers, whether each is open and what it should hold, and the sessions so far. */
export function CashRegisterPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const money = useMoney();
  const { dateTime } = useFormatDateTime();
  const registers = useCashRegisters();
  const [page, setPage] = useState(1);
  const sessions = useCashSessions({ page, page_size: PAGE_SIZE });
  const [dialog, setDialog] = useState<Dialog | null>(null);

  return (
    <>
      <PageHeader
        title={t("nav.cashRegister")}
        description={t("cash.subtitle")}
        actions={
          can("cash.open") && (
            <Button variant="outline" onClick={() => setDialog({ kind: "register" })}>
              <Plus /> {t("cash.newRegister")}
            </Button>
          )
        }
      />
      {registers.isError ? (
        <QueryError onRetry={() => void registers.refetch()} />
      ) : registers.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {registers.data.map((register) => {
            const session = register.open_session;
            return (
              <Card key={register.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="text-muted-foreground size-5" /> {register.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {!register.is_active && <StatusBadge status="archived" />}
                    <StatusBadge status={session ? "open" : "closed"} />
                    {can("cash.open") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("cash.editRegister")}
                        onClick={() => setDialog({ kind: "register", register })}
                      >
                        <Pencil />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {session ? (
                    <>
                      <div>
                        <p className="text-muted-foreground text-sm">{t("cash.expectedNow")}</p>
                        <p className="text-3xl font-semibold tabular-nums">{money.format(session.expected)}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t("cash.openedBy", { date: dateTime(session.opened_at), name: session.opened_by_name ?? "—" })}
                          {" · "}
                          {t("cash.float")} {money.format(session.opening_balance)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild>
                          <Link to={`/cash-register/sessions/${session.id}`}>{t("cash.viewSession")}</Link>
                        </Button>
                        {can("cash.close") && (
                          <Button variant="outline" onClick={() => setDialog({ kind: "close", register })}>
                            {t("cash.close")}
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm">
                        {t("cash.lastCount", { amount: money.format(register.last_counted) })}
                      </p>
                      {can("cash.open") && register.is_active && (
                        <div>
                          <Button onClick={() => setDialog({ kind: "open", register })}>
                            <LockOpen /> {t("cash.open")}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">{t("cash.sessions")}</CardTitle>
        </CardHeader>
        {sessions.isError ? (
          <QueryError onRetry={() => void sessions.refetch()} />
        ) : sessions.isPending ? (
          <Spinner className="mx-auto my-10 size-6" />
        ) : sessions.data.results.length === 0 ? (
          <EmptyState icon={<Landmark className="size-8" />} title={t("cash.noSessions")}>
            {t("cash.noSessionsHint")}
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("cash.openedAt")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("cash.register")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("cash.openedByColumn")}</TableHead>
                  <TableHead className="text-right">{t("cash.expected")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("cash.counted")}</TableHead>
                  <TableHead className="text-right">{t("cash.difference")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.data.results.map((session) => {
                  const difference = Number(session.difference ?? 0);
                  return (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/cash-register/sessions/${session.id}`)}
                    >
                      <TableCell>
                        <span className="block">{dateTime(session.opened_at)}</span>
                        <span className="text-muted-foreground block text-xs sm:hidden">{session.register_name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{session.register_name}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {session.opened_by_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(session.expected_closing ?? session.expected)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {session.counted_closing !== null ? money.format(session.counted_closing) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          difference < 0 && "text-destructive font-medium",
                          difference > 0 && "font-medium text-amber-700",
                        )}
                      >
                        {session.difference !== null ? money.format(session.difference) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={session.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} count={sessions.data.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      {dialog?.kind === "open" && <OpenSessionDialog register={dialog.register} onClose={() => setDialog(null)} />}
      {dialog?.kind === "close" && dialog.register.open_session && (
        <CloseSessionDialog
          session={{ ...dialog.register.open_session, register_name: dialog.register.name }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "register" && <RegisterDialog register={dialog.register} onClose={() => setDialog(null)} />}
    </>
  );
}
