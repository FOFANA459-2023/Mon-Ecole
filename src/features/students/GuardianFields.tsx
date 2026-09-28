import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useGuardianSearch } from "@/features/people/api";
import type { Guardian } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

import { RELATIONSHIPS, type GuardianDraft } from "./guardianDraft";

function ExistingGuardianSearch({ onPick }: { onPick: (guardian: Guardian) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query);
  const results = useGuardianSearch(search);
  return (
    <div className="grid gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("guardians.searchExisting")} />
      {search.trim().length < 2 ? (
        <p className="text-muted-foreground text-xs">{t("guardians.searchHint")}</p>
      ) : results.data?.results.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t("guardians.noMatch")}</p>
      ) : (
        <ul className="grid max-h-48 gap-1 overflow-y-auto">
          {results.data?.results.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onPick(g)}
                className="hover:bg-muted flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm"
              >
                <UserRound className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{g.full_name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[g.phone, t("guardians.otherChildren", { names: g.students.map((s) => s.full_name).join(", ") })]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-primary text-xs font-medium">{t("guardians.useThis")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Form section for one guardian: choose a known guardian (sibling) or enter a new one. */
export function GuardianFields({
  value,
  onChange,
  errors = {},
  idPrefix,
  allowExisting = true,
}: {
  value: GuardianDraft;
  onChange: (value: GuardianDraft) => void;
  errors?: Record<string, string>;
  idPrefix: string;
  allowExisting?: boolean;
}) {
  const { t } = useTranslation();
  const mode = value.mode;
  const set = <K extends keyof GuardianDraft>(key: K, v: GuardianDraft[K]) => onChange({ ...value, [key]: v });
  const text = (key: "first_name" | "last_name" | "phone" | "alt_phone" | "email" | "occupation" | "address", label: string, type = "text") => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`} error={errors[key]}>
      <Input id={`${idPrefix}-${key}`} type={type} value={value[key]} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
        <Field label={t("guardians.relationship")} htmlFor={`${idPrefix}-rel`}>
          <OptionSelect
            id={`${idPrefix}-rel`}
            value={value.relationship}
            onChange={(v) => v && set("relationship", v)}
            options={RELATIONSHIPS.map((r) => ({ value: r, label: t(`relationship.${r}`) }))}
          />
        </Field>
        {allowExisting && (
          <div className="bg-muted inline-flex w-fit rounded-lg p-1 text-sm">
            {(["new", "existing"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...value, mode: m, existing: m === "new" ? null : value.existing })}
                className={cn(
                  "rounded-md px-3 py-1.5",
                  mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {m === "new" ? t("guardians.newGuardian") : t("guardians.existing")}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "existing" ? (
        value.existing ? (
          <div className="bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <Check className="text-success size-4" />
            <span className="flex-1">
              <span className="font-medium">{value.existing.full_name}</span>
              <span className="text-muted-foreground"> · {value.existing.phone}</span>
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, existing: null })}>
              {t("guardians.changeChoice")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <ExistingGuardianSearch onPick={(g) => onChange({ ...value, existing: g })} />
            {errors.existing && <p className="text-destructive text-xs">{errors.existing}</p>}
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("last_name", t("guardians.lastName"))}
          {text("first_name", t("guardians.firstName"))}
          {text("phone", t("guardians.phone"), "tel")}
          {text("alt_phone", t("guardians.altPhone"), "tel")}
          {text("email", t("guardians.email"), "email")}
          {text("occupation", t("guardians.occupation"))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={value.is_primary} onCheckedChange={(v) => set("is_primary", v === true)} />
          {t("guardians.primary")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={value.is_financial_contact}
            onCheckedChange={(v) => set("is_financial_contact", v === true)}
          />
          {t("guardians.financialContact")}
        </label>
      </div>
    </div>
  );
}
