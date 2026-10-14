import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth/context";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/forms";

import { openIssuedReportCard, useFormatMark, useIssuedReportCards } from "./api";

/** The report cards handed out to a student, every version kept, to reprint exactly what was given. */
export function IssuedReportCardsCard({ studentId }: { studentId: number }) {
  const { t, i18n } = useTranslation();
  const { membership } = useAuth();
  const formatMark = useFormatMark();
  const cards = useIssuedReportCards(studentId);

  if (cards.isError) return <QueryError onRetry={() => void cards.refetch()} />;
  if (cards.isPending) return <Spinner className="mx-auto my-6 size-5" />;
  if (cards.data.length === 0) return null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("grades.issued.title")}</h2>
        <p className="text-muted-foreground text-xs">{t("grades.issued.hint")}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("grades.issued.period")}</TableHead>
            <TableHead className="text-right">{t("grades.issued.average")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("grades.issued.issued")}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.data.map((card) => (
            <TableRow key={card.id} className={card.is_latest ? "" : "text-muted-foreground"}>
              <TableCell>
                <span className="font-medium">{card.term_name || t("grades.cards.year")}</span>
                <span className="text-muted-foreground block text-xs">
                  {card.class_name} · {card.academic_year_name}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMark(card.average)}
                {card.rank ? <span className="text-muted-foreground block text-xs">{t("grades.issued.rank", { rank: card.rank })}</span> : null}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant={card.is_latest ? "secondary" : "outline"}>
                  {t("grades.issued.version", { version: card.version })}
                </Badge>
                {!card.is_latest && <span className="ml-2 text-xs">{t("grades.issued.replaced")}</span>}
                <span className="text-muted-foreground block text-xs">
                  {formatDateTime(card.created_at, i18n.language, membership?.school.timezone)}
                  {card.issued_by_name ? ` · ${card.issued_by_name}` : ""}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("grades.issued.open", {
                    period: card.term_name || t("grades.cards.year"),
                    version: card.version,
                  })}
                  onClick={() =>
                    openIssuedReportCard(card.id).catch((error) => toast.error(errorMessage(error, t)))
                  }
                >
                  <FileText />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
