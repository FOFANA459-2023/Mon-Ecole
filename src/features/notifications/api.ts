import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type { AppNotification, NotificationPreference } from "@/lib/api/types";

export const NOTIFICATIONS_KEY = "notifications";

/** How many unread notifications the user has in this school, checked every minute. */
export function useUnreadCount() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, schoolId, "unread"],
    queryFn: ({ signal }) => api.get<{ unread: number }>("/notifications/unread-count/", undefined, signal),
    enabled: schoolId !== null,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useNotifications(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, schoolId, "list", params],
    queryFn: ({ signal }) => api.get<Paginated<AppNotification>>("/notifications/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
  const read = useMutation({ mutationFn: (id: number) => api.post(`/notifications/${id}/read/`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post("/notifications/read-all/"), onSuccess: refresh });
  return { read, readAll };
}

export function usePreferences() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, schoolId, "preferences"],
    queryFn: ({ signal }) => api.get<NotificationPreference[]>("/notifications/preferences/", undefined, signal),
    enabled: schoolId !== null,
  });
}
