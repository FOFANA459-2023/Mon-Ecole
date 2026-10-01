import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import type { Assessment, GradebookDetail, GradeCategory, GradeCategoryMethod, MissingPolicy } from "@/lib/api/types";
import { useFormatDate } from "@/lib/dates";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { GRADES_KEY, outOf, useGradebooks } from "./api";
import { shares } from "./marks";
import { TermSelect } from "./pickers";

const METHODS: GradeCategoryMethod[] = ["average", "total"];
const POLICIES: MissingPolicy[] = ["exclude", "zero"];

/** Ready-made starting points; every name and weight can be changed afterwards. */
const TEMPLATES: { key: string; categories: { name: string; weight: number; method: GradeCategoryMethod }[] }[] = [
  {
    key: "classWorkExam",
    categories: [
      { name: "classWork", weight: 1, method: "average" },
      { name: "exam", weight: 2, method: "average" },
    ],
  },
  {
    key: "quizTestExam",
    categories: [
      { name: "quizzes", weight: 20, method: "average" },
      { name: "assignments", weight: 20, method: "average" },
      { name: "tests", weight: 20, method: "average" },
      { name: "exam", weight: 40, method: "average" },
    ],
  },
  { key: "points", categories: [{ name: "points", weight: 1, method: "total" }] },
];

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
}

function CategoryDialog({
  gradebook,
  category,
  onClose,
}: {
  gradebook: GradebookDetail;
  category?: GradeCategory;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(60),
        weight: z.number(t("validation.required")).positive(t("grades.positive")),
        method: z.enum(METHODS as [GradeCategoryMethod, ...GradeCategoryMethod[]]),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      weight: category ? Number(category.weight) : 1,
      method: category?.method ?? "average",
    },
  });
  const method = useWatch({ control: form.control, name: "method" });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (category) await api.patch(`/grade-categories/${category.id}/`, values);
      else
        await api.post("/grade-categories/", {
          ...values,
          gradebook: gradebook.id,
          order: gradebook.categories.length,
        });
      await refresh();
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "weight", "method"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? t("grades.editCategory") : t("grades.newCategory")}</DialogTitle>
          <DialogDescription>{t("grades.categoryHint")}</DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("common.name")} htmlFor="cat-name" error={errors.name?.message}>
            <Input id="cat-name" {...form.register("name")} placeholder={t("grades.categoryPlaceholder")} />
          </Field>
          <Field label={t("grades.weight")} htmlFor="cat-weight" error={errors.weight?.message} hint={t("grades.weightHint")}>
            <Input id="cat-weight" type="number" min={0} step="any" {...form.register("weight", { valueAsNumber: true })} />
          </Field>
          <Field label={t("grades.method")} htmlFor="cat-method" hint={t(`grades.methodHint.${method}`)}>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <OptionSelect<GradeCategoryMethod>
                  id="cat-method"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  options={METHODS.map((m) => ({ value: m, label: t(`grades.methods.${m}`) }))}
                />
              )}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentDialog({
  gradebook,
  assessment,
  onClose,
}: {
  gradebook: GradebookDetail;
  assessment?: Assessment;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("validation.required")).max(100),
        category: z.number(t("validation.required")),
        max_score: z.number(t("validation.required")).positive(t("grades.positive")),
        date: z.string(),
        weight: z.number(t("validation.required")).positive(t("grades.positive")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: assessment?.name ?? "",
      category: assessment?.category ?? gradebook.categories[0]?.id,
      max_score: assessment ? Number(assessment.max_score) : Number(gradebook.scale.max_mark),
      date: assessment?.date ?? "",
      weight: assessment ? Number(assessment.weight) : 1,
    },
  });
  const categoryId = useWatch({ control: form.control, name: "category" });
  const usesWeights = gradebook.categories.find((c) => c.id === categoryId)?.method !== "total";
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    const payload = { ...values, date: values.date || null };
    try {
      if (assessment) await api.patch(`/assessments/${assessment.id}/`, payload);
      else await api.post("/assessments/", { ...payload, gradebook: gradebook.id });
      await refresh();
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["name", "category", "max_score", "date", "weight"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{assessment ? t("grades.editAssessment") : t("grades.newAssessment")}</DialogTitle>
          <DialogDescription>{t("grades.assessmentHint")}</DialogDescription>
        </DialogHeader>
        <form id="assessment-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("common.name")} htmlFor="as-name" error={errors.name?.message}>
            <Input id="as-name" {...form.register("name")} placeholder={t("grades.assessmentPlaceholder")} />
          </Field>
          <Field label={t("grades.category")} htmlFor="as-cat" error={errors.category?.message}>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <OptionSelect
                  id="as-cat"
                  value={field.value ? String(field.value) : null}
                  onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                  options={gradebook.categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder={t("grades.category")}
                />
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("grades.maxScore")} htmlFor="as-max" error={errors.max_score?.message}>
              <Input id="as-max" type="number" min={0} step="any" {...form.register("max_score", { valueAsNumber: true })} />
            </Field>
            <Field label={t("common.date")} htmlFor="as-date" error={errors.date?.message}>
              <Input id="as-date" type="date" {...form.register("date")} />
            </Field>
          </div>
          {usesWeights && (
            <Field
              label={t("grades.assessmentWeight")}
              htmlFor="as-weight"
              error={errors.weight?.message}
              hint={t("grades.assessmentWeightHint")}
            >
              <Input id="as-weight" type="number" min={0} step="any" {...form.register("weight", { valueAsNumber: true })} />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="assessment-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyDialog({ gradebook, onClose }: { gradebook: GradebookDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const [termId, setTermId] = useState<number | null>(gradebook.term);
  const [source, setSource] = useState<number | null>(null);
  const [withAssessments, setWithAssessments] = useState(true);
  const [busy, setBusy] = useState(false);
  const options = (useGradebooks({ term: termId, page_size: 200 }).data?.results ?? []).filter(
    (g) => g.id !== gradebook.id,
  );

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/gradebooks/${gradebook.id}/copy-setup/`, { source, with_assessments: withAssessments });
      await refresh();
      toast.success(t("grades.copied"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("grades.copyTitle")}</DialogTitle>
          <DialogDescription>{t("grades.copyHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("grades.term")} htmlFor="copy-term">
            <TermSelect
              id="copy-term"
              value={termId}
              onChange={(id) => {
                setTermId(id);
                setSource(null);
              }}
            />
          </Field>
          <Field label={t("grades.copyFrom")} htmlFor="copy-source">
            <OptionSelect
              id="copy-source"
              value={source !== null ? String(source) : null}
              onChange={(v) => setSource(v ? Number(v) : null)}
              placeholder={t("grades.chooseGradebook")}
              options={options.map((g) => ({
                value: String(g.id),
                label: `${g.subject_name} — ${g.class_name} (${g.assessment_count})`,
              }))}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={withAssessments} onCheckedChange={(v) => setWithAssessments(v === true)} />
            {t("grades.copyAssessments")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || source === null}>
            {busy ? t("common.saving") : t("grades.copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DialogState =
  | { kind: "category"; category?: GradeCategory }
  | { kind: "assessment"; assessment?: Assessment }
  | { kind: "copy" }
  | { kind: "delete"; path: string; message: string }
  | null;

/** The teacher's own grading rules: categories (any name, any weight), assessments and the missing-marks rule. */
export function RulesPanel({ gradebook }: { gradebook: GradebookDetail }) {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const formatDate = useFormatDate();
  const editable = gradebook.can.edit;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [applying, setApplying] = useState(false);
  const weights = shares(gradebook.categories.map((c) => Number(c.weight)));
  const categoryName = new Map(gradebook.categories.map((c) => [c.id, c.name]));
  const methodOf = new Map(gradebook.categories.map((c) => [c.id, c.method]));

  const applyTemplate = async (template: (typeof TEMPLATES)[number]) => {
    setApplying(true);
    try {
      for (const [order, category] of template.categories.entries()) {
        await api.post("/grade-categories/", {
          gradebook: gradebook.id,
          name: t(`grades.templateNames.${category.name}`),
          weight: category.weight,
          method: category.method,
          order,
        });
      }
      toast.success(t("grades.templateApplied"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      await refresh();
      setApplying(false);
    }
  };

  const setPolicy = async (policy: MissingPolicy) => {
    try {
      await api.patch(`/gradebooks/${gradebook.id}/`, { missing_policy: policy });
      await refresh();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("grades.categories")}</CardTitle>
            <CardDescription>{t("grades.categoriesHint")}</CardDescription>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              {gradebook.assessments.length === 0 && (
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "copy" })}>
                  <Copy /> {t("grades.copyRules")}
                </Button>
              )}
              <Button size="sm" onClick={() => setDialog({ kind: "category" })}>
                <Plus /> {t("grades.newCategory")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {gradebook.categories.length === 0 ? (
            editable ? (
              <div className="grid gap-3">
                <p className="text-muted-foreground text-sm">{t("grades.startFrom")}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      disabled={applying}
                      onClick={() => void applyTemplate(template)}
                      className="hover:border-primary hover:bg-primary/5 rounded-lg border p-3 text-left transition-colors disabled:opacity-60"
                    >
                      <p className="text-sm font-medium">{t(`grades.templates.${template.key}.title`)}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{t(`grades.templates.${template.key}.body`)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("grades.noCategories")}</p>
            )
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("grades.method")}</TableHead>
                    <TableHead className="text-right">{t("grades.weight")}</TableHead>
                    <TableHead className="text-right">{t("grades.share")}</TableHead>
                    {editable && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradebook.categories.map((category, index) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {t(`grades.methods.${category.method ?? "average"}`)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(category.weight)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{Math.round(weights[index])} %</TableCell>
                      {editable && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ kind: "category", category })}>
                                <Pencil /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() =>
                                  setDialog({
                                    kind: "delete",
                                    path: `/grade-categories/${category.id}/`,
                                    message: t("grades.confirmDeleteCategory", { name: category.name }),
                                  })
                                }
                              >
                                <Trash2 /> {t("common.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("grades.assessments")}</CardTitle>
            <CardDescription>{t("grades.assessmentsHint")}</CardDescription>
          </div>
          {editable && (
            <Button
              size="sm"
              disabled={gradebook.categories.length === 0}
              onClick={() => setDialog({ kind: "assessment" })}
            >
              <Plus /> {t("grades.newAssessment")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {gradebook.assessments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {gradebook.categories.length === 0
                ? t("grades.categoriesFirst")
                : editable
                  ? t("grades.noAssessmentsMine")
                  : t("grades.noAssessmentsYet")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("grades.category")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("common.date")}</TableHead>
                    <TableHead className="text-right">{t("grades.maxScore")}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">{t("grades.assessmentWeight")}</TableHead>
                    {editable && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradebook.assessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.name}</TableCell>
                      <TableCell className="text-muted-foreground">{categoryName.get(assessment.category)}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {formatDate(assessment.date) || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{outOf(assessment.max_score ?? 20)}</TableCell>
                      <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">
                        {methodOf.get(assessment.category) === "total" ? "—" : `×${Number(assessment.weight)}`}
                      </TableCell>
                      {editable && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ kind: "assessment", assessment })}>
                                <Pencil /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() =>
                                  setDialog({
                                    kind: "delete",
                                    path: `/assessments/${assessment.id}/`,
                                    message: t("grades.confirmDeleteAssessment", { name: assessment.name }),
                                  })
                                }
                              >
                                <Trash2 /> {t("common.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("grades.missingTitle")}</CardTitle>
          <CardDescription>{t(`grades.missingHint.${gradebook.missing_policy ?? "exclude"}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <OptionSelect<MissingPolicy>
            className="sm:w-96"
            aria-label={t("grades.missingTitle")}
            disabled={!editable}
            value={gradebook.missing_policy ?? "exclude"}
            onChange={(v) => v && void setPolicy(v)}
            options={POLICIES.map((p) => ({ value: p, label: t(`grades.missing.${p}`) }))}
          />
        </CardContent>
      </Card>

      {dialog?.kind === "category" && (
        <CategoryDialog gradebook={gradebook} category={dialog.category} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "assessment" && (
        <AssessmentDialog gradebook={gradebook} assessment={dialog.assessment} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "copy" && <CopyDialog gradebook={gradebook} onClose={() => setDialog(null)} />}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={t("common.delete")}
          description={dialog.message}
          confirmLabel={t("common.delete")}
          destructive
          onConfirm={async () => {
            try {
              await api.delete(dialog.path);
              await refresh();
              toast.success(t("common.saved"));
            } catch (error) {
              toast.error(errorMessage(error, t));
            }
          }}
        />
      )}
    </div>
  );
}
