import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type { Announcement, CalendarEvent, CalendarEventKind, Department } from "@/lib/api/types";

/** Every administration query key starts with "administration", so one invalidation refreshes them all. */
export const ADMIN_KEY = "administration";

export const EVENT_KINDS: CalendarEventKind[] = ["exam", "holiday", "meeting", "event", "deadline"];

/** Badge colours of the calendar's kinds of event. */
export const KIND_STYLES: Record<CalendarEventKind, string> = {
  exam: "bg-destructive/10 text-destructive",
  holiday: "bg-success/15 text-success",
  meeting: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  event: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  deadline: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export function useDepartments(enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ADMIN_KEY, schoolId, "departments"],
    queryFn: ({ signal }) => api.get<Department[]>("/departments/", undefined, signal),
    enabled: schoolId !== null && enabled,
    staleTime: 60_000,
  });
}

export function useAnnouncements(params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ADMIN_KEY, schoolId, "announcements", params],
    queryFn: ({ signal }) => api.get<Paginated<Announcement>>("/announcements/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useCalendarEvents(params: { date_from?: string; date_to?: string; kind?: string; level?: number }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ADMIN_KEY, schoolId, "events", params],
    queryFn: ({ signal }) => api.get<CalendarEvent[]>("/calendar-events/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

/** YYYY-MM-DD of a local date. */
export function isoDate(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** First and last day (YYYY-MM-DD) of the month of "YYYY-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const [year, index] = month.split("-").map(Number);
  return { from: isoDate(new Date(year, index - 1, 1)), to: isoDate(new Date(year, index, 0)) };
}

export function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  const day = new Date(year, index - 1 + by, 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
}
