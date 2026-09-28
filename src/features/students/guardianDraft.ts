import type { Guardian, Relationship } from "@/lib/api/types";

export type GuardianDraft = {
  mode: "new" | "existing";
  existing: Guardian | null;
  first_name: string;
  last_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  address: string;
  occupation: string;
  relationship: Relationship;
  is_primary: boolean;
  is_financial_contact: boolean;
};

export const RELATIONSHIPS: Relationship[] = ["mother", "father", "guardian", "other"];

export function emptyGuardian(relationship: Relationship = "mother", primary = false): GuardianDraft {
  return {
    mode: "new",
    existing: null,
    first_name: "",
    last_name: "",
    phone: "",
    alt_phone: "",
    email: "",
    address: "",
    occupation: "",
    relationship,
    is_primary: primary,
    is_financial_contact: primary,
  };
}

/** Problems that block saving, keyed by field. */
export function guardianErrors(draft: GuardianDraft, t: (key: string) => string): Record<string, string> {
  if (draft.mode === "existing") return draft.existing ? {} : { existing: t("guardians.searchHint") };
  const errors: Record<string, string> = {};
  if (!draft.first_name.trim()) errors.first_name = t("validation.required");
  if (!draft.last_name.trim()) errors.last_name = t("validation.required");
  if (!draft.phone.trim() && !draft.email.trim()) errors.phone = t("guardians.contactRequired");
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) errors.email = t("validation.email");
  return errors;
}

/** API payload for one guardian (link an existing record, or create a new one). */
export function guardianPayload(draft: GuardianDraft) {
  const link = {
    relationship: draft.relationship,
    is_primary: draft.is_primary,
    is_financial_contact: draft.is_financial_contact,
  };
  if (draft.mode === "existing" && draft.existing) return { guardian_id: draft.existing.id, ...link };
  return {
    first_name: draft.first_name,
    last_name: draft.last_name,
    phone: draft.phone,
    alt_phone: draft.alt_phone,
    email: draft.email,
    address: draft.address,
    occupation: draft.occupation,
    ...link,
  };
}
