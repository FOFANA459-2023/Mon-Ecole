import type { TFunction } from "i18next";
import { z } from "zod";

export function studentSchema(t: TFunction) {
  return z.object({
    student_number: z.string().trim().max(30),
    last_name: z.string().trim().min(1, t("validation.required")).max(100),
    first_name: z.string().trim().min(1, t("validation.required")).max(100),
    gender: z.enum(["M", "F"], { error: t("validation.required") }),
    date_of_birth: z.string(),
    place_of_birth: z.string().trim().max(100),
    nationality: z.string().trim().max(60),
    phone: z.string().trim().max(30),
    email: z.union([z.literal(""), z.email(t("validation.email"))]),
    address: z.string().trim(),
    notes: z.string().trim(),
  });
}

export type StudentValues = z.infer<ReturnType<typeof studentSchema>>;
export type StudentDraft = Omit<StudentValues, "gender"> & { gender: "M" | "F" | "" };

export const emptyStudent: StudentDraft = {
  student_number: "",
  last_name: "",
  first_name: "",
  gender: "",
  date_of_birth: "",
  place_of_birth: "",
  nationality: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function studentPayload(values: StudentDraft) {
  return { ...values, date_of_birth: values.date_of_birth || null };
}


/** Validate a draft with zod; returns field errors (empty when valid). */
export function validateStudent(draft: StudentDraft, t: TFunction): Partial<Record<keyof StudentDraft, string>> {
  const result = studentSchema(t).safeParse(draft);
  if (result.success) return {};
  const errors: Partial<Record<keyof StudentDraft, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof StudentDraft;
    errors[key] ??= issue.message;
  }
  return errors;
}
