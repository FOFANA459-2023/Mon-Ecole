import { HandCoins, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { SearchInput, StatusBadge } from "@/components/display";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaymentMethod, PaymentState } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

import { PAYMENT_METHODS, useMoney, usePayments } from "./api";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

const DEFAULTS = { q: "", method: "", status: "", from: "", to: "", page: "1" };
const PAGE_SIZE = 50;
const STATES: PaymentState[] = ["posted", "reversed"];

export function PaymentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const formatDate = useFormatDate();
  const money = useMoney();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const payments = usePayments({
    search,
    method: filters.method || undefined,
    status: filters.status || undefined,
    date__gte: filters.from || undefined,
    date__lte: filters.to || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const [recording, setRecording] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("finance.paymentsIntro")}</p>
        {can("finance.payment.record") && (
          <Button onClick={() => setRecording(true)}>
            <HandCoins /> {t("finance.recordPayment")}
          </Button>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_10rem_10rem_10rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder={t("finance.searchPayments")} />
        <OptionSelect<PaymentMethod>
          value={(filters.method || null) as PaymentMethod | null}
          onChange={(v) => setFilters({ method: v ?? "" })}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
          allLabel={t("finance.allMethods")}
          aria-label={t("finance.method")}
        />
        <OptionSelect<PaymentState>
          value={(filters.status || null) as PaymentState | null}
          onChange={(v) => setFilters({ status: v ?? "" })}
          options={STATES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          allLabel={t("finance.allStatuses")}
          aria-label={t("common.status")}
        />
        <Input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => setFilters({ from: e.target.value })}
          aria-label={t("finance.fromDate")}
        />
        <Input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => setFilters({ to: e.target.value })}
          aria-label={t("finance.toDate")}
        />
      </div>
      {payments.isError ? (
        <QueryError onRetry={() => void payments.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {payments.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : payments.data.results.length === 0 ? (
            <EmptyState icon={<Wallet className="size-8" />} title={t("finance.noPayments")}>
              {t("finance.noPaymentsHint")}
            </EmptyState>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.receiptNumber")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("finance.paymentDate")}</TableHead>
                    <TableHead>{t("finance.student")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("finance.method")}</TableHead>
                    <TableHead className="text-right">{t("finance.amount")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("finance.receivedBy")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.data.results.map((payment) => (
                    <TableRow
                      key={payment.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/finance/payments/${payment.id}`)}
                    >
                      <TableCell>
                        <span className="block font-mono text-xs">{payment.number}</span>
                        <span className="text-muted-foreground block text-xs sm:hidden">{formatDate(payment.date)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <span className="block font-medium">{payment.student_name}</span>
                        <span className="text-muted-foreground block text-xs">{payment.student_number}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {t(`finance.methods.${payment.method}`)}
                      </TableCell>
                      <TableCell
                        className={
                          payment.status === "reversed"
                            ? "text-muted-foreground text-right tabular-nums line-through"
                            : "text-right font-medium tabular-nums"
                        }
                      >
                        {money.format(payment.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {payment.received_by_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={payments.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {recording && <RecordPaymentDialog onClose={() => setRecording(false)} />}
    </>
  );
}
