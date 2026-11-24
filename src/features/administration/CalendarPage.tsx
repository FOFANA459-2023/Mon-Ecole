import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, Field, QueryError, Spinner } from "@/components/common";
import { OptionSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLevels } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { CalendarEvent, CalendarEventKind } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { localeFor } from "@/lib/format";
import { applyApiErrors, errorMessage } from "@/lib/forms";
import { useUrlState } from "@/lib/useUrlState";
import { cn } from "@/lib/utils";

import { ADMIN_KEY, EVENT_KINDS, isoDate, KIND_STYLES, monthRange, shiftMonth, useCalendarEvents } from "./api";

const thisMonth = () => isoDate(new Date()).slice(0, 7);

/** The school calendar, month by month: exams, holidays, meetings, events and deadlines. */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const manager = can("administration.manage");
  const formatDate = useFormatDate();
  const [filters, setFilters] = useUrlState({ month: "", kind: "" });
  const month = /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : thisMonth();
  const range = monthRange(month);
  const kind = (EVENT_KINDS.includes(filters.kind as CalendarEventKind) ? filters.kind : "") as CalendarEventKind | "";
  const events = useCalendarEvents({ date_from: range.from, date_to: range.to, ...(kind && { kind }) });
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const queryClient = useQueryClient();
  const [year, index] = month.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat(localeFor(i18n.language), { month: "long", year: "numeric" }).format(
    new Date(year, index - 1, 1),
  );

  const when = (event: CalendarEvent) => {
    const days =
      event.start_date === event.end_date
        ? formatDate(event.start_date)
        : t("administration.calendar.range", { from: formatDate(event.start_date), to: formatDate(event.end_date) });
    const hours = [event.start_time, event.end_time].filter(Boolean).map((h) => String(h).slice(0, 5));
    return hours.length ? `${days} · ${hours.join(" – ")}` : days;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("administration.calendar.previous")}
            onClick={() => setFilters({ month: shiftMonth(month, -1) })}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize" aria-live="polite">
            {monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("administration.calendar.next")}
            onClick={() => setFilters({ month: shiftMonth(month, 1) })}
          >
            <ChevronRight />
          </Button>
          {month !== thisMonth() && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({ month: "" })}>
              {t("administration.calendar.today")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <OptionSelect<CalendarEventKind>
              aria-label={t("administration.calendar.kind")}
              value={kind || null}
              onChange={(v) => setFilters({ kind: v ?? "" })}
              allLabel={t("administration.calendar.allKinds")}
              options={EVENT_KINDS.map((k) => ({ value: k, label: t(`administration.calendar.kinds.${k}`) }))}
            />
          </div>
          {manager && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> {t("administration.calendar.new")}
            </Button>
          )}
        </div>
      </div>

      {events.isError ? (
        <QueryError error={events.error} onRetry={() => void events.refetch()} />
      ) : events.isPending ? (
        <Spinner className="mx-auto my-10 size-6" />
      ) : events.data.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays className="size-8" />} title={t("administration.calendar.none")} />
        </Card>
      ) : (
        <Card className="gap-0 divide-y py-0">
          {events.data.map((event) => (
            <div key={event.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("border-transparent", KIND_STYLES[event.kind ?? "event"])}>
                    {t(`administration.calendar.kinds.${event.kind ?? "event"}`)}
                  </Badge>
                  <span className="font-medium">{event.title}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {when(event)}
                  {event.location && ` · ${event.location}`}
                  {" · "}
                  {event.level_names.length ? event.level_names.join(", ") : t("administration.calendar.wholeSchool")}
                </p>
                {event.description && <p className="mt-1 text-sm whitespace-pre-line">{event.description}</p>}
              </div>
              {manager && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(event)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => setDeleting(event)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {editing && (
        <EventDialog
          event={editing === "new" ? null : editing}
          defaultDate={month === thisMonth() ? isoDate(new Date()) : range.from}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("administration.calendar.deleteTitle")}
          description={t("administration.calendar.deleteHint", { title: deleting.title })}
          confirmLabel={t("common.delete")}
          onConfirm={async () => {
            try {
              await api.delete(`/calendar-events/${deleting.id}/`);
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

function EventDialog({
  event,
  defaultDate,
  onClose,
}: {
  event: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const levels = (useLevels().data ?? []).filter((l) => l.is_active);
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t("validation.required")).max(150),
        kind: z.enum(["exam", "holiday", "meeting", "event", "deadline"]),
        start_date: z.string().min(1, t("validation.required")),
        end_date: z.string(),
        start_time: z.string(),
        end_time: z.string(),
        location: z.string().trim().max(150),
        description: z.string().trim().max(2000),
        levels: z.array(z.number()),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: event?.title ?? "",
      kind: event?.kind ?? "event",
      start_date: event?.start_date ?? defaultDate,
      end_date: event?.end_date ?? "",
      start_time: event?.start_time?.slice(0, 5) ?? "",
      end_time: event?.end_time?.slice(0, 5) ?? "",
      location: event?.location ?? "",
      description: event?.description ?? "",
      levels: event?.levels ?? [],
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      ...values,
      end_date: values.end_date || values.start_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
    };
    try {
      if (event) await api.patch(`/calendar-events/${event.id}/`, body);
      else await api.post("/calendar-events/", body);
      await queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
          <DialogTitle>{event ? t("administration.calendar.edit") : t("administration.calendar.new")}</DialogTitle>
          <DialogDescription>{t("administration.calendar.hint")}</DialogDescription>
        </DialogHeader>
        <form id="event-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label={t("administration.calendar.titleLabel")} htmlFor="ev-title" error={errors.title?.message} className="sm:col-span-2">
            <Input id="ev-title" maxLength={150} {...form.register("title")} />
          </Field>
          <Field label={t("administration.calendar.kind")} htmlFor="ev-kind">
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <OptionSelect<CalendarEventKind>
                  id="ev-kind"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  options={EVENT_KINDS.map((k) => ({ value: k, label: t(`administration.calendar.kinds.${k}`) }))}
                />
              )}
            />
          </Field>
          <Field label={t("administration.calendar.location")} htmlFor="ev-location" error={errors.location?.message}>
            <Input id="ev-location" maxLength={150} {...form.register("location")} />
          </Field>
          <Field label={t("administration.calendar.startDate")} htmlFor="ev-start" error={errors.start_date?.message}>
            <Input id="ev-start" type="date" {...form.register("start_date")} />
          </Field>
          <Field
            label={t("administration.calendar.endDate")}
            htmlFor="ev-end"
            error={errors.end_date?.message}
            hint={t("administration.calendar.endHint")}
          >
            <Input id="ev-end" type="date" {...form.register("end_date")} />
          </Field>
          <Field label={t("administration.calendar.startTime")} htmlFor="ev-start-time">
            <Input id="ev-start-time" type="time" {...form.register("start_time")} />
          </Field>
          <Field label={t("administration.calendar.endTime")} htmlFor="ev-end-time" error={errors.end_time?.message}>
            <Input id="ev-end-time" type="time" {...form.register("end_time")} />
          </Field>
          <Field
            label={t("administration.calendar.description")}
            htmlFor="ev-description"
            error={errors.description?.message}
            className="sm:col-span-2"
          >
            <Textarea id="ev-description" rows={3} maxLength={2000} {...form.register("description")} />
          </Field>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">{t("administration.calendar.levels")}</legend>
            <p className="text-muted-foreground text-xs">{t("administration.calendar.levelsHint")}</p>
            <Controller
              control={form.control}
              name="levels"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-3">
                  {levels.map((level) => (
                    <label key={level.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(level.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? [...field.value, level.id] : field.value.filter((id) => id !== level.id))
                        }
                      />
                      {level.name}
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
          <Button type="submit" form="event-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
