import type { TFunction } from "i18next";
import { z } from "zod";

function newPasswordFields(t: TFunction) {
  return {
    new_password: z.string().min(10, t("validation.passwordLength")),
    confirm: z.string().min(1, t("validation.required")),
  };
}

/** New password + confirmation; the minimum length matches the server (10). */
export function newPasswordSchema(t: TFunction) {
  return z
    .object(newPasswordFields(t))
    .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: t("validation.passwordsDiffer") });
}

export function changePasswordSchema(t: TFunction) {
  return z
    .object({ current_password: z.string().min(1, t("validation.required")), ...newPasswordFields(t) })
    .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: t("validation.passwordsDiffer") });
}
