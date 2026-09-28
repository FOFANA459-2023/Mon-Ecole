import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

const TYPES = ["teacher", "administrative", "support"] as const;
const FIELDS = [
  "employee_number",
  "first_name",
  "last_name",
  "gender",
  "date_of_birth",
  "phone",
  "email",
  "address",
  "staff_type",
  "position",
  "qualification",
  "specialization",
  "employment_date",
] as const;

const blankToNull = (v: unknown) => (v === "" ? null : v);

export function StaffFormDialog({ staff, onClose }: { staff?: Staff; onClose: (saved?: Staff) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = useMemo(
    () =>
      z.object({
        employee_number: z.string().trim().max(30),
        first_name: z.string().trim().min(1, t("validation.required")).max(100),
        last_name: z.string().trim().min(1, t("validation.required")).max(100),
        gender: z.enum(["M", "F", ""]),
        date_of_birth: z.string().nullable(),
        phone: z.string().trim().max(30),
        email: z.union([z.literal(""), z.email(t("validation.email"))]),
        address: z.string().trim(),
        staff_type: z.enum(TYPES),
        position: z.string().trim().max(100),
        qualification: z.string().trim().max(150),
        specialization: z.string().trim().max(150),
        employment_date: z.string().nullable(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_number: staff?.employee_number ?? "",
      first_name: staff?.first_name ?? "",
      last_name: staff?.last_name ?? "",
      gender: staff?.gender ?? "",
      date_of_birth: staff?.date_of_birth ?? null,
      phone: staff?.phone ?? "",
      email: staff?.email ?? "",
      address: staff?.address ?? "",
      staff_type: staff?.staff_type ?? "teacher",
      position: staff?.position ?? "",
      qualification: staff?.qualification ?? "",
      specialization: staff?.specialization ?? "",
      employment_date: staff?.employment_date ?? null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = { ...values };
    if (staff) delete (body as Partial<Values>).employee_number;
    try {
      const saved = staff
        ? await api.patch<Staff>(`/staff/${staff.id}/`, body)
        : await api.post<Staff>("/staff/", body);
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(staff ? t("staff.updated") : t("staff.created"));
      onClose(saved);
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELDS, t);
      if (message) toast.error(message);
    }
  });

  const text = (name: (typeof FIELDS)[number], label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={`st-${name}`} error={errors[name]?.message}>
      <Input id={`st-${name}`} {...extra} {...form.register(name, extra.type === "date" ? { setValueAs: blankToNull } : {})} />
    </Field>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{staff ? t("staff.editTitle") : t("staff.add")}</DialogTitle>
        </DialogHeader>
        <form id="staff-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {text("last_name", t("staff.lastName"))}
          {text("first_name", t("staff.firstName"))}
          <Field label={t("staff.gender")} htmlFor="st-gender">
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <OptionSelect
                  id="st-gender"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  allLabel="—"
                  options={[
                    { value: "M", label: t("gender.M") },
                    { value: "F", label: t("gender.F") },
                  ]}
                />
              )}
            />
          </Field>
          {text("date_of_birth", t("staff.dateOfBirth"), { type: "date" })}
          <Field label={t("staff.type")} htmlFor="st-type">
            <Controller
              control={form.control}
              name="staff_type"
              render={({ field }) => (
                <OptionSelect
                  id="st-type"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  options={TYPES.map((v) => ({ value: v, label: t(`staffType.${v}`) }))}
                />
              )}
            />
          </Field>
          {text("position", t("staff.position"))}
          {text("phone", t("staff.phone"), { type: "tel" })}
          {text("email", t("staff.email"), { type: "email" })}
          {text("qualification", t("staff.qualification"))}
          {text("specialization", t("staff.specialization"))}
          {text("employment_date", t("staff.employmentDate"), { type: "date" })}
          {!staff && (
            <Field
              label={t("staff.number")}
              htmlFor="st-employee_number"
              error={errors.employee_number?.message}
              hint={t("enrollments.studentNumberHint")}
            >
              <Input id="st-employee_number" {...form.register("employee_number")} />
            </Field>
          )}
          <Field label={t("staff.address")} htmlFor="st-address" className="sm:col-span-2">
            <Textarea id="st-address" rows={2} {...form.register("address")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="staff-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
