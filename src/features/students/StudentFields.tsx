import { useTranslation } from "react-i18next";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { StudentDraft } from "./studentDraft";

/** Controlled student identity fields, shared by the enrolment wizard and the edit dialog. */
export function StudentFields({
  value,
  onChange,
  errors = {},
  showNumber,
}: {
  value: StudentDraft;
  onChange: (value: StudentDraft) => void;
  errors?: Partial<Record<keyof StudentDraft, string>>;
  showNumber?: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof StudentDraft>(key: K, v: StudentDraft[K]) => onChange({ ...value, [key]: v });
  const text = (key: Exclude<keyof StudentDraft, "gender" | "address" | "notes">, label: string, type = "text", hint?: string) => (
    <Field label={label} htmlFor={`stu-${key}`} error={errors[key]} hint={hint}>
      <Input id={`stu-${key}`} type={type} value={value[key]} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {text("last_name", t("students.lastName"))}
      {text("first_name", t("students.firstName"))}
      <Field label={t("students.gender")} htmlFor="stu-gender" error={errors.gender}>
        <OptionSelect
          id="stu-gender"
          value={value.gender || null}
          onChange={(v) => set("gender", v ?? "")}
          placeholder="—"
          options={[
            { value: "M", label: t("gender.M") },
            { value: "F", label: t("gender.F") },
          ]}
        />
      </Field>
      {text("date_of_birth", t("students.dateOfBirth"), "date")}
      {text("place_of_birth", t("students.placeOfBirth"))}
      {text("nationality", t("students.nationality"))}
      {text("phone", t("students.phone"), "tel")}
      {text("email", t("students.email"), "email")}
      {showNumber && text("student_number", t("students.number"), "text", t("enrollments.studentNumberHint"))}
      <Field label={t("students.address")} htmlFor="stu-address" className="sm:col-span-2">
        <Textarea id="stu-address" rows={2} value={value.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label={t("students.notes")} htmlFor="stu-notes" className="sm:col-span-2">
        <Textarea id="stu-notes" rows={2} value={value.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}
