import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, Field, PageHeader, Spinner } from "@/components/common";
import { PersonAvatar } from "@/components/display";
import { ClassSelect, YearSelect } from "@/components/pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAcademicYears, useClass } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { PromoteResult } from "@/lib/api/types";
import { errorMessage } from "@/lib/forms";

import { invalidateSchooling, useEnrollments } from "./api";

export function PromotePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const initialClass = params.get("from") ? Number(params.get("from")) : null;
  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const sourceClass = useClass(initialClass ?? undefined).data;

  const current = years.find((y) => y.is_current) ?? years[0];
  const [fromYear, setFromYear] = useState<number | null>(null);
  const [fromClass, setFromClass] = useState<number | null>(initialClass);
  const [toYear, setToYear] = useState<number | null>(null);
  const [toClass, setToClass] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PromoteResult | null>(null);

  const effectiveFromYear = fromYear ?? sourceClass?.academic_year ?? current?.id ?? null;
  const laterYears = useMemo(() => {
    const from = years.find((y) => y.id === effectiveFromYear);
    return from ? years.filter((y) => y.start_date > from.start_date) : [];
  }, [years, effectiveFromYear]);
  const effectiveToYear = toYear ?? laterYears[laterYears.length - 1]?.id ?? null;

  const enrollments = useEnrollments({ class_group: fromClass ?? undefined, status: "active", page_size: 100 }, fromClass !== null);
  const rows = enrollments.data?.results ?? [];
  const selectedIds = rows.filter((e) => !excluded.has(e.id)).map((e) => e.id);

  const submit = async () => {
    setBusy(true);
    try {
      const response = await api.post<PromoteResult>("/enrollments/promote/", {
        from_class: fromClass,
        to_class: toClass,
        enrollment_ids: selectedIds,
      });
      await invalidateSchooling(queryClient);
      setResult(response);
      setExcluded(new Set());
      toast.success(t("enrollments.promoted", { count: response.promoted }));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("enrollments.promote")} description={t("enrollments.promoteSubtitle")} />
      <Card className="mb-6">
        <CardContent className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("enrollments.fromYear")} htmlFor="p-from-year">
              <YearSelect id="p-from-year" value={effectiveFromYear} onChange={(v) => { setFromYear(v); setFromClass(null); setResult(null); }} />
            </Field>
            <Field label={t("enrollments.fromClass")} htmlFor="p-from-class">
              <ClassSelect id="p-from-class" yearId={effectiveFromYear} value={fromClass} onChange={(v) => { setFromClass(v); setExcluded(new Set()); setResult(null); }} />
            </Field>
          </div>
          <ArrowRight className="text-muted-foreground mx-auto hidden size-5 md:block" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("enrollments.toYear")} htmlFor="p-to-year">
              <YearSelect id="p-to-year" value={effectiveToYear} onChange={(v) => { setToYear(v); setToClass(null); }} />
            </Field>
            <Field label={t("enrollments.toClass")} htmlFor="p-to-class">
              <ClassSelect id="p-to-class" yearId={effectiveToYear} value={toClass} onChange={setToClass} showPlaces />
            </Field>
          </div>
        </CardContent>
      </Card>

      {laterYears.length === 0 && (
        <Alert className="mb-4">
          <RefreshCcw />
          <AlertDescription>{t("enrollments.needNextYear")}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className="mb-4">
          <CheckCircle2 />
          <AlertDescription>
            {t("enrollments.promoted", { count: result.promoted })}
            {result.skipped.length > 0 &&
              ` — ${t("enrollments.skipped", { names: result.skipped.map((s) => String(s.full_name)).join(", ") })}`}
          </AlertDescription>
        </Alert>
      )}

      {fromClass === null ? (
        <Card>
          <EmptyState title={t("enrollments.chooseClasses")} />
        </Card>
      ) : enrollments.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={t("classes.noStudents")} />
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={excluded.size === 0 ? true : excluded.size === rows.length ? false : "indeterminate"}
                onCheckedChange={(v) => setExcluded(v ? new Set() : new Set(rows.map((r) => r.id)))}
              />
              {t("enrollments.selectAll")}
            </label>
            <Button onClick={() => void submit()} disabled={busy || !toClass || selectedIds.length === 0}>
              {t("enrollments.promoteButton", { count: selectedIds.length })}
            </Button>
          </div>
          <ul className="divide-y">
            {rows.map((e) => (
              <li key={e.id}>
                <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-4 py-2.5">
                  <Checkbox
                    checked={!excluded.has(e.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(excluded);
                      if (v) next.delete(e.id);
                      else next.add(e.id);
                      setExcluded(next);
                    }}
                  />
                  <PersonAvatar name={e.student.full_name} photoUrl={e.student.photo_url} className="size-8" />
                  <span className="text-sm">
                    <span className="font-medium">{e.student.full_name}</span>{" "}
                    <span className="text-muted-foreground">{e.student.student_number}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
