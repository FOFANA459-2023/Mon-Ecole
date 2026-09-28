const LOCALES: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

export function localeFor(language: string): string {
  return LOCALES[language] ?? "fr-FR";
}

export function formatDateTime(value: string | null | undefined, language: string, timeZone?: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(localeFor(language), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatMoney(amount: number | string, currency: string, language: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "GNF" ? 0 : 2,
  }).format(value);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
