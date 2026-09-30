import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/features/settings/api";
import { api } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import { applyApiErrors } from "@/lib/forms";

import { emptyTeaching, type Teaching, teachingPayload } from "./teaching";
import { TeachingEditor } from "./TeachingEditor";

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
  "role_id",
] as const;

// The Director role is granted by the platform owner only, never from this form.
const DIRECTOR = "director";
const TYPE_FOR_ROLE: Record<string, (typeof TYPES)[number]> = {
  teacher: "teacher",
  admin_staff: "administrative",
  accountant: "administrative",
};

const blankToNull = (v: unknown) => (v === "" ? null : v);

/**
 * Add or edit a staff member. Adding someone always gives them access to Mon École: the email and the role
 * are required, and they receive an invitation (verification link + temporary password). For a teacher,
 * the class they lead and the subjects they teach can be set right away.
 */
export function StaffFormDialog({ staff, onClose }: { staff?: Staff; onClose: (saved?: Staff) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const adding = !staff;
  const roles = (useRoles().data ?? []).filter((r) => r.key !== DIRECTOR && r.key !== "parent");
  const [teaching, setTeaching] = useState<Teaching>(emptyTeaching);
  const schema = useMemo(
    () =>
      z.object({
        role_id: adding ? z.number(t("validation.required")) : z.number().optional(),
        employee_number: z.string().trim().max(30),
        first_name: z.string().trim().min(1, t("validation.required")).max(100),
        last_name: z.string().trim().min(1, t("validation.required")).max(100),
        gender: z.enum(["M", "F", ""]),
        date_of_birth: z.string().nullable(),
        phone: z.string().trim().max(30),
        email: adding
          ? z.email(t("validation.emailRequiredForAccess"))
          : z.union([z.literal(""), z.email(t("validation.email"))]),
        address: z.string().trim(),
        staff_type: z.enum(TYPES),
        position: z.string().trim().max(100),
        qualification: z.string().trim().max(150),
        specialization: z.string().trim().max(150),
        employment_date: z.string().nullable(),
      }),
    [t, adding],
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
      role_id: undefined,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const roleId = useWatch({ control: form.control, name: "role_id" });
  const isTeacher = roles.find((r) => r.id === roleId)?.key === "teacher";

  const onSubmit = form.handleSubmit(async (values) => {
    const { role_id, ...body } = values;
    if (staff) delete (body as Partial<Values>).employee_number;
    try {
      const saved = staff
        ? await api.patch<Staff>(`/staff/${staff.id}/`, body)
        : await api.post<Staff>("/staff/", {
            ...body,
            role_id,
            ...(isTeacher ? { teaching: teachingPayload(teaching) } : {}),
          });
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      await queryClient.invalidateQueries({ queryKey: ["classes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(staff ? t("staff.updated") : t("staff.createdInvited", { email: body.email }));
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
          {adding && <DialogDescription>{t("staff.addHint")}</DialogDescription>}
        </DialogHeader>
        <form id="staff-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {adding && (
            <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
              <legend className="px-1 text-sm font-medium">{t("staff.accessSection")}</legend>
              <Field label={t("staff.role")} htmlFor="st-role" error={errors.role_id?.message}>
                <Controller
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <OptionSelect
                      id="st-role"
                      value={field.value ? String(field.value) : null}
                      onChange={(v) => {
                        const role = roles.find((r) => String(r.id) === v);
                        field.onChange(role?.id);
                        const type = role ? TYPE_FOR_ROLE[role.key] : undefined;
                        if (type) form.setValue("staff_type", type);
                      }}
                      options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
                      placeholder={t("staff.chooseRole")}
                    />
                  )}
                />
              </Field>
              {text("email", t("staff.loginEmail"), { type: "email", autoComplete: "off" })}
              <p className="text-muted-foreground text-xs sm:col-span-2">{t("staff.inviteExplained")}</p>
            </fieldset>
          )}
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
          {!adding && text("email", t("staff.email"), { type: "email" })}
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
          {adding && isTeacher && (
            <fieldset className="grid gap-3 rounded-lg border p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-medium">{t("staff.teachingSection")}</legend>
              <TeachingEditor value={teaching} onChange={setTeaching} />
            </fieldset>
          )}
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
