import { useTranslation } from "react-i18next";

import { localeFor } from "@/lib/format";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "5 minutes ago", "il y a 2 jours"; dates older than a week are shown as dates. */
export function useTimeAgo() {
  const { i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  return (value: string | null | undefined, now = Date.now()): string => {
    if (!value) return "";
    const seconds = Math.round((new Date(value).getTime() - now) / 1000);
    if (Math.abs(seconds) >= 7 * 86_400) {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
    }
    const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, "minute");
  };
}
