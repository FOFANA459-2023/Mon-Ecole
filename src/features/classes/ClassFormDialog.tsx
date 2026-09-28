import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { LevelSelect, OptionSelect, TeacherSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { ClassGroup } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

const FIELDS = ["academic_year", "level", "name", "room", "class_teacher", "capacity", "status"] as const;

export function ClassFormDialog({
  classGroup,
  defaultYearId,
  onClose,
}: {
  classGroup?: ClassGroup;
  defaultYearId?: number | null;
  onClose: (saved?: ClassGroup) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = useMemo(
    () =>
      z.object({
        academic_year: z.number(t("validation.required")),
        level: z.number(t("validation.required")),
        name: z.string().trim().min(1, t("validation.required")).max(50),
        room: z.string().trim().max(50),
        class_teacher: z.number().nullable(),
        capacity: z.number().int().min(1).max(500).nullable(),
        status: z.enum(["active", "archived"]),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      academic_year: classGroup?.academic_year ?? defaultYearId ?? undefined,
      level: classGroup?.level ?? undefined,
      name: classGroup?.name ?? "",
      room: classGroup?.room ?? "",
      class_teacher: classGroup?.class_teacher ?? null,
      capacity: classGroup?.capacity ?? null,
      status: classGroup?.status ?? "active",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = classGroup
        ? await api.patch<ClassGroup>(`/classes/${classGroup.id}/`, values)
        : await api.post<ClassGroup>("/classes/", values);
      await Promise.all(["classes", "dashboard", "levels"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success(classGroup ? t("classes.updated") : t("classes.created"));
      onClose(saved);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELDS, t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{classGroup ? t("classes.editClass") : t("classes.newClass")}</DialogTitle>
        </DialogHeader>
        <form id="class-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label={t("classes.year")} htmlFor="c-year" error={errors.academic_year?.message}>
            <Controller
              control={form.control}
              name="academic_year"
              render={({ field }) => (
                <YearSelect id="c-year" value={field.value ?? null} onChange={(v) => field.onChange(v ?? undefined)} />
              )}
            />
          </Field>
          <Field label={t("classes.level")} htmlFor="c-level" error={errors.level?.message}>
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <LevelSelect id="c-level" value={field.value ?? null} onChange={(v) => field.onChange(v ?? undefined)} />
              )}
            />
          </Field>
          <Field label={t("classes.name")} htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" placeholder={t("classes.namePlaceholder")} {...form.register("name")} />
          </Field>
          <Field label={t("classes.room")} htmlFor="c-room" error={errors.room?.message}>
            <Input id="c-room" {...form.register("room")} />
          </Field>
          <Field label={t("classes.classTeacher")} htmlFor="c-teacher">
            <Controller
              control={form.control}
              name="class_teacher"
              render={({ field }) => <TeacherSelect id="c-teacher" value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field
            label={t("classes.capacity")}
            htmlFor="c-capacity"
            error={errors.capacity?.message}
            hint={t("classes.capacityHint")}
          >
            <Input
              id="c-capacity"
              type="number"
              min={1}
              {...form.register("capacity", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
            />
          </Field>
          {classGroup && (
            <Field label={t("common.status")} htmlFor="c-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <OptionSelect
                    id="c-status"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={[
                      { value: "active", label: t("status.active") },
                      { value: "archived", label: t("status.archived") },
                    ]}
                  />
                )}
              />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="class-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
