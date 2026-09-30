import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSchoolId } from "@/features/academics/api";
import { FINANCE_KEY } from "@/features/finance/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type { CashRegister, CashSession, CashSessionDetail } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { openPdf } from "@/lib/files";
import { formatDateTime, localeFor } from "@/lib/format";
import { errorMessage } from "@/lib/forms";

// Cash queries live under the finance key: recording a payment, an expense or a refund refreshes them too.

export function useCashRegisters() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "cash", "registers"],
    queryFn: ({ signal }) => api.get<CashRegister[]>("/cash-registers/", undefined, signal),
    enabled: schoolId !== null,
  });
}

export function useCashSessions(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "cash", "sessions", params],
    queryFn: ({ signal }) => api.get<Paginated<CashSession>>("/cash-sessions/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCashSession(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "cash", "session", id],
    queryFn: ({ signal }) => api.get<CashSessionDetail>(`/cash-sessions/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

/** Date and time in the school's time zone ("30 Sept 2026, 08:02"), or only the time. */
export function useFormatDateTime() {
  const { i18n } = useTranslation();
  const { membership } = useAuth();
  const timeZone = membership?.school.timezone;
  return {
    dateTime: (value: string | null | undefined) => formatDateTime(value, i18n.language, timeZone),
    time: (value: string) =>
      new Intl.DateTimeFormat(localeFor(i18n.language), { timeStyle: "short", timeZone }).format(new Date(value)),
  };
}

/**
 * Which open register session cash goes through. With one register open the server picks it; with several the
 * user chooses; with none, cash cannot be taken. Users who cannot see the register leave it to the server.
 */
export function useCashChoice(isCash: boolean) {
  const { can } = useAuth();
  const canSee = can("cash.view");
  const query = useCashSessions({ status: "open", page_size: 20 }, isCash && canSee);
  const sessions = query.data?.results ?? [];
  const [chosen, setChosen] = useState<number | null>(null);
  const session = sessions.length === 1 ? sessions[0].id : (sessions.find((s) => s.id === chosen)?.id ?? null);
  const known = isCash && canSee && query.isSuccess;
  return {
    isCash,
    canSee,
    query,
    sessions,
    session,
    setChosen,
    /** Cash cannot be recorded yet: no register is open, or one of several must be chosen. */
    blocked: known && session === null,
    /** Extra fields for the request. */
    payload: isCash && session !== null ? { cash_session: session } : {},
  };
}

/** Print a session's cash journal (a new tab with the PDF). */
export function printJournal(sessionId: number, t: TFunction) {
  openPdf(`/cash-sessions/${sessionId}/journal/`).catch((error) => toast.error(errorMessage(error, t)));
}
