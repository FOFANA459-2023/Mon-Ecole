import { Check, Copy, KeyRound, Wand2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/forms";

// No look-alike characters (0/O, 1/l/I): the password is read out or written down and typed by hand.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function suggestPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((group) => group.join("")).join("-");
}

/** Someone forgot their password: the person who manages them sets a temporary one and hands it over in
 * person (there is no reset by email). They choose their own at their next sign-in. */
export function ResetPasswordDialog({
  name,
  onSubmit,
  onClose,
}: {
  name: string;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState(suggestPassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      setDone(true);
    } catch (err) {
      setError((err instanceof ApiError && err.fields.new_password?.[0]) || errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard blocked: the password is on screen to write down.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("passwordReset.title", { name })}</DialogTitle>
          <DialogDescription>{done ? t("passwordReset.doneHint", { name }) : t("passwordReset.hint", { name })}</DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <div className="bg-muted flex items-center gap-2 rounded-lg border p-3">
              <KeyRound className="text-primary size-4 shrink-0" />
              <code className="flex-1 font-mono text-base font-semibold tracking-wide break-all">{password}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />} {copied ? t("passwordReset.copied") : t("passwordReset.copy")}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>{t("common.close")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="grid gap-4">
            <Field label={t("passwordReset.temporary")} htmlFor="reset-password" error={error ?? undefined}>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  aria-invalid={error ? true : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPassword(suggestPassword());
                    setError(null);
                  }}
                >
                  <Wand2 /> {t("passwordReset.suggest")}
                </Button>
              </div>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy || password.length === 0}>
                <KeyRound /> {busy ? t("common.saving") : t("passwordReset.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
