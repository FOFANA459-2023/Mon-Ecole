import { ArrowLeft, ArrowLeftRight, Lock, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { QueryError, Spinner } from "@/components/common";
import { StatusBadge } from "@/components/display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMoney } from "@/features/finance/api";
import type { CashMovement } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

import { printJournal, useCashSession, useFormatDateTime } from "./api";
import { CloseSessionDialog, MovementDialog } from "./CashDialogs";

/** Where a movement came from: the payment, the expense or the student refunded. */
function movementLink(movement: CashMovement): string | null {
  if (movement.payment) return `/finance/payments/${movement.payment}`;
  if (movement.expense_number) return `/finance/expenses?q=${encodeURIComponent(movement.expense_number)}`;
  if (movement.refund && movement.student) return `/students/${movement.student}?tab=payments`;
  return null;
}

export function CashSessionPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const money = useMoney();
  const { dateTime, time } = useFormatDateTime();
  const id = Number(useParams().id);
  const query = useCashSession(Number.isFinite(id) ? id : undefined);
  const [dialog, setDialog] = useState<"movement" | "close" | null>(null);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Spinner className="mx-auto my-16 size-6" />;
  const session = query.data;
  const open = session.status === "open";
  const difference = Number(session.difference ?? 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cash-register">
            <ArrowLeft /> {t("nav.cashRegister")}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {open && can("cash.record") && (
            <Button variant="outline" onClick={() => setDialog("movement")}>
              <ArrowLeftRight /> {t("cash.movementTitle")}
            </Button>
          )}
          <Button variant="outline" onClick={() => printJournal(session.id, t)}>
            <Printer /> {t("cash.printJournal")}
          </Button>
          {open && can("cash.close") && (
            <Button onClick={() => setDialog("close")}>
              <Lock /> {t("cash.close")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-4">
            <div>
              <CardTitle>{session.register_name}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("cash.openedBy", { date: dateTime(session.opened_at), name: session.opened_by_name ?? "—" })}
              </p>
            </div>
            <StatusBadge status={session.status} />
          </CardHeader>
          {session.movements.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">{t("cash.noMovements")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("cash.time")}</TableHead>
                  <TableHead>{t("finance.description")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("cash.by")}</TableHead>
                  <TableHead className="text-right">{t("cash.directions.in")}</TableHead>
                  <TableHead className="text-right">{t("cash.directions.out")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {session.movements.map((movement) => {
                  const link = movementLink(movement);
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{time(movement.created_at)}</TableCell>
                      <TableCell>
                        {link ? (
                          <Link to={link} className="text-primary hover:underline">
                            {movement.description}
                          </Link>
                        ) : (
                          movement.description
                        )}
                        <span className="text-muted-foreground block text-xs">{t(`cash.sources.${movement.source}`)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {movement.created_by_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {movement.direction === "in" ? money.format(movement.amount) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {movement.direction === "out" ? money.format(movement.amount) : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("finance.summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {[
                [t("cash.float"), money.format(session.opening_balance)],
                [t("cash.totalIn"), money.format(session.money_in)],
                [t("cash.totalOut"), `− ${money.format(session.money_out)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
                <dt>{t("cash.expected")}</dt>
                <dd className="tabular-nums">{money.format(session.expected_closing ?? session.expected)}</dd>
              </div>
              {session.counted_closing !== null && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t("cash.counted")}</dt>
                    <dd className="font-medium tabular-nums">{money.format(session.counted_closing)}</dd>
                  </div>
                  <div
                    className={cn(
                      "flex justify-between gap-3",
                      difference < 0 && "text-destructive",
                      difference > 0 && "text-amber-700",
                    )}
                  >
                    <dt>{t("cash.difference")}</dt>
                    <dd className="font-medium tabular-nums">{money.format(session.difference ?? 0)}</dd>
                  </div>
                  {session.closing_note && (
                    <p className="text-muted-foreground border-t pt-2 whitespace-pre-line">{session.closing_note}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {t("cash.closedBy", { date: dateTime(session.closed_at), name: session.closed_by_name ?? "—" })}
                  </p>
                </>
              )}
            </dl>
            {session.by_source.length > 0 && (
              <ul className="mt-4 grid gap-1 border-t pt-3 text-sm">
                {session.by_source.map((row) => (
                  <li key={`${row.source}-${row.direction}`} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t(`cash.sources.${row.source}`)} ({row.count})
                    </span>
                    <span className="tabular-nums">
                      {row.direction === "out" ? "− " : "+ "}
                      {money.format(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog === "movement" && <MovementDialog sessionId={session.id} onClose={() => setDialog(null)} />}
      {dialog === "close" && (
        <CloseSessionDialog
          session={{ id: session.id, register_name: session.register_name, expected: session.expected }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
