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

// Currencies without minor units (same list as the backend's apps/finance/money.py).
const ZERO_DECIMAL_CURRENCIES = new Set(["GNF", "XOF", "XAF", "RWF", "BIF", "DJF", "KMF", "UGX"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function formatMoney(amount: number | string, currency: string, language: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const digits = currencyDecimals(currency);
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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
