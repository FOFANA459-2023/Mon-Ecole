import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useSchoolId } from "@/features/academics/api";
import { useFormatDateTime } from "@/features/cash/api";
import { api, type Query } from "@/lib/api/client";
import type { FinanceReport, ReportCell, ReportKind, ReportRow } from "@/lib/api/types";
import { useFormatDate } from "@/lib/dates";
import { localeFor } from "@/lib/format";

import { FINANCE_KEY, useMoney } from "./api";

export const REPORTS = ["payments", "outstanding", "cash", "expenses", "summary"] as const;
export type ReportKey = (typeof REPORTS)[number];

export function useFinanceReport(key: ReportKey, params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "report", key, params],
    queryFn: ({ signal }) => api.get<FinanceReport>(`/reports/finance/${key}/`, params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

const iso = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

export const PERIODS = ["today", "week", "month", "lastMonth", "schoolYear"] as const;
export type Period = (typeof PERIODS)[number];

/** The dates of a preset period, ending today (last month ends on its last day). */
export function periodDates(period: Period, today: Date, schoolYearStart?: string | null): { from: string; to: string } {
  const to = iso(today);
  switch (period) {
    case "today":
      return { from: to, to };
    case "week": {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { from: iso(monday), to };
    }
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "lastMonth":
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: iso(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "schoolYear":
      return { from: schoolYearStart && schoolYearStart <= to ? schoolYearStart : `${today.getFullYear()}-01-01`, to };
  }
}

/** Formats a report cell by its kind: amounts in the school currency, dates in the interface language. */
export function useReportCell() {
  const { i18n } = useTranslation();
  const money = useMoney();
  const formatDate = useFormatDate();
  const { dateTime } = useFormatDateTime();
  const numbers = new Intl.NumberFormat(localeFor(i18n.language), { maximumFractionDigits: 1 });
  return (value: ReportCell | undefined, kind: ReportKind, row?: ReportRow): string => {
    const actual = kind === "auto" ? (row?.kind ?? "text") : kind;
    if (value === null || value === undefined || value === "") return actual === "text" ? "" : "—";
    // A totals row puts its label ("Total (3)") in the first column, whatever that column holds.
    if ((actual === "date" || actual === "datetime") && Number.isNaN(Date.parse(String(value)))) return String(value);
    switch (actual) {
      case "money":
        return money.format(value);
      case "number":
        return numbers.format(Number(value));
      case "percent":
        return `${numbers.format(Number(value))} %`;
      case "date":
        return formatDate(String(value));
      case "datetime":
        return dateTime(String(value));
      default:
        return String(value);
    }
  };
}
