import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Gauge, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type Control,
  Controller,
  type UseFormSetValue,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLevels } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { GradingScale, RankMethod } from "@/lib/api/types";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { GRADES_KEY, useGradingScales } from "./api";

const RANK_METHODS: RankMethod[] = ["competition", "dense"];
/** Out of 20, pass mark 10: what the school uses until it sets its own scale. */
const BUILT_IN = {
  max_mark: "20",
  pass_mark: "10",
  decimals: 2,
  rank_method: "competition" as RankMethod,
  mentions: [] as Band[],
};
/** The usual honours bands as fractions of the maximum (16, 14, 12 and 10 out of 20). */
const USUAL_BANDS = [
  { key: "excellent", share: 0.8 },
  { key: "veryGood", share: 0.7 },
  { key: "good", share: 0.6 },
  { key: "fair", share: 0.5 },
] as const;

type Band = { min: number; label: string };

function bandsOf(scale: { mentions?: unknown }): Band[] {
  return Array.isArray(scale.mentions)
    ? (scale.mentions as { min: number | string; label: string }[]).map((b) => ({ min: Number(b.min), label: b.label }))
    : [];
}
const SCHOOL = "school";

type BandForm = {
  level: number | null;
  max_mark: number;
  pass_mark: number;
  decimals: number;
  rank_method: RankMethod;
  mentions: Band[];
};

/** Honours bands ("Très bien" from 16...): the label printed on report cards for marks from `min` up. */
function BandsEditor({
  control,
  setValue,
}: {
  control: Control<BandForm>;
  setValue: UseFormSetValue<BandForm>;
}) {
  const { t } = useTranslation();
  const bands = useFieldArray({ control, name: "mentions" });
  const max = useWatch({ control, name: "max_mark" }) || 20;
  const useUsual = () =>
    setValue(
      "mentions",
      USUAL_BANDS.map((b) => ({ min: Math.round(b.share * max * 100) / 100, label: t(`grades.scale.usual.${b.key}`) })),
      { shouldDirty: true },
    );
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("grades.scale.bands")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={useUsual}>
          {t("grades.scale.useUsual")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("grades.scale.bandsHint")}</p>
      {bands.fields.map((item, index) => (
        <div key={item.id} className="grid grid-cols-[1fr_6rem_auto] gap-2">
          <Controller
            control={control}
            name={`mentions.${index}.label`}
            render={({ field }) => (
              <Input {...field} aria-label={t("grades.scale.bandLabel")} placeholder={t("grades.scale.bandLabel")} />
            )}
          />
          <Controller
            control={control}
            name={`mentions.${index}.min`}
            render={({ field }) => (
              <Input
                type="number"
                min={0}
                step="any"
                aria-label={t("grades.scale.bandFrom")}
                value={Number.isNaN(field.value) ? "" : field.value}
                onChange={(e) => field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
              />
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.remove")}
            onClick={() => bands.remove(index)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={bands.fields.length >= 10}
        onClick={() => bands.append({ min: 0, label: "" })}
      >
        <Plus /> {t("grades.scale.addBand")}
      </Button>
    </div>
  );
}

function ScaleDialog({
  scale,
  isDefault,
  takenLevels,
  onClose,
}: {
  scale?: GradingScale;
  isDefault: boolean;
  takenLevels: number[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const levels = (useLevels().data ?? []).filter((l) => l.is_active && !takenLevels.includes(l.id));
  const schema = useMemo(
    () =>
      z
        .object({
          level: z.number().nullable(),
          max_mark: z.number(t("validation.required")).min(1, t("grades.positive")),
          pass_mark: z.number(t("validation.required")).min(0),
          decimals: z.number().int().min(0).max(3),
          rank_method: z.enum(RANK_METHODS as [RankMethod, ...RankMethod[]]),
          mentions: z
            .array(
              z.object({
                min: z.number(t("validation.required")).min(0),
                label: z.string().trim().min(1, t("validation.required")).max(40),
              }),
            )
            .max(10),
        })
        .refine((v) => v.pass_mark <= v.max_mark, { path: ["pass_mark"], message: t("grades.passWithinMax") })
        .refine((v) => isDefault || v.level !== null, { path: ["level"], message: t("validation.required") }),
    [t, isDefault],
  );
  type Values = z.infer<typeof schema>;
  const source = scale ?? BUILT_IN;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      level: scale?.level ?? null,
      max_mark: Number(source.max_mark),
      pass_mark: Number(source.pass_mark),
      decimals: source.decimals ?? 2,
      rank_method: source.rank_method ?? "competition",
      mentions: bandsOf(source),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (scale) await api.patch(`/grading-scales/${scale.id}/`, values);
      else await api.post("/grading-scales/", values);
      await queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["level", "max_mark", "pass_mark", "decimals", "mentions"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isDefault ? t("grades.scale.schoolTitle") : t("grades.scale.levelTitle")}</DialogTitle>
          <DialogDescription>{t("grades.scale.dialogHint")}</DialogDescription>
        </DialogHeader>
        <form id="scale-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          {!isDefault && (
            <Field label={t("grades.scale.level")} htmlFor="scale-level" error={errors.level?.message}>
              <Controller
                control={form.control}
                name="level"
                render={({ field }) =>
                  scale ? (
                    <Input id="scale-level" value={scale.level_name} disabled />
                  ) : (
                    <OptionSelect
                      id="scale-level"
                      value={field.value !== null ? String(field.value) : null}
                      onChange={(v) => field.onChange(v ? Number(v) : null)}
                      options={levels.map((l) => ({ value: String(l.id), label: l.name }))}
                      placeholder={t("academics.chooseLevel")}
                    />
                  )
                }
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("grades.scale.maxMark")} htmlFor="scale-max" error={errors.max_mark?.message}>
              <Input id="scale-max" type="number" min={1} step="any" {...form.register("max_mark", { valueAsNumber: true })} />
            </Field>
            <Field label={t("grades.scale.passMark")} htmlFor="scale-pass" error={errors.pass_mark?.message}>
              <Input id="scale-pass" type="number" min={0} step="any" {...form.register("pass_mark", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label={t("grades.scale.decimals")} htmlFor="scale-decimals" error={errors.decimals?.message}>
            <Input
              id="scale-decimals"
              type="number"
              min={0}
              max={3}
              step={1}
              {...form.register("decimals", { valueAsNumber: true })}
            />
          </Field>
          <BandsEditor control={form.control} setValue={form.setValue} />
          <Field label={t("grades.scale.ties")} htmlFor="scale-ties">
            <Controller
              control={form.control}
              name="rank_method"
              render={({ field }) => (
                <OptionSelect<RankMethod>
                  id="scale-ties"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  options={RANK_METHODS.map((m) => ({ value: m, label: t(`grades.scale.rank.${m}`) }))}
                />
              )}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="scale-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Settings → Academic: how marks are reported (out of 20, 10, 100...), with differences for some levels. */
export function GradingScalesCard({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scales = useGradingScales();
  const [dialog, setDialog] = useState<{ scale?: GradingScale; isDefault: boolean } | null>(null);
  const [deleting, setDeleting] = useState<GradingScale | null>(null);

  const rows = scales.data ?? [];
  const school = rows.find((s) => s.level === null);
  const byLevel = rows.filter((s) => s.level !== null);
  const describe = (s: Pick<GradingScale, "max_mark" | "pass_mark" | "decimals" | "rank_method" | "mentions">) => ({
    max: Number(s.max_mark),
    pass: Number(s.pass_mark),
    decimals: s.decimals ?? 2,
    ties: t(`grades.scale.rankShort.${s.rank_method ?? "competition"}`),
    bands: bandsOf(s)
      .map((b) => `${b.label} ≥ ${b.min}`)
      .join(" · "),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="text-primary size-4" /> {t("grades.scale.title")}
          </CardTitle>
          <CardDescription>{t("grades.scale.hint")}</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setDialog({ isDefault: false })}>
            <Plus /> {t("grades.scale.addLevel")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {scales.isError ? (
          <QueryError onRetry={() => void scales.refetch()} />
        ) : scales.isPending ? (
          <Spinner className="mx-auto size-5" />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("grades.scale.appliesTo")}</TableHead>
                  <TableHead>{t("grades.scale.outOf")}</TableHead>
                  <TableHead>{t("grades.scale.passMark")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("grades.scale.decimals")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("grades.scale.ties")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("grades.scale.bands")}</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[{ key: SCHOOL, scale: school }, ...byLevel.map((s) => ({ key: String(s.id), scale: s }))].map(
                  ({ key, scale }) => {
                    const d = describe(scale ?? BUILT_IN);
                    const isDefault = key === SCHOOL;
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">
                          {isDefault ? t("grades.scale.wholeSchool") : scale?.level_name}
                          {isDefault && !school && (
                            <span className="text-muted-foreground ml-2 text-xs">{t("grades.scale.builtIn")}</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">/{d.max}</TableCell>
                        <TableCell className="tabular-nums">{d.pass}</TableCell>
                        <TableCell className="hidden tabular-nums sm:table-cell">{d.decimals}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{d.ties}</TableCell>
                        <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                          {d.bands || "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setDialog({ scale, isDefault })}>
                                  <Pencil /> {t("common.edit")}
                                </DropdownMenuItem>
                                {!isDefault && scale && (
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(scale)}>
                                    <Trash2 /> {t("common.delete")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {dialog && (
        <ScaleDialog
          scale={dialog.scale}
          isDefault={dialog.isDefault}
          takenLevels={byLevel.map((s) => s.level as number)}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("common.delete")}
        description={t("grades.scale.confirmDelete", { level: deleting?.level_name ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.delete(`/grading-scales/${deleting.id}/`);
            await queryClient.invalidateQueries({ queryKey: [GRADES_KEY] });
            toast.success(t("common.saved"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </Card>
  );
}
