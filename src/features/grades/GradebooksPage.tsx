import { ClipboardPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState, PageHeader, QueryError, Spinner } from "@/components/common";
import { SearchInput } from "@/components/display";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAcademicYears } from "@/features/academics/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

import { useChosenTerm, useGradebooks } from "./api";
import { GradebookStatusBadge } from "./GradebookStatusBadge";
import { TermSelect } from "./pickers";

const DEFAULTS = { term: "", q: "", mine: "" };

export function GradebooksPage() {
  const { t } = useTranslation();
  const years = useAcademicYears();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const termId = useChosenTerm(filters.term);
  const search = useDebouncedValue(filters.q);
  const gradebooks = useGradebooks({ term: termId, search, mine: filters.mine || undefined, page_size: 200 });
  const rows = gradebooks.data?.results ?? [];

  return (
    <>
      <PageHeader title={t("grades.title")} description={t("grades.subtitle")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_16rem_auto] sm:items-center">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder={t("grades.searchGradebooks")} />
        <TermSelect value={termId} onChange={(id) => setFilters({ term: String(id) })} />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={filters.mine === "1"} onCheckedChange={(on) => setFilters({ mine: on ? "1" : "" })} />
          {t("grades.onlyMine")}
        </label>
      </div>

      {years.isSuccess && termId === null ? (
        <Card>
          <EmptyState icon={<ClipboardPen className="size-8" />} title={t("grades.noTerms")}>
            {t("grades.noTermsHint")}
          </EmptyState>
        </Card>
      ) : gradebooks.isError ? (
        <QueryError onRetry={() => void gradebooks.refetch()} />
      ) : gradebooks.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardPen className="size-8" />} title={t("grades.noGradebooks")}>
            {t("grades.noGradebooksHint")}
          </EmptyState>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("grades.class")}</TableHead>
                <TableHead>{t("grades.subject")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("grades.teacher")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("grades.assessmentCount")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("grades.progress")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expected = row.student_count * row.assessment_count;
                const progress = expected > 0 ? Math.min(100, Math.round((row.mark_count / expected) * 100)) : 0;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.class_name}</TableCell>
                    <TableCell>
                      <Link to={`/assessments/${row.id}`} className="text-primary font-medium hover:underline">
                        {row.subject_name}
                      </Link>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t("grades.coefficientShort", { value: Number(row.coefficient) })}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {row.teacher_name || t("grades.noTeacher")}
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{row.assessment_count}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 w-24" aria-label={t("grades.progress")} />
                        <span className="text-muted-foreground text-xs tabular-nums">{progress} %</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <GradebookStatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
