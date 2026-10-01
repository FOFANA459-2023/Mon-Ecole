import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Save, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { Assessment, GradebookDetail, GradebookSheet } from "@/lib/api/types";
import { useFormatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { GRADES_KEY, outOf, useFormatMark } from "./api";
import { cellKey, cellText, EXCUSED_CODE, parseCell, shares, toEntry } from "./marks";

type Column = Assessment & { max: number };

/**
 * The marks grid: one row per student, one column per assessment, grouped by the teacher's categories,
 * then each category's mark, the subject mark and the rank. Enter / ↓ moves down a column, ↑ moves up.
 */
export function MarksGrid({ gradebook, sheet }: { gradebook: GradebookDetail; sheet: GradebookSheet }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const formatMark = useFormatMark();
  const editable = gradebook.can.edit;
  const decimals = sheet.scale.decimals ?? 2;
  const scaleMax = Number(sheet.scale.max_mark);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const weights = shares(gradebook.categories.map((c) => Number(c.weight)));
    return gradebook.categories
      .map((category, index) => ({
        category,
        share: weights[index],
        columns: gradebook.assessments
          .filter((a) => a.category === category.id)
          .map((a) => ({ ...a, max: Number(a.max_score) }) as Column),
      }))
      .filter((group) => group.columns.length > 0);
  }, [gradebook.categories, gradebook.assessments]);
  const columns = groups.flatMap((group) => group.columns);

  const stored = useMemo(() => {
    const map = new Map<string, { score: string | null; excused: boolean; comment: string }>();
    for (const row of sheet.students) {
      for (const mark of row.marks) map.set(cellKey(mark.assessment, row.enrollment), mark);
    }
    return map;
  }, [sheet.students]);

  const changes = Object.entries(drafts).filter(([key, text]) => text.trim() !== cellText(stored.get(key)));
  const invalid = changes.some(([key, text]) => {
    const assessment = columns.find((c) => c.id === Number(key.split(":")[0]));
    return parseCell(text, assessment?.max ?? 0).kind === "invalid";
  });

  useEffect(() => {
    if (changes.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes.length]);

  if (columns.length === 0) {
    return (
      <Card>
        <EmptyState icon={<ClipboardList className="size-8" />} title={t("grades.noAssessments")}>
          {editable ? t("grades.noAssessmentsHint") : t("grades.noAssessmentsYet")}
        </EmptyState>
      </Card>
    );
  }

  const move = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const step = event.key === "Enter" || event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    gridRef.current
      ?.querySelector<HTMLInputElement>(`input[data-row="${row + step}"][data-col="${col}"]`)
      ?.focus();
  };

  const save = async () => {
    const grades = changes.map(([key, text]) => {
      const [assessment, enrollment] = key.split(":").map(Number);
      const column = columns.find((c) => c.id === assessment)!;
      return toEntry(assessment, enrollment, parseCell(text, column.max), stored.get(key)?.comment ?? "");
    });
    setSaving(true);
    try {
      const result = await api.post<{ changed: number }>(`/gradebooks/${gradebook.id}/grades/`, { grades });
      await queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
      setDrafts({});
      toast.success(t("grades.marksSaved", { count: result.changed }));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">{t("grades.gridHelp", { code: EXCUSED_CODE })}</p>
          <div className="flex items-center gap-2">
            {changes.length > 0 && (
              <span className="text-sm text-amber-700 dark:text-amber-400" role="status">
                {t("grades.unsaved", { count: changes.length })}
              </span>
            )}
            <Button variant="ghost" size="sm" disabled={changes.length === 0 || saving} onClick={() => setDrafts({})}>
              <Undo2 /> {t("grades.discard")}
            </Button>
            <Button size="sm" disabled={changes.length === 0 || invalid || saving} onClick={() => void save()}>
              <Save /> {saving ? t("common.saving") : t("grades.saveMarks")}
            </Button>
          </div>
        </div>
      )}
      <Card className="gap-0 overflow-hidden py-0">
        <div ref={gridRef} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th rowSpan={2} className="bg-muted sticky left-0 z-10 min-w-48 px-3 py-2 text-left font-medium">
                  {t("grades.student")}
                </th>
                {groups.map((group) => (
                  <th
                    key={group.category.id}
                    colSpan={group.columns.length}
                    className="border-l px-2 py-1.5 text-center text-xs font-semibold"
                  >
                    {group.category.name}
                    <span className="text-muted-foreground ml-1 font-normal">{Math.round(group.share)} %</span>
                  </th>
                ))}
                <th colSpan={groups.length + 2} className="border-l px-2 py-1.5 text-center text-xs font-semibold">
                  {t("grades.resultsOutOf", { max: scaleMax })}
                </th>
              </tr>
              <tr className="border-b">
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "min-w-20 px-2 py-1.5 text-center align-bottom text-xs font-medium",
                      (index === 0 || groups.some((g) => g.columns[0].id === column.id)) && "border-l",
                    )}
                  >
                    <span className="line-clamp-2 block">{column.name}</span>
                    <span className="text-muted-foreground block font-normal">
                      {outOf(column.max)}
                      {column.date ? ` · ${formatDate(column.date)}` : ""}
                    </span>
                  </th>
                ))}
                {groups.map((group, index) => (
                  <th
                    key={group.category.id}
                    scope="col"
                    className={cn("min-w-16 px-2 py-1.5 text-center text-xs font-medium", index === 0 && "border-l")}
                  >
                    {group.category.name}
                  </th>
                ))}
                <th scope="col" className="min-w-16 px-2 py-1.5 text-center text-xs font-semibold">
                  {t("grades.mark")}
                </th>
                <th scope="col" className="min-w-12 px-2 py-1.5 text-center text-xs font-medium">
                  {t("grades.rank")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((student, rowIndex) => {
                const categoryMarks = new Map(student.categories.map((c) => [c.category, c.mark]));
                return (
                  <tr key={student.enrollment} className={cn("border-b", !student.is_active && "opacity-60")}>
                    <th scope="row" className="bg-background sticky left-0 z-10 px-3 py-1.5 text-left font-normal">
                      <span className="font-medium">{student.student_name}</span>
                      {!student.is_active && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {t("grades.left")}
                        </Badge>
                      )}
                      <span className="text-muted-foreground block text-xs">{student.student_number}</span>
                    </th>
                    {columns.map((column, colIndex) => {
                      const key = cellKey(column.id, student.enrollment);
                      const text = drafts[key] ?? cellText(stored.get(key));
                      const parsed = parseCell(text, column.max);
                      const changed = key in drafts && text.trim() !== cellText(stored.get(key));
                      const label = t("grades.cellLabel", { student: student.student_name, assessment: column.name });
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "px-1.5 py-1 text-center",
                            groups.some((g) => g.columns[0].id === column.id) && "border-l",
                          )}
                        >
                          {editable ? (
                            <input
                              aria-label={label}
                              aria-invalid={parsed.kind === "invalid"}
                              title={
                                parsed.kind === "invalid"
                                  ? t(`grades.invalid.${parsed.reason}`, { max: column.max })
                                  : undefined
                              }
                              inputMode="decimal"
                              autoComplete="off"
                              data-row={rowIndex}
                              data-col={colIndex}
                              value={text}
                              onChange={(e) => setDrafts((current) => ({ ...current, [key]: e.target.value }))}
                              onKeyDown={(e) => move(e, rowIndex, colIndex)}
                              onFocus={(e) => e.target.select()}
                              className={cn(
                                "border-input focus-visible:ring-ring/50 h-8 w-16 rounded-md border bg-transparent text-center tabular-nums outline-none focus-visible:ring-[3px]",
                                changed && "border-amber-500 bg-amber-50 dark:bg-amber-950/40",
                                parsed.kind === "invalid" && "border-destructive bg-destructive/10",
                                parsed.kind === "excused" && "text-muted-foreground",
                              )}
                            />
                          ) : (
                            <span className={cn("tabular-nums", parsed.kind === "excused" && "text-muted-foreground")}>
                              {text || "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {groups.map((group, index) => (
                      <td
                        key={group.category.id}
                        className={cn("text-muted-foreground px-2 py-1 text-center tabular-nums", index === 0 && "border-l")}
                      >
                        {formatMark(categoryMarks.get(group.category.id), decimals)}
                      </td>
                    ))}
                    <td
                      className={cn(
                        "px-2 py-1 text-center font-semibold tabular-nums",
                        student.passed === false && "text-destructive",
                      )}
                    >
                      {formatMark(student.mark, decimals)}
                    </td>
                    <td className="text-muted-foreground px-2 py-1 text-center tabular-nums">{student.rank ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <th scope="row" className="bg-muted sticky left-0 z-10 px-3 py-2 text-left text-xs font-medium">
                  {t("grades.classAverage")}
                </th>
                {columns.map((column) => {
                  const stats = sheet.assessments.find((a) => a.assessment === column.id);
                  return (
                    <td key={column.id} className="text-muted-foreground px-2 py-2 text-center text-xs tabular-nums">
                      {formatMark(stats?.average, 2)}
                    </td>
                  );
                })}
                <td colSpan={groups.length} />
                <td className="px-2 py-2 text-center text-xs font-semibold tabular-nums">
                  {formatMark(sheet.stats.average, decimals)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="text-muted-foreground text-xs">
        {t("grades.statsLine", {
          passed: sheet.stats.passed,
          counted: sheet.stats.counted,
          pass: Number(sheet.scale.pass_mark),
          max: scaleMax,
          lowest: formatMark(sheet.stats.lowest, decimals),
          highest: formatMark(sheet.stats.highest, decimals),
        })}
      </p>
    </div>
  );
}
