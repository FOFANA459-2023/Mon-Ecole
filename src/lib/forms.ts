import type { TFunction } from "i18next";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/lib/api/client";

/** A user-facing message for any error thrown by the API client. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.code === "network_error") return t("errors.network");
    if (error.status === 403) return t("errors.forbidden");
    if (error.message && error.status < 500) return error.message;
  }
  return t("errors.generic");
}

/**
 * Copy API field errors onto a react-hook-form form. Returns the message to show
 * for anything that could not be attached to a field.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  t: TFunction,
): string | null {
  if (!(error instanceof ApiError) || error.code !== "validation_error") return errorMessage(error, t);
  let unmatched: string | null = null;
  for (const [field, messages] of Object.entries(error.fields)) {
    if (knownFields.includes(field)) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
    } else {
      unmatched ??= messages[0] ?? null;
    }
  }
  if (Object.keys(error.fields).length === 0) return error.message;
  return unmatched;
}
