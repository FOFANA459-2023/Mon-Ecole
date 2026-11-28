import { CalendarRange } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useAcademicYears, useCurrentYear, useSchoolId } from "./api";
import { setWorkingYearId } from "./workingYear";

// Page filters that belong to one year (a class, a term) mean nothing in another one.
const YEAR_BOUND_PARAMS = ["year", "class", "term", "page"];

/** The school year every page shows, always in sight at the top of the screen. */
export function YearSwitcher() {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const years = useAcademicYears().data ?? [];
  const year = useCurrentYear();
  const [, setSearchParams] = useSearchParams();
  if (schoolId === null || !year) return null;

  const change = (value: string) => {
    const picked = years.find((y) => y.id === Number(value));
    if (!picked || picked.id === year.id) return;
    // Picking the official current year again means "follow the school's current year".
    setWorkingYearId(schoolId, picked.is_current ? null : picked.id);
    setSearchParams(
      (params) => {
        YEAR_BOUND_PARAMS.forEach((key) => params.delete(key));
        return params;
      },
      { replace: true },
    );
  };

  return (
    <Select value={String(year.id)} onValueChange={change}>
      <SelectTrigger
        aria-label={t("academics.workingYear")}
        className={cn(
          "h-9 max-w-[12rem] gap-2 rounded-full pr-2.5 pl-3 font-medium shadow-none sm:max-w-none",
          year.is_current
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10"
            : "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15",
        )}
      >
        <CalendarRange className={cn("size-4", year.is_current ? "text-primary" : "text-amber-600 dark:text-amber-400")} />
        <span className="text-muted-foreground hidden text-xs font-normal xl:inline">{t("academics.chooseYear")}</span>
        <span className="truncate">{year.name}</span>
        <span
          className={cn(
            "hidden rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold uppercase sm:inline",
            year.is_current
              ? "bg-primary/15 text-primary"
              : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
          )}
        >
          {year.is_current ? t("academics.current") : t("academics.notCurrent")}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-(--radix-select-trigger-width)">
        {years.map((y) => (
          <SelectItem key={y.id} value={String(y.id)}>
            {y.is_current ? `${y.name} · ${t("academics.current")}` : y.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
