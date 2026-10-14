import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, Field, PageHeader, QueryError, Spinner } from "@/components/common";
import { ClassSelect, LevelSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSchoolId } from "@/features/academics/api";
import { ReportSectionCard } from "@/features/finance/ReportSectionCard";
import { api, type Query } from "@/lib/api/client";
import type { AcademicReport } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { downloadFile, openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { GRADES_KEY, useAllTerms, useChosenTerm } from "./api";
import { TermSelect } from "./pickers";
import { ResultsTabs } from "./ResultsTabs";

const REPORTS = ["grades", "ranking", "subjects"] as const;
type ReportKey = (typeof REPORTS)[number];
const DEFAULTS = { report: "grades", term: "", period: "term", class: "", level: "" };

function useAcademicReport(key: ReportKey, params: Query, enabled: boolean) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "report", key, params],
    queryFn: ({ signal }) => api.get<AcademicReport>(`/reports/academic/${key}/`, params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** The academic reports of the Terms of Reference: grade report, ranking and results by subject. */
export function AcademicReportsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const seesAll = can("classes.view_all");
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const report = (REPORTS.includes(filters.report as ReportKey) ? filters.report : "grades") as ReportKey;
  const termId = useChosenTerm(filters.term);
  const { terms } = useAllTerms();
  const yearId = terms.find((term) => term.id === termId)?.academic_year ?? null;
  const annual = filters.period === "year";
  const classId = toNumberOrNull(filters.class);
  const levelId = toNumberOrNull(filters.level);
  // The grade report is about one class; teachers only reach the class they lead.
  const needsClass = report === "grades" || !seesAll;
  const ready = yearId !== null && (!needsClass || classId !== null);

  const params: Query = {
    academic_year: yearId,
    ...(!annual && { term: termId }),
    ...(classId !== null && { class_group: classId }),
    ...(classId === null && levelId !== null && { level: levelId }),
  };
  const query = useAcademicReport(report, params, ready);
  const path = `/reports/academic/${report}/`;
  const download = (format: "pdf" | "xlsx" | "csv") => {
    const request =
      format === "pdf"
        ? openPdf(path, { ...params, export: format })
        : downloadFile(path, { ...params, export: format }, `${report}.${format}`);
    request.catch((error) => toast.error(errorMessage(error, t)));
  };

  return (
    <>
      <PageHeader title={t("grades.resultsTitle")} description={t("grades.reports.subtitle")} />
      <ResultsTabs />
      <div className="mb-4 grid gap-2 sm:grid-cols-3" role="group" aria-label={t("reports.choose")}>
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
            <span className="block text-sm font-medium">{t(`grades.reports.names.${key}`)}</span>
            <span className="text-muted-foreground block text-xs">{t(`grades.reports.descriptions.${key}`)}</span>
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("grades.term")} htmlFor="ar-term">
            <TermSelect
              id="ar-term"
              value={termId}
              onChange={(id) => {
                const sameYear = terms.find((term) => term.id === id)?.academic_year === yearId;
                setFilters(sameYear ? { term: String(id) } : { term: String(id), class: "" });
              }}
            />
          </Field>
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-medium">{t("grades.reports.period")}</span>
            <div className="flex gap-2" role="group" aria-label={t("grades.reports.period")}>
              <Button
                size="sm"
                variant={annual ? "outline" : "default"}
                aria-pressed={!annual}
                onClick={() => setFilters({ period: "term" })}
              >
                {t("grades.reports.thisTerm")}
              </Button>
              <Button
                size="sm"
                variant={annual ? "default" : "outline"}
                aria-pressed={annual}
                onClick={() => setFilters({ period: "year" })}
              >
                {t("grades.cards.year")}
              </Button>
            </div>
          </div>
          <Field label={t("classes.chooseClass")} htmlFor="ar-class">
            <ClassSelect
              id="ar-class"
              yearId={yearId}
              value={classId}
              onChange={(v) => setFilters({ class: v ? String(v) : "" })}
              allLabel={needsClass ? undefined : t("classes.allClasses")}
            />
          </Field>
          {!needsClass && classId === null && (
            <Field label={t("classes.level")} htmlFor="ar-level">
              <LevelSelect
                id="ar-level"
                value={levelId}
                onChange={(v) => setFilters({ level: v ? String(v) : "" })}
                allLabel={t("grades.reports.allLevels")}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {!ready ? (
        <Card>
          <EmptyState icon={<FileText className="size-8" />} title={t("grades.reports.chooseClass")} />
        </Card>
      ) : query.isError ? (
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
    </>
  );
}
