import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { type useCashChoice, useFormatDateTime } from "./api";

export function CashSessionNotice({ choice }: { choice: ReturnType<typeof useCashChoice> }) {
  const { t } = useTranslation();
  const { dateTime } = useFormatDateTime();
  if (!choice.isCash || !choice.canSee || !choice.query.isSuccess) return null;
  const { sessions } = choice;
  if (sessions.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          {t("cash.noOpenRegister")}{" "}
          <Link to="/cash-register" className="text-primary font-medium hover:underline">
            {t("cash.openTheRegister")}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (sessions.length === 1) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("cash.goesInto", { register: sessions[0].register_name, date: dateTime(sessions[0].opened_at) })}
      </p>
    );
  }
  return (
    <Field label={t("cash.whichRegister")} htmlFor="cash-session">
      <OptionSelect
        id="cash-session"
        value={choice.session !== null ? String(choice.session) : null}
        onChange={(v) => choice.setChosen(v ? Number(v) : null)}
        options={sessions.map((s) => ({ value: String(s.id), label: s.register_name }))}
        placeholder={t("cash.chooseRegister")}
      />
    </Field>
  );
}
