import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

import { FINANCE_KEY } from "./api";

/** Confirm a cancellation that needs a reason (expense, refund), then refresh every finance figure. */
export function ReasonDialog({
  title,
  hint,
  confirmLabel,
  path,
  success,
  onClose,
}: {
  title: string;
  hint: string;
  confirmLabel: string;
  /** The API action to post `{reason}` to. */
  path: string;
  success: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(path, { reason });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(success);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        <Field label={t("common.reason")} htmlFor="reason">
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.close")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? t("common.saving") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
