import { FilePlus2, ReceiptText, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { SearchInput, StatusBadge } from "@/components/display";
import { ClassSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import type { PaymentStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { useInvoices, useMoney } from "./api";
import { GenerateInvoicesDialog, ManualInvoiceDialog } from "./InvoiceDialogs";

const DEFAULTS = { q: "", year: "", class: "", status: "", page: "1" };
const PAGE_SIZE = 50;
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "partial", "overdue", "paid", "cancelled"];

export function InvoicesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const formatDate = useFormatDate();
  const money = useMoney();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const page = Number(filters.page);
  const invoices = useInvoices(
    {
      search,
      academic_year: yearId ?? undefined,
      class_group: filters.class || undefined,
      payment_status: filters.status || undefined,
      page,
      page_size: PAGE_SIZE,
    },
    yearId !== null,
  );
  const [dialog, setDialog] = useState<"generate" | "manual" | null>(null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("finance.invoicesIntro")}</p>
        {can("finance.invoice.create") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialog("generate")}>
              <Sparkles /> {t("finance.generate")}
            </Button>
            <Button onClick={() => setDialog("manual")}>
              <FilePlus2 /> {t("finance.newInvoice")}
            </Button>
          </div>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_12rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder={t("finance.searchInvoices")} />
        <YearSelect
          value={yearId}
          onChange={(v) => setFilters({ year: v ? String(v) : "", class: "" })}
          aria-label={t("classes.year")}
        />
        <ClassSelect
          yearId={yearId}
          value={toNumberOrNull(filters.class)}
          onChange={(v) => setFilters({ class: v ? String(v) : "" })}
          allLabel={t("classes.allClasses")}
          aria-label={t("classes.chooseClass")}
        />
        <OptionSelect<PaymentStatus>
          value={(filters.status || null) as PaymentStatus | null}
          onChange={(v) => setFilters({ status: v ?? "" })}
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          allLabel={t("finance.allStatuses")}
          aria-label={t("common.status")}
        />
      </div>
      {invoices.isError ? (
        <QueryError onRetry={() => void invoices.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {invoices.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : invoices.data.results.length === 0 ? (
            <EmptyState icon={<ReceiptText className="size-8" />} title={t("finance.noInvoices")}>
              {t("finance.noInvoicesHint")}
            </EmptyState>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.number")}</TableHead>
                    <TableHead>{t("finance.student")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("classes.chooseClass")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("finance.issueDate")}</TableHead>
                    <TableHead className="text-right">{t("common.total")}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">{t("finance.balance")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data.results.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/finance/invoices/${invoice.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                      <TableCell>
                        <span className="block font-medium">{invoice.student_name}</span>
                        <span className="text-muted-foreground block text-xs">{invoice.student_number}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {invoice.class_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {formatDate(invoice.issue_date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money.format(invoice.total)}</TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                        {money.format(invoice.balance)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.payment_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={invoices.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {dialog === "generate" && <GenerateInvoicesDialog defaultYearId={yearId} onClose={() => setDialog(null)} />}
      {dialog === "manual" && <ManualInvoiceDialog defaultYearId={yearId} onClose={() => setDialog(null)} />}
    </>
  );
}
