import { useTranslation } from "react-i18next";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportSection } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useReportCell } from "./reports";

const NUMERIC = new Set(["money", "number", "percent", "mark"]);

/** One section of a report (finance or academic): its title, note and table, with the totals row. */
export function ReportSectionCard({ section }: { section: ReportSection }) {
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
