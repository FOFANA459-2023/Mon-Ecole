import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, Field, Pagination, QueryError, Spinner } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormatDateTime } from "@/features/cash/api";
import { useRoles } from "@/features/settings/api";
import { api } from "@/lib/api/client";
import type { Announcement, AnnouncementPriority } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";
import { useUrlState } from "@/lib/useUrlState";

import { ADMIN_KEY, isoDate, useAnnouncements } from "./api";

const PAGE_SIZE = 25;
const DEFAULTS = { page: "1" };

/** "2026-10-14T08:30" for a datetime-local input, in the browser's time. */
function toLocalInput(value: string | undefined): string {
  const day = value ? new Date(value) : new Date();
  return `${isoDate(day)}T${String(day.getHours()).padStart(2, "0")}:${String(day.getMinutes()).padStart(2, "0")}`;
}

/** Announcements: managers write them for everyone or some roles; everyone reads those meant for them. */
export function AnnouncementsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manager = can("administration.manage");
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const page = Math.max(1, Number(filters.page) || 1);
  const announcements = useAnnouncements({ page, ...(manager && { manage: "1" }) });
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const queryClient = useQueryClient();

  return (
    <div className="grid gap-4">
      {manager && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus /> {t("administration.announcements.new")}
          </Button>
        </div>
      )}
      {announcements.isError ? (
        <QueryError error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : announcements.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : announcements.data.results.length === 0 ? (
        <Card>
          <EmptyState icon={<Megaphone className="size-8" />} title={t("administration.announcements.none")} />
        </Card>
      ) : (
        <>
          {announcements.data.results.map((item) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              manager={manager}
              onEdit={() => setEditing(item)}
              onDelete={() => setDeleting(item)}
            />
          ))}
          {announcements.data.count > PAGE_SIZE && (
            <Card className="py-0">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={announcements.data.count}
                onPageChange={(next) => setFilters({ page: String(next) })}
              />
            </Card>
          )}
        </>
      )}
      {editing && <AnnouncementDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("administration.announcements.deleteTitle")}
          description={t("administration.announcements.deleteHint", { title: deleting.title })}
          confirmLabel={t("common.delete")}
          onConfirm={async () => {
            try {
              await api.delete(`/announcements/${deleting.id}/`);
              await queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
              toast.success(t("common.deleted"));
            } catch (error) {
              toast.error(errorMessage(error, t));
            }
          }}
        />
      )}
    </div>
  );
}

export function AnnouncementCard({
  item,
  manager = false,
  onEdit,
  onDelete,
}: {
  item: Announcement;
  manager?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { dateTime } = useFormatDateTime();
  return (
    <Card className={item.priority === "important" ? "border-destructive/40" : undefined}>
      <CardContent className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold">
              {item.pinned && <Pin className="text-primary size-4" aria-label={t("administration.announcements.pinned")} />}
              {item.title}
            </h3>
            <p className="text-muted-foreground text-xs">
              {dateTime(item.publish_at)}
              {item.author_name && ` · ${item.author_name}`}
              {" · "}
              {item.role_names.length ? item.role_names.join(", ") : t("administration.announcements.everyone")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.priority === "important" && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-transparent">
                {t("administration.announcements.important")}
              </Badge>
            )}
            {manager && !item.is_published && (
              <Badge variant="outline">{t("administration.announcements.notShown")}</Badge>
            )}
            {manager && onEdit && (
              <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={onEdit}>
                <Pencil />
              </Button>
            )}
            {manager && onDelete && (
              <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={onDelete}>
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm whitespace-pre-line">{item.body}</p>
      </CardContent>
    </Card>
  );
}

function AnnouncementDialog({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const roles = (useRoles().data ?? []).filter((r) => r.key !== "parent");
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t("validation.required")).max(150),
        body: z.string().trim().min(1, t("validation.required")).max(5000),
        priority: z.enum(["normal", "important"]),
        roles: z.array(z.number()),
        publish_at: z.string().min(1, t("validation.required")),
        expires_on: z.string(),
        pinned: z.boolean(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: item?.title ?? "",
      body: item?.body ?? "",
      priority: item?.priority ?? "normal",
      roles: item?.roles ?? [],
      publish_at: toLocalInput(item?.publish_at),
      expires_on: item?.expires_on ?? "",
      pinned: item?.pinned ?? false,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      ...values,
      publish_at: new Date(values.publish_at).toISOString(),
      expires_on: values.expires_on || null,
    };
    try {
      if (item) await api.patch(`/announcements/${item.id}/`, body);
      else await api.post("/announcements/", body);
      await queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
      toast.success(t("common.saved"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, Object.keys(schema.shape), t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? t("administration.announcements.edit") : t("administration.announcements.new")}</DialogTitle>
          <DialogDescription>{t("administration.announcements.hint")}</DialogDescription>
        </DialogHeader>
        <form id="announcement-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("administration.announcements.titleLabel")} htmlFor="an-title" error={errors.title?.message}>
            <Input id="an-title" maxLength={150} {...form.register("title")} />
          </Field>
          <Field label={t("administration.announcements.body")} htmlFor="an-body" error={errors.body?.message}>
            <Textarea id="an-body" rows={5} maxLength={5000} {...form.register("body")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("administration.announcements.priority")} htmlFor="an-priority">
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <OptionSelect<AnnouncementPriority>
                    id="an-priority"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={(["normal", "important"] as const).map((p) => ({
                      value: p,
                      label: t(`administration.announcements.priorities.${p}`),
                    }))}
                  />
                )}
              />
            </Field>
            <div className="flex items-center gap-2 self-end pb-2">
              <Controller
                control={form.control}
                name="pinned"
                render={({ field }) => <Switch id="an-pinned" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <Label htmlFor="an-pinned">{t("administration.announcements.pin")}</Label>
            </div>
            <Field
              label={t("administration.announcements.publishAt")}
              htmlFor="an-publish"
              error={errors.publish_at?.message}
            >
              <Input id="an-publish" type="datetime-local" {...form.register("publish_at")} />
            </Field>
            <Field
              label={t("administration.announcements.expiresOn")}
              htmlFor="an-expires"
              error={errors.expires_on?.message}
              hint={t("administration.announcements.expiresHint")}
            >
              <Input id="an-expires" type="date" {...form.register("expires_on")} />
            </Field>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("administration.announcements.audience")}</legend>
            <p className="text-muted-foreground text-xs">{t("administration.announcements.audienceHint")}</p>
            <Controller
              control={form.control}
              name="roles"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(role.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? [...field.value, role.id] : field.value.filter((id) => id !== role.id))
                        }
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              )}
            />
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="announcement-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
