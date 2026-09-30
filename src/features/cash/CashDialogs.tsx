import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Field } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_KEY, useMoney } from "@/features/finance/api";
import { total } from "@/features/finance/allocation";
import { api } from "@/lib/api/client";
import type { CashDirection, CashRegister } from "@/lib/api/types";
import { errorMessage } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { printJournal } from "./api";

function useSave(onDone: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (request: () => Promise<unknown>, success: string, options?: Parameters<typeof toast.success>[1]) => {
    setBusy(true);
    try {
      await request();
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(success, options);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function OpenSessionDialog({ register, onClose }: { register: CashRegister; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [float, setFloat] = useState(String(Number(register.last_counted)));
  const [note, setNote] = useState("");
  const { busy, run } = useSave(onClose);
  const valid = float.trim() !== "" && Number(float) >= 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cash.openTitle", { register: register.name })}</DialogTitle>
          <DialogDescription>{t("cash.openHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label={t("cash.floatFor", { currency: money.currency })}
            htmlFor="o-float"
            hint={t("cash.lastCount", { amount: money.format(register.last_counted) })}
          >
            <Input id="o-float" type="number" min={0} step="any" value={float} onChange={(e) => setFloat(e.target.value)} />
          </Field>
          <Field label={t("common.notes")} htmlFor="o-note">
            <Input id="o-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || !valid}
            onClick={() =>
              run(
                () => api.post("/cash-sessions/", { register: register.id, opening_balance: Number(float), note }),
                t("cash.opened", { register: register.name }),
              )
            }
          >
            {busy ? t("common.saving") : t("cash.open")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloseSessionDialog({
  session,
  onClose,
}: {
  session: { id: number; register_name: string; expected: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const { busy, run } = useSave(onClose);
  const hasCount = counted.trim() !== "" && Number(counted) >= 0;
  const difference = hasCount ? total([Number(counted), -Number(session.expected)], money.currency) : 0;
  const needsNote = hasCount && difference !== 0 && !note.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cash.closeTitle", { register: session.register_name })}</DialogTitle>
          <DialogDescription>{t("cash.closeHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="bg-muted/50 flex justify-between rounded-lg p-3 text-sm">
            <span className="text-muted-foreground">{t("cash.expected")}</span>
            <span className="font-semibold tabular-nums">{money.format(session.expected)}</span>
          </div>
          <Field label={t("cash.countedFor", { currency: money.currency })} htmlFor="c-counted">
            <Input id="c-counted" type="number" min={0} step="any" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </Field>
          {hasCount && (
            <p
              className={cn("text-sm font-medium", difference < 0 && "text-destructive", difference > 0 && "text-amber-700")}
              role="status"
            >
              {difference === 0
                ? t("cash.balanced")
                : difference > 0
                  ? t("cash.surplus", { amount: money.format(difference) })
                  : t("cash.shortage", { amount: money.format(-difference) })}
            </p>
          )}
          <Field
            label={t("cash.closingNote")}
            htmlFor="c-note"
            error={needsNote ? t("cash.explainDifference") : undefined}
          >
            <Textarea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || !hasCount || needsNote}
            onClick={() =>
              run(
                () => api.post(`/cash-sessions/${session.id}/close/`, { counted_closing: Number(counted), closing_note: note }),
                t("cash.closed", { register: session.register_name }),
                { action: { label: t("cash.printJournal"), onClick: () => printJournal(session.id, t) }, duration: 10_000 },
              )
            }
          >
            {busy ? t("common.saving") : t("cash.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MovementDialog({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [direction, setDirection] = useState<CashDirection>("out");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const { busy, run } = useSave(onClose);
  const valid = Number(amount) > 0 && description.trim() !== "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cash.movementTitle")}</DialogTitle>
          <DialogDescription>{t("cash.movementHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("cash.direction")} htmlFor="m-direction">
            <OptionSelect<CashDirection>
              id="m-direction"
              value={direction}
              onChange={(v) => v && setDirection(v)}
              options={(["in", "out"] as const).map((d) => ({ value: d, label: t(`cash.directions.${d}`) }))}
            />
          </Field>
          <Field label={t("finance.amountFor", { currency: money.currency })} htmlFor="m-amount">
            <Input id="m-amount" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("finance.description")} htmlFor="m-description">
            <Input
              id="m-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              placeholder={t("cash.movementPlaceholder")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || !valid}
            onClick={() =>
              run(
                () => api.post(`/cash-sessions/${sessionId}/movements/`, { direction, amount: Number(amount), description }),
                t("cash.movementRecorded"),
              )
            }
          >
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterDialog({ register, onClose }: { register?: CashRegister; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(register?.name ?? "");
  const [active, setActive] = useState(register?.is_active ?? true);
  const { busy, run } = useSave(onClose);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{register ? t("cash.editRegister") : t("cash.newRegister")}</DialogTitle>
          <DialogDescription>{t("cash.registerHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("cash.registerName")} htmlFor="r-name">
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </Field>
          {register && (
            <div className="flex items-center gap-3">
              <Switch id="r-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="r-active">{t("cash.inUse")}</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={() =>
              run(
                () =>
                  register
                    ? api.patch(`/cash-registers/${register.id}/`, { name, is_active: active })
                    : api.post("/cash-registers/", { name }),
                t("common.saved"),
              )
            }
          >
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
