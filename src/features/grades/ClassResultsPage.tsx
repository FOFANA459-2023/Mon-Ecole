import { Award, FileText, MessageSquareText, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader, QueryError, Spinner } from "@/components/common";
import { ClassSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { openReportCards, useAllTerms, useChosenTerm, useClassResults, useFormatMark } from "./api";
import { GradebookStatusBadge } from "./GradebookStatusBadge";
import { ReportCommentsDialog } from "./ReportCommentsDialog";
import { TermSelect } from "./pickers";

const DEFAULTS = { term: "", class: "" };

/** A class's term results: every subject's mark, the coefficient-weighted average, the rank and the decision. */
export function ClassResultsPage() {
  const { t } = useTranslation();
  const formatMark = useFormatMark();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const termId = useChosenTerm(filters.term);
  const { terms } = useAllTerms();
  const yearId = terms.find((term) => term.id === termId)?.academic_year ?? null;
  const classId = toNumberOrNull(filters.class);
  const results = useClassResults(classId, termId);
  const { can } = useAuth();
  const canPrint = can("reportcards.generate");
  const termName = terms.find((term) => term.id === termId)?.name ?? "";
  const [commenting, setCommenting] = useState<"term" | "year" | null>(null);
  const print = (term: number | null, enrollment?: number) => {
    if (classId === null) return;
    openReportCards({ class_group: classId, term, enrollment }).catch((error) => toast.error(errorMessage(error, t)));
  };

  const body = () => {
    if (classId === null || termId === null) {
      return (
        <Card>
          <EmptyState icon={<Award className="size-8" />} title={t("grades.chooseClassAndTerm")} />
        </Card>
      );
    }
    if (results.isError) {
      if (results.error instanceof ApiError && results.error.status === 404) {
        return (
          <Card>
            <EmptyState icon={<Award className="size-8" />} title={t("grades.resultsRestricted")}>
              {t("grades.resultsRestrictedHint")}
            </EmptyState>
          </Card>
        );
      }
      return <QueryError onRetry={() => void results.refetch()} />;
    }
    if (results.isPending) return <Spinner className="mx-auto my-10 size-6" />;
    const { scale, subjects, students, stats } = results.data;
    const decimals = scale.decimals ?? 2;
    if (students.length === 0) {
      return (
        <Card>
          <EmptyState icon={<Award className="size-8" />} title={t("grades.noStudents")} />
        </Card>
      );
    }
    const unpublished = subjects.filter((s) => s.status !== "published").length;
    return (
      <div className="grid gap-3">
        {unpublished > 0 && (
          <p className="text-muted-foreground text-sm">{t("grades.unpublishedNote", { count: unpublished })}</p>
        )}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="bg-muted sticky left-0 z-10 min-w-48 px-3 py-2 text-left font-medium">
                    {t("grades.student")}
                  </th>
                  {subjects.map((subject) => (
                    <th key={subject.class_subject} scope="col" className="min-w-20 px-2 py-2 text-center text-xs font-medium">
                      {subject.gradebook ? (
                        <Link to={`/assessments/${subject.gradebook}`} className="hover:underline" title={subject.subject_name}>
                          {subject.subject_code}
                        </Link>
                      ) : (
                        <span title={subject.subject_name}>{subject.subject_code}</span>
                      )}
                      <span className="text-muted-foreground block font-normal">
                        {t("grades.coefficientShort", { value: Number(subject.coefficient) })}
                      </span>
                      {subject.status !== "published" && (
                        <GradebookStatusBadge status={subject.status} className="mt-1 text-[10px]" />
                      )}
                    </th>
                  ))}
                  <th scope="col" className="min-w-20 border-l px-2 py-2 text-center text-xs font-semibold">
                    {t("grades.averageOutOf", { max: Number(scale.max_mark) })}
                  </th>
                  <th scope="col" className="px-2 py-2 text-center text-xs font-medium">
                    {t("grades.rank")}
                  </th>
                  <th scope="col" className="px-2 py-2 text-center text-xs font-medium">
                    {t("grades.decision")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const marks = new Map(student.marks.map((m) => [m.class_subject, m.mark]));
                  return (
                    <tr key={student.enrollment} className="border-b">
                      <th scope="row" className="bg-background sticky left-0 z-10 px-3 py-1.5 text-left font-normal">
                        <Link to={`/students/${student.student}`} className="font-medium hover:underline">
                          {student.student_name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {student.student_number}
                          {canPrint && (
                            <button
                              type="button"
                              className="text-primary ml-2 hover:underline"
                              onClick={() => print(termId, student.enrollment)}
                            >
                              {t("grades.cards.one")}
                            </button>
                          )}
                        </span>
                      </th>
                      {subjects.map((subject) => {
                        const mark = marks.get(subject.class_subject);
                        const failed = mark !== null && mark !== undefined && Number(mark) < Number(scale.pass_mark);
                        return (
                          <td
                            key={subject.class_subject}
                            className={cn(
                              "px-2 py-1.5 text-center tabular-nums",
                              failed && "text-destructive",
                              subject.status !== "published" && "text-muted-foreground italic",
                            )}
                          >
                            {formatMark(mark, decimals)}
                          </td>
                        );
                      })}
                      <td
                        className={cn(
                          "border-l px-2 py-1.5 text-center font-semibold tabular-nums",
                          student.passed === false && "text-destructive",
                        )}
                      >
                        {formatMark(student.average, decimals)}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{student.rank ?? "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        {student.passed === null ? (
                          "—"
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              student.passed
                                ? "bg-success/15 text-success border-transparent"
                                : "bg-destructive/10 text-destructive border-transparent"
                            }
                          >
                            {student.passed ? t("grades.passed") : t("grades.failed")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <th scope="row" className="bg-muted sticky left-0 z-10 px-3 py-2 text-left text-xs font-medium">
                    {t("grades.classAverage")}
                  </th>
                  {subjects.map((subject) => (
                    <td key={subject.class_subject} className="text-muted-foreground px-2 py-2 text-center text-xs tabular-nums">
                      {formatMark(subject.stats.average, decimals)}
                    </td>
                  ))}
                  <td className="border-l px-2 py-2 text-center text-xs font-semibold tabular-nums">
                    {formatMark(stats.average, decimals)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <p className="text-muted-foreground text-xs">
          {t("grades.statsLine", {
            passed: stats.passed,
            counted: stats.counted,
            pass: Number(scale.pass_mark),
            max: Number(scale.max_mark),
            lowest: formatMark(stats.lowest, decimals),
            highest: formatMark(stats.highest, decimals),
          })}
        </p>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t("grades.resultsTitle")}
        description={t("grades.resultsSubtitle")}
        actions={
          results.isSuccess && classId !== null ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MessageSquareText /> {t("grades.comments.button")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCommenting("term")}>{termName}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCommenting("year")}>{t("grades.cards.year")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canPrint && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      <Printer /> {t("grades.cards.print")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => print(termId)}>
                      <FileText /> {t("grades.cards.term", { term: termName })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => print(null)}>
                      <FileText /> {t("grades.cards.annual")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          ) : undefined
        }
      />
      {canPrint && results.isSuccess && results.data.subjects.some((s) => s.status !== "published") && (
        <p className="text-muted-foreground mb-3 text-sm">{t("grades.cards.publishedOnly")}</p>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_16rem]">
        <TermSelect
          value={termId}
          onChange={(id) => {
            const sameYear = terms.find((term) => term.id === id)?.academic_year === yearId;
            setFilters(sameYear ? { term: String(id) } : { term: String(id), class: "" });
          }}
        />
        <ClassSelect
          yearId={yearId}
          value={classId}
          onChange={(v) => setFilters({ class: v ? String(v) : "" })}
          aria-label={t("classes.chooseClass")}
        />
      </div>
      {body()}
      {commenting && classId !== null && (
        <ReportCommentsDialog
          classId={classId}
          termId={commenting === "term" ? termId : null}
          periodName={commenting === "term" ? termName : t("grades.cards.year")}
          onClose={() => setCommenting(null)}
        />
      )}
    </>
  );
}
