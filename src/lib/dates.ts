import { useTranslation } from "react-i18next";

import { localeFor } from "@/lib/format";

export function useFormatDate() {
  const { i18n } = useTranslation();
  return (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat(localeFor(i18n.language), { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`))
      : "";
}

export function ageFrom(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age;
}
