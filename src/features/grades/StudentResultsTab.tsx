import { Award, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";

import { openReportCards, useFormatMark, useStudentResults } from "./api";

/** The "Results" tab of a student's profile: each term's average, rank and honours band, and the year's. */
export function StudentResultsTab({ studentId }: { studentId: number }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatMark = useFormatMark();
  const results = useStudentResults(studentId);

  if (results.isError) {
    if (results.error instanceof ApiError && results.error.status === 404) {
      return (
        <Card>
          <EmptyState icon={<Award className="size-8" />} title={t("grades.resultsRestricted")} />
        </Card>
      );
    }
    return <QueryError onRetry={() => void results.refetch()} />;
  }
  if (results.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  const data = results.data;
  if (data.enrollment === null || data.class_group === null || !data.scale) {
    return (
      <Card>
        <EmptyState icon={<Award className="size-8" />} title={t("grades.studentTab.notEnrolled")} />
      </Card>
    );
  }
  const { scale, class_group: classId, enrollment } = data;
  const decimals = scale.decimals ?? 2;
  const print = (term: number | null) =>
    openReportCards({ class_group: classId, term, enrollment }).catch((error) => toast.error(errorMessage(error, t)));

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="text-muted-foreground border-b px-4 py-3 text-sm">
        {t("grades.studentTab.intro", { name: data.class_name })}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("grades.term")}</TableHead>
            <TableHead className="text-right">{t("grades.averageOutOf", { max: Number(scale.max_mark) })}</TableHead>
            <TableHead className="text-right">{t("grades.rank")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("grades.studentTab.mention")}</TableHead>
            {can("reportcards.generate") && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.terms.map((row) => {
            const annual = row.term === null;
            return (
              <TableRow key={row.term ?? "year"} className={annual ? "bg-muted/40 font-medium" : ""}>
                <TableCell>
                  {annual ? t("grades.cards.year") : row.term_name}
                  {!annual && row.subjects === 0 && (
                    <span className="text-muted-foreground ml-2 text-xs">{t("grades.studentTab.nothingPublished")}</span>
                  )}
                </TableCell>
                <TableCell className={row.passed === false ? "text-destructive text-right tabular-nums" : "text-right tabular-nums"}>
                  {formatMark(row.average, decimals)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.rank ? t("grades.studentTab.rankOf", { rank: row.rank, of: row.ranked }) : "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {row.mention ? <Badge variant="secondary">{row.mention}</Badge> : "—"}
                  {annual && row.passed !== null && (
                    <Badge
                      variant="outline"
                      className={
                        row.passed
                          ? "bg-success/15 text-success ml-2 border-transparent"
                          : "bg-destructive/10 text-destructive ml-2 border-transparent"
                      }
                    >
                      {row.passed ? t("grades.passed") : t("grades.failed")}
                    </Badge>
                  )}
                </TableCell>
                {can("reportcards.generate") && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={row.average === null}
                      aria-label={t("grades.studentTab.printCard", { period: annual ? t("grades.cards.year") : row.term_name })}
                      onClick={() => void print(row.term)}
                    >
                      <Printer />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
