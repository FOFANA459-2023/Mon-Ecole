import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type {
  FeeCategory,
  FeeSchedule,
  Invoice,
  InvoiceListItem,
  Expense,
  ExpenseCategory,
  Payment,
  PaymentListItem,
  PaymentMethod,
  Refund,
  StudentAccount,
  StudentDiscount,
} from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { formatMoney } from "@/lib/format";

/** Every finance query key starts with "finance", so one invalidation refreshes balances everywhere. */
export const FINANCE_KEY = "finance";

export function useFeeCategories() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "categories"],
    queryFn: ({ signal }) => api.get<FeeCategory[]>("/fee-categories/", undefined, signal),
    enabled: schoolId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useFeeSchedules(yearId: number | null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "schedules", yearId],
    queryFn: ({ signal }) => api.get<FeeSchedule[]>("/fee-schedules/", { academic_year: yearId }, signal),
    enabled: schoolId !== null && yearId !== null,
  });
}

export function useStudentDiscounts(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "discounts", params],
    queryFn: ({ signal }) => api.get<Paginated<StudentDiscount>>("/student-discounts/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInvoices(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "invoices", params],
    queryFn: ({ signal }) => api.get<Paginated<InvoiceListItem>>("/invoices/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "invoice", id],
    queryFn: ({ signal }) => api.get<Invoice>(`/invoices/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function usePayments(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "payments", params],
    queryFn: ({ signal }) => api.get<Paginated<PaymentListItem>>("/payments/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePayment(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "payment", id],
    queryFn: ({ signal }) => api.get<Payment>(`/payments/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

/** What a student owes, their credit and their unpaid invoice lines (for the payment form). */
export function useStudentAccount(studentId: number | null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "account", studentId],
    queryFn: ({ signal }) => api.get<StudentAccount>(`/student-accounts/${studentId}/`, undefined, signal),
    enabled: schoolId !== null && studentId !== null,
  });
}

export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "mobile_money", "bank_transfer", "cheque", "card", "other"];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "salaries",
  "rent",
  "utilities",
  "supplies",
  "maintenance",
  "transport",
  "food",
  "events",
  "taxes",
  "other",
];

export function useExpenses(params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "expenses", params],
    queryFn: ({ signal }) => api.get<Paginated<Expense>>("/expenses/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useRefunds(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [FINANCE_KEY, schoolId, "refunds", params],
    queryFn: ({ signal }) => api.get<Paginated<Refund>>("/refunds/", params, signal),
    enabled: schoolId !== null && enabled,
  });
}

/** Formats amounts in the current school's currency and the interface language. */
export function useMoney() {
  const { membership } = useAuth();
  const { i18n } = useTranslation();
  const currency = membership?.school.currency ?? "GNF";
  return {
    currency,
    format: (amount: number | string | null | undefined) => formatMoney(amount ?? 0, currency, i18n.language),
  };
}

/** "10 %" or "50 000 GNF". */
export function useDiscountLabel() {
  const money = useMoney();
  return (d: StudentDiscount) => (d.kind === "percent" ? `${Number(d.value)} %` : money.format(d.value));
}
