import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Field, QueryError, Spinner } from "@/components/common";
import { ClassSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import { useCashRegisters } from "@/features/cash/api";
import type { Query } from "@/lib/api/client";
import type { ExpenseCategory, PaymentMethod, ReportSection } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { downloadFile, openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./api";
import { PERIODS, periodDates, REPORTS, type ReportKey, useFinanceReport, useReportCell } from "./reports";

const NUMERIC = new Set(["money", "number", "percent"]);
const DEFAULTS = {
  report: "payments",
  from: "",
  to: "",
  year: "",
  class: "",
  register: "",
  method: "",
  category: "",
  overdue: "",
};

/** The finance reports of the Terms of Reference, on screen and as PDF, Excel or CSV. */
export function ReportsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const currentYear = useCurrentYear();
  const registers = useCashRegisters(can("cash.view"));
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const report = (REPORTS.includes(filters.report as ReportKey) ? filters.report : "payments") as ReportKey;
  const month = periodDates("month", new Date());
  const from = filters.from || month.from;
  const to = filters.to || month.to;
  // The financial report always covers a school year: the current one unless another is chosen.
  const yearId = toNumberOrNull(filters.year) ?? (report === "summary" ? (currentYear?.id ?? null) : null);
  const classYearId = yearId ?? currentYear?.id ?? null;
  const usesPeriod = report !== "outstanding";

  const params: Query = {
    ...(usesPeriod && { date_from: from, date_to: to }),
    ...((report === "outstanding" || report === "summary") && yearId && { academic_year: yearId }),
    ...((report === "payments" || report === "outstanding") && filters.class && { class_group: filters.class }),
    ...(report === "cash" && filters.register && { register: filters.register }),
    ...((report === "payments" || report === "expenses") && filters.method && { method: filters.method }),
    ...(report === "expenses" && filters.category && { category: filters.category }),
    ...(report === "outstanding" && filters.overdue && { overdue_only: "true" }),
  };
  const query = useFinanceReport(report, params);
  const path = `/reports/finance/${report}/`;
  const download = (format: "pdf" | "xlsx" | "csv") => {
    const request =
      format === "pdf"
        ? openPdf(path, { ...params, export: format })
        : downloadFile(path, { ...params, export: format }, `${report}.${format}`);
    request.catch((error) => toast.error(errorMessage(error, t)));
  };

  return (
    <>
      <p className="text-muted-foreground mb-4 text-sm">{t("reports.intro")}</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label={t("reports.choose")}>
        {REPORTS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === report}
            onClick={() => setFilters({ report: key, class: "", method: "", category: "", overdue: "", register: "" })}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              key === report ? "border-primary bg-primary/5" : "hover:bg-muted",
            )}
          >
            <span className="block text-sm font-medium">{t(`reports.names.${key}`)}</span>
            <span className="text-muted-foreground block text-xs">{t(`reports.descriptions.${key}`)}</span>
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="grid gap-4">
          {usesPeriod && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("reports.period")}>
                {PERIODS.map((period) => {
                  const dates = periodDates(period, new Date(), currentYear?.start_date);
                  const active = dates.from === from && dates.to === to;
                  return (
                    <Button
                      key={period}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setFilters({ from: dates.from, to: dates.to })}
                    >
                      {t(`reports.periods.${period}`)}
                    </Button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
                <Field label={t("finance.fromDate")} htmlFor="r-from">
                  <Input id="r-from" type="date" value={from} max={to} onChange={(e) => setFilters({ from: e.target.value })} />
                </Field>
                <Field label={t("finance.toDate")} htmlFor="r-to">
                  <Input id="r-to" type="date" value={to} min={from} onChange={(e) => setFilters({ to: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(report === "outstanding" || report === "summary") && (
              <Field label={t("classes.year")} htmlFor="r-year">
                <YearSelect
                  id="r-year"
                  value={yearId}
                  onChange={(v) => setFilters({ year: v ? String(v) : "", class: "" })}
                  allLabel={report === "outstanding" ? t("reports.allYears") : undefined}
                />
              </Field>
            )}
            {(report === "payments" || report === "outstanding") && (
              <Field label={t("classes.chooseClass")} htmlFor="r-class">
                <ClassSelect
                  id="r-class"
                  yearId={classYearId}
                  value={toNumberOrNull(filters.class)}
                  onChange={(v) => setFilters({ class: v ? String(v) : "" })}
                  allLabel={t("classes.allClasses")}
                />
              </Field>
            )}
            {(report === "payments" || report === "expenses") && (
              <Field label={t("finance.method")} htmlFor="r-method">
                <OptionSelect<PaymentMethod>
                  id="r-method"
                  value={(filters.method || null) as PaymentMethod | null}
                  onChange={(v) => setFilters({ method: v ?? "" })}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))}
                  allLabel={t("finance.allMethods")}
                />
              </Field>
            )}
            {report === "expenses" && (
              <Field label={t("finance.expenseCategory")} htmlFor="r-category">
                <OptionSelect<ExpenseCategory>
                  id="r-category"
                  value={(filters.category || null) as ExpenseCategory | null}
                  onChange={(v) => setFilters({ category: v ?? "" })}
                  options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`finance.expenseCategories.${c}`) }))}
                  allLabel={t("finance.allCategoriesFilter")}
                />
              </Field>
            )}
            {report === "cash" && can("cash.view") && (registers.data?.length ?? 0) > 1 && (
              <Field label={t("cash.register")} htmlFor="r-register">
                <OptionSelect
                  id="r-register"
                  value={filters.register || null}
                  onChange={(v) => setFilters({ register: v ?? "" })}
                  options={(registers.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
                  allLabel={t("reports.allRegisters")}
                />
              </Field>
            )}
            {report === "outstanding" && (
              <div className="flex items-center gap-2 self-end pb-2">
                <Checkbox
                  id="r-overdue"
                  checked={filters.overdue === "1"}
                  onCheckedChange={(checked) => setFilters({ overdue: checked ? "1" : "" })}
                />
                <Label htmlFor="r-overdue">{t("reports.overdueOnly")}</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : (
        <div className={cn("grid gap-4", query.isFetching && "opacity-60")}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{query.data.title}</h2>
              <p className="text-muted-foreground text-sm">{query.data.subtitle}</p>
            </div>
            {can("finance.export") && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => download("pdf")}>
                  <Printer /> PDF
                </Button>
                <Button variant="outline" onClick={() => download("xlsx")}>
                  <FileSpreadsheet /> Excel
                </Button>
                <Button variant="outline" onClick={() => download("csv")}>
                  <FileText /> CSV
                </Button>
              </div>
            )}
          </div>
          {query.data.sections.map((section) => (
            <ReportSectionCard key={section.title} section={section} />
          ))}
        </div>
      )}
    </>
  );
}

function ReportSectionCard({ section }: { section: ReportSection }) {
  const { t } = useTranslation();
  const cell = useReportCell();
  const align = (kind: string, row?: { kind?: string }) =>
    NUMERIC.has(kind === "auto" ? (row?.kind ?? "text") : kind) ? "text-right tabular-nums" : "";

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">{section.title}</CardTitle>
        {section.note && <p className="text-muted-foreground text-xs">{section.note}</p>}
      </CardHeader>
      {section.rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-4 text-sm">{t("reports.nothing")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {section.columns.map((column) => (
                  <TableHead key={column.key} className={cn("whitespace-nowrap", align(column.kind))}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.rows.map((row, index) => (
                <TableRow key={index}>
                  {section.columns.map((column) => (
                    <TableCell key={column.key} className={cn("whitespace-nowrap", align(column.kind, row))}>
                      {cell(row[column.key], column.kind, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {section.totals && (
                <TableRow className="bg-muted/40 border-t-2 font-semibold">
                  {section.columns.map((column) => (
                    <TableCell key={column.key} className={cn("whitespace-nowrap", align(column.kind))}>
                      {column.key in section.totals! ? cell(section.totals![column.key], column.kind, section.totals!) : ""}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {section.truncated && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          {t("reports.truncated", { shown: section.rows.length, count: section.row_count })}
        </p>
      )}
    </Card>
  );
}
