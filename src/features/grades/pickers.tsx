import { useTranslation } from "react-i18next";

import { OptionSelect } from "@/components/pickers";

import { useAllTerms } from "./api";

export function TermSelect({
  value,
  onChange,
  id,
  className,
}: {
  value: number | null;
  onChange: (id: number) => void;
  id?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { terms } = useAllTerms();
  return (
    <OptionSelect
      id={id}
      className={className}
      aria-label={t("grades.term")}
      placeholder={t("grades.chooseTerm")}
      value={value !== null ? String(value) : null}
      onChange={(v) => v && onChange(Number(v))}
      options={terms.map((term) => ({ value: String(term.id), label: `${term.name} · ${term.yearName}` }))}
    />
  );
}
