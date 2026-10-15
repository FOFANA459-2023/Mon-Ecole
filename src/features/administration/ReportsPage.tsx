import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { Field, QueryError, Spinner } from "@/components/common";
import { ClassSelect, LevelSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentYear, useSchoolId } from "@/features/academics/api";
import { ReportSectionCard } from "@/features/finance/ReportSectionCard";
import { api, type Query } from "@/lib/api/client";
import type { FinanceReport } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { downloadFile, openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

const REPORTS = ["enrollment", "classes", "teachers", "attendance", "statistics"] as const;
type ReportKey = (typeof REPORTS)[number];
const USES_PERIOD: ReportKey[] = ["enrollment", "attendance"];
const DEFAULTS = { report: "enrollment", year: "", level: "", class: "", from: "", to: "" };

/** The other reports of the Terms of Reference, kept in their modules. */
const ELSEWHERE = [
  { key: "payments", to: "/finance/reports?report=payments", anyOf: ["finance.view"] },
  { key: "outstanding", to: "/finance/reports?report=outstanding", anyOf: ["finance.view"] },
  { key: "cash", to: "/finance/reports?report=cash", anyOf: ["finance.view"] },
  { key: "financial", to: "/finance/reports?report=summary", anyOf: ["finance.view"] },
  { key: "grades", to: "/results/reports?report=grades", anyOf: ["grades.view"] },
  { key: "ranking", to: "/results/reports?report=ranking", anyOf: ["grades.view"] },
  { key: "reportCards", to: "/results", anyOf: ["reportcards.generate"] },
];

function useSchoolReport(key: ReportKey, params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["administration", schoolId, "report", key, params],
    queryFn: ({ signal }) => api.get<FinanceReport>(`/reports/school/${key}/`, params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** School reports (ToR §20): enrolment, classes, teachers, attendance, student statistics — and the rest. */
export function ReportsPage() {
  const { t } = useTranslation();
  const { can, canAny } = useAuth();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const report = (REPORTS.includes(filters.report as ReportKey) ? filters.report : "enrollment") as ReportKey;
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const classId = toNumberOrNull(filters.class);
  const levelId = toNumberOrNull(filters.level);
  const usesPeriod = USES_PERIOD.includes(report);
  const params: Query = {
    academic_year: yearId ?? undefined,
    ...(classId !== null ? { class_group: classId } : levelId !== null ? { level: levelId } : {}),
    ...(usesPeriod && filters.from && { date_from: filters.from }),
    ...(usesPeriod && filters.to && { date_to: filters.to }),
  };
  const query = useSchoolReport(report, params);
  const path = `/reports/school/${report}/`;
  const download = (format: "pdf" | "xlsx" | "csv") => {
    const request =
      format === "pdf"
        ? openPdf(path, { ...params, export: format })
        : downloadFile(path, { ...params, export: format }, `${report}.${format}`);
    request.catch((error) => toast.error(errorMessage(error, t)));
  };
  const elsewhere = ELSEWHERE.filter((item) => canAny(item.anyOf));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label={t("reports.choose")}>
        {REPORTS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === report}
            onClick={() => setFilters({ report: key })}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              key === report ? "border-primary bg-primary/5" : "hover:bg-muted",
            )}
          >
            <span className="block text-sm font-medium">{t(`administration.reports.names.${key}`)}</span>
            <span className="text-muted-foreground block text-xs">{t(`administration.reports.descriptions.${key}`)}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("classes.year")} htmlFor="sr-year">
            <YearSelect id="sr-year" value={yearId} onChange={(v) => setFilters({ year: v ? String(v) : "", class: "" })} />
          </Field>
          <Field label={t("classes.level")} htmlFor="sr-level">
            <LevelSelect
              id="sr-level"
              value={levelId}
              onChange={(v) => setFilters({ level: v ? String(v) : "", class: "" })}
              allLabel={t("grades.reports.allLevels")}
            />
          </Field>
          <Field label={t("classes.chooseClass")} htmlFor="sr-class">
            <ClassSelect
              id="sr-class"
              yearId={yearId}
              value={classId}
              onChange={(v) => setFilters({ class: v ? String(v) : "" })}
              allLabel={t("classes.allClasses")}
            />
          </Field>
          {usesPeriod && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("finance.fromDate")} htmlFor="sr-from">
                <Input id="sr-from" type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
              </Field>
              <Field label={t("finance.toDate")} htmlFor="sr-to">
                <Input id="sr-to" type="date" value={filters.to} onChange={(e) => setFilters({ to: e.target.value })} />
              </Field>
            </div>
          )}
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
            {can("reports.export") && (
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

      {elsewhere.length > 0 && (
        <Card>
          <CardContent className="grid gap-2">
            <p className="text-sm font-medium">{t("administration.reports.elsewhere")}</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {elsewhere.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline">
                    {t(`administration.reports.links.${item.key}`)} <ArrowRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
