import { useTranslation } from "react-i18next";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademicYears, useLevels, useYearClasses } from "@/features/academics/api";
import { useTeacherOptions } from "@/features/people/api";
import { cn } from "@/lib/utils";

const ALL = "all";
const NONE = "none";

type BaseProps = { id?: string; className?: string; disabled?: boolean; "aria-label"?: string };

/** Generic select over a fixed list of values; `allLabel` adds an "all" choice mapped to null. */
export function OptionSelect<T extends string>({
  value,
  onChange,
  options,
  allLabel,
  placeholder,
  ...props
}: BaseProps & {
  value: T | null;
  onChange: (value: T | null) => void;
  options: { value: T; label: string }[];
  allLabel?: string;
  placeholder?: string;
}) {
  return (
    <Select
      value={value ?? (allLabel ? ALL : "")}
      onValueChange={(v) => v && onChange(v === ALL ? null : (v as T))}
      disabled={props.disabled}
    >
      <SelectTrigger id={props.id} className={cn("w-full", props.className)} aria-label={props["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IdSelect({
  value,
  onChange,
  items,
  allLabel,
  noneLabel,
  placeholder,
  ...props
}: BaseProps & {
  value: number | null;
  onChange: (value: number | null) => void;
  items: { id: number; label: string }[];
  allLabel?: string;
  noneLabel?: string;
  placeholder?: string;
}) {
  const empty = allLabel ? ALL : noneLabel ? NONE : "";
  return (
    <Select
      value={value !== null ? String(value) : empty}
      onValueChange={(v) => v && onChange(v === ALL || v === NONE ? null : Number(v))}
      disabled={props.disabled}
    >
      <SelectTrigger id={props.id} className={cn("w-full", props.className)} aria-label={props["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {items.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function YearSelect(
  props: BaseProps & { value: number | null; onChange: (id: number | null) => void; allLabel?: string },
) {
  const { t } = useTranslation();
  const years = useAcademicYears().data ?? [];
  return (
    <IdSelect
      {...props}
      placeholder={t("academics.chooseYear")}
      items={years.map((y) => ({ id: y.id, label: y.is_current ? `${y.name} · ${t("academics.current")}` : y.name }))}
    />
  );
}

export function LevelSelect(
  props: BaseProps & { value: number | null; onChange: (id: number | null) => void; allLabel?: string },
) {
  const { t } = useTranslation();
  const levels = useLevels().data ?? [];
  return (
    <IdSelect
      {...props}
      placeholder={t("academics.chooseLevel")}
      items={levels.filter((l) => l.is_active).map((l) => ({ id: l.id, label: l.name }))}
    />
  );
}

export function ClassSelect({
  yearId,
  showPlaces,
  ...props
}: BaseProps & {
  yearId: number | null | undefined;
  value: number | null;
  onChange: (id: number | null) => void;
  allLabel?: string;
  showPlaces?: boolean;
}) {
  const { t } = useTranslation();
  const { classes } = useYearClasses(yearId);
  return (
    <IdSelect
      {...props}
      placeholder={t("classes.chooseClass")}
      items={classes.map((c) => {
        const places =
          showPlaces && c.capacity ? ` — ${t("classes.placesLeft", { count: c.capacity - c.enrolled_count })}` : "";
        return { id: c.id, label: `${c.name}${places}` };
      })}
    />
  );
}

export function TeacherSelect(props: BaseProps & { value: number | null; onChange: (id: number | null) => void }) {
  const { t } = useTranslation();
  const { teachers } = useTeacherOptions();
  return (
    <IdSelect
      {...props}
      noneLabel={t("common.none")}
      placeholder={t("staff.chooseTeacher")}
      items={teachers.map((s) => ({ id: s.id, label: s.full_name }))}
    />
  );
}
