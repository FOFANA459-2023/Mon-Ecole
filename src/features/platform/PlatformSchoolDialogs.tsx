import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserCheck, UserMinus, UserPlus, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResetPasswordDialog } from "@/features/auth/ResetPasswordDialog";
import { api } from "@/lib/api/client";
import type { PlatformSchool } from "@/lib/api/types";
import { applyApiErrors, errorMessage } from "@/lib/forms";

type Director = PlatformSchool["directors"][number];
type DirectorAction = "suspend" | "restore" | "remove";

/** The platform owner manages a school's Directors: add one, suspend, restore or remove them. Teachers and
 * other staff are the Director's to manage, never the owner's. */
export function DirectorsDialog({ school, onClose }: { school: PlatformSchool; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Director | null>(null);
  const [resetting, setResetting] = useState<Director | null>(null);
  const [busy, setBusy] = useState(false);

  const change = async (director: Director, action: DirectorAction) => {
    setBusy(true);
    try {
      await api.post(`/platform/schools/${school.id}/directors/change/`, { user_id: director.id, action });
      await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
      toast.success(t(`platform.directors.done.${action}`, { name: director.full_name }));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("platform.directors.title", { school: school.name })}</DialogTitle>
          <DialogDescription>{t("platform.directors.hint")}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-md border">
          {school.directors.length === 0 && (
            <li className="text-muted-foreground p-3 text-sm">{t("platform.directors.none")}</li>
          )}
          {school.directors.map((director) => (
            <li key={director.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{director.full_name}</p>
                <p className="text-muted-foreground truncate text-xs">{director.email}</p>
              </div>
              {!director.is_active ? (
                <StatusBadge status="suspended" />
              ) : director.account_status !== "active" ? (
                <StatusBadge status={`invite_${director.account_status}`} />
              ) : (
                <Badge className="bg-success/15 text-success border-transparent">{t("common.active")}</Badge>
              )}
              <div className="flex gap-1">
                {director.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setResetting(director)}
                    aria-label={t("passwordReset.actionFor", { name: director.full_name })}
                  >
                    <KeyRound /> {t("passwordReset.short")}
                  </Button>
                )}
                {director.is_active ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void change(director, "suspend")}>
                    <UserX /> {t("platform.directors.suspend")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void change(director, "restore")}>
                    <UserCheck /> {t("platform.directors.restore")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => setRemoving(director)}
                  aria-label={t("platform.directors.removeOf", { name: director.full_name })}
                >
                  <UserMinus />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {adding ? (
          <AddDirectorForm school={school} onDone={() => setAdding(false)} />
        ) : (
          <Button variant="outline" className="justify-self-start" onClick={() => setAdding(true)}>
            <UserPlus /> {t("platform.directors.add")}
          </Button>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("platform.directors.remove")}
          description={t("platform.directors.confirmRemove", { name: removing?.full_name ?? "", school: school.name })}
          confirmLabel={t("platform.directors.remove")}
          destructive
          onConfirm={() => (removing ? change(removing, "remove") : undefined)}
        />
        {resetting && (
          <ResetPasswordDialog
            name={resetting.full_name}
            onSubmit={(password) =>
              api.post(`/platform/schools/${school.id}/directors/reset-password/`, {
                user_id: resetting.id,
                new_password: password,
              })
            }
            onClose={() => setResetting(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddDirectorForm({ school, onDone }: { school: PlatformSchool; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      first_name: z.string().trim().min(1, required).max(150),
      last_name: z.string().trim().min(1, required).max(150),
      email: z.string().trim().email(t("validation.email")),
      phone: z.string().max(30),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", email: "", phone: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api.post(`/platform/schools/${school.id}/directors/`, values);
      await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
      toast.success(t("platform.directors.added", { email: values.email }));
      onDone();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["first_name", "last_name", "email", "phone"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border p-3" noValidate>
      <p className="text-sm font-medium">{t("platform.directors.add")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("platform.firstName")} htmlFor="nd-first" error={errors.first_name?.message}>
          <Input id="nd-first" {...form.register("first_name")} />
        </Field>
        <Field label={t("platform.lastName")} htmlFor="nd-last" error={errors.last_name?.message}>
          <Input id="nd-last" {...form.register("last_name")} />
        </Field>
        <Field label={t("platform.email")} htmlFor="nd-email" error={errors.email?.message}>
          <Input id="nd-email" type="email" autoComplete="off" {...form.register("email")} />
        </Field>
        <Field label={t("platform.phone")} htmlFor="nd-phone" error={errors.phone?.message}>
          <Input id="nd-phone" type="tel" {...form.register("phone")} />
        </Field>
      </div>
      <p className="text-muted-foreground text-xs">{t("platform.inviteExplained")}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={isSubmitting}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : t("platform.directors.invite")}
        </Button>
      </div>
    </form>
  );
}

/** Deleting a school erases all its data: only a suspended school, and only after typing its code. */
export function DeleteSchoolDialog({ school, onClose }: { school: PlatformSchool; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === school.code;

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/platform/schools/${school.id}/delete/`, { confirm_code: typed.trim() });
      await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
      toast.success(t("platform.delete.started", { name: school.name }));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("platform.delete.title", { name: school.name })}</DialogTitle>
          <DialogDescription>
            {t("platform.delete.hint", { students: school.student_count, users: school.member_count })}
          </DialogDescription>
        </DialogHeader>
        <Field label={t("platform.delete.typeCode", { code: school.code })} htmlFor="delete-code">
          <Input
            id="delete-code"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={!matches || busy} onClick={() => void confirm()}>
            {busy ? t("platform.delete.deleting") : t("platform.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
