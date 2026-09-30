import { Ban, Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { SearchInput, StatusBadge } from "@/components/display";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

import { EXPENSE_CATEGORIES, PAYMENT_METHODS, useExpenses, useMoney } from "./api";
import { ExpenseDialog } from "./ExpenseDialog";
import { ReasonDialog } from "./ReasonDialog";

const DEFAULTS = { q: "", category: "", method: "", status: "", from: "", to: "", page: "1" };
const PAGE_SIZE = 50;

export function ExpensesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const money = useMoney();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const expenses = useExpenses({
    search,
    category: filters.category || undefined,
    method: filters.method || undefined,
    status: filters.status || undefined,
    date__gte: filters.from || undefined,
    date__lte: filters.to || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState<Expense | null>(null);
  const canRecord = can("finance.expense.create");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("finance.expensesIntro")}</p>
        {canRecord && (
          <Button onClick={() => setRecording(true)}>
            <Plus /> {t("finance.recordExpense")}
          </Button>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_9rem_9rem_9rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder={t("finance.searchExpenses")} />
        <OptionSelect<ExpenseCategory>
          value={(filters.category || null) as ExpenseCategory | null}
          onChange={(v) => setFilters({ category: v ?? "" })}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`finance.expenseCategories.${c}`) }))}
          allLabel={t("finance.allCategoriesFilter")}
          aria-label={t("finance.expenseCategory")}
        />
        <OptionSelect<PaymentMethod>
          value={(filters.method || null) as PaymentMethod | null}
          onChange={(v) => setFilters({ method: v ?? "" })}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
          allLabel={t("finance.allMethods")}
          aria-label={t("finance.method")}
        />
        <OptionSelect<"recorded" | "cancelled">
          value={(filters.status || null) as "recorded" | "cancelled" | null}
          onChange={(v) => setFilters({ status: v ?? "" })}
          options={(["recorded", "cancelled"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
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
      {expenses.isError ? (
        <QueryError onRetry={() => void expenses.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {expenses.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : expenses.data.results.length === 0 ? (
            <EmptyState icon={<Receipt className="size-8" />} title={t("finance.noExpenses")}>
              {t("finance.noExpensesHint")}
            </EmptyState>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.number")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("finance.expenseDate")}</TableHead>
                    <TableHead>{t("finance.description")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("finance.expenseCategory")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("finance.method")}</TableHead>
                    <TableHead className="text-right">{t("finance.amount")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    {canRecord && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.data.results.map((expense) => {
                    const cancelled = expense.status === "cancelled";
                    return (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <span className="block font-mono text-xs">{expense.number}</span>
                          <span className="text-muted-foreground block text-xs sm:hidden">{formatDate(expense.date)}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <span className="block">{expense.description}</span>
                          <span className="text-muted-foreground block text-xs">
                            {[expense.payee, cancelled && expense.cancel_reason].filter(Boolean).join(" — ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {t(`finance.expenseCategories.${expense.category}`)}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">
                          {t(`finance.methods.${expense.method}`)}
                        </TableCell>
                        <TableCell
                          className={
                            cancelled
                              ? "text-muted-foreground text-right tabular-nums line-through"
                              : "text-right font-medium tabular-nums"
                          }
                        >
                          {money.format(expense.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={expense.status} />
                        </TableCell>
                        {canRecord && (
                          <TableCell>
                            {!cancelled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("finance.cancelExpense", { number: expense.number })}
                                onClick={() => setCancelling(expense)}
                              >
                                <Ban />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={expenses.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {recording && <ExpenseDialog onClose={() => setRecording(false)} />}
      {cancelling && (
        <ReasonDialog
          title={t("finance.cancelExpense", { number: cancelling.number })}
          hint={t("finance.cancelExpenseHint")}
          confirmLabel={t("finance.confirmCancelExpense")}
          path={`/expenses/${cancelling.id}/cancel/`}
          success={t("finance.expenseCancelled", { number: cancelling.number })}
          onClose={() => setCancelling(null)}
        />
      )}
    </>
  );
}
