import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAcademicYears, useCurrentYear, useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type {
  AcademicYear,
  ClassResults,
  ReportCommentRow,
  StudentResults,
  Gradebook,
  GradebookDetail,
  GradebookSheet,
  GradingScale,
  Term,
} from "@/lib/api/types";
import { openPdf } from "@/lib/files";
import { localeFor } from "@/lib/format";

/** Every grades query key starts with "grades", so one invalidation refreshes marks, ranks and results. */
export const GRADES_KEY = "grades";

export function useGradebooks(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "gradebooks", params],
    queryFn: ({ signal }) => api.get<Paginated<Gradebook>>("/gradebooks/", params, signal),
    enabled: schoolId !== null && enabled && Boolean(params.term),
    placeholderData: keepPreviousData,
  });
}

export function useGradebook(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "gradebook", id],
    queryFn: ({ signal }) => api.get<GradebookDetail>(`/gradebooks/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function useGradebookSheet(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "sheet", id],
    queryFn: ({ signal }) => api.get<GradebookSheet>(`/gradebooks/${id}/sheet/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function useClassResults(classId: number | null, termId: number | null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "class-results", classId, termId],
    queryFn: ({ signal }) =>
      api.get<ClassResults>("/class-results/", { class_group: classId, term: termId }, signal),
    enabled: schoolId !== null && classId !== null && termId !== null,
    retry: false,
  });
}

export function useGradingScales() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "scales"],
    queryFn: ({ signal }) => api.get<GradingScale[]>("/grading-scales/", undefined, signal),
    enabled: schoolId !== null,
    staleTime: 5 * 60_000,
  });
}

/** The term running today, else the next one to start, else the last one. */
export function defaultTerm(terms: Term[], today = new Date().toISOString().slice(0, 10)): Term | null {
  if (terms.length === 0) return null;
  return (
    terms.find((term) => term.start_date <= today && today <= term.end_date) ??
    terms.find((term) => term.start_date > today) ??
    terms[terms.length - 1]
  );
}

/** The term chosen in the URL, or today's term of the current year. */
export function useChosenTerm(raw: string): number | null {
  const currentYear = useCurrentYear();
  if (raw) return Number(raw);
  return defaultTerm(currentYear?.terms ?? [])?.id ?? null;
}

/** Every term of every year, newest year first, with the year's name for labels. */
export function useAllTerms(): { terms: (Term & { yearName: string })[]; years: AcademicYear[] } {
  const years = useAcademicYears().data ?? [];
  return {
    years,
    terms: years.flatMap((year) => year.terms.map((term) => ({ ...term, yearName: year.name }))),
  };
}

/** Marks in the interface language with the school's number of decimals ("14,50" in French). */
export function useFormatMark() {
  const { i18n } = useTranslation();
  return (value: string | number | null | undefined, decimals = 2) => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat(localeFor(i18n.language), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(value));
  };
}

/** A score as stored ("12.50") shown without needless zeros ("12.5"). */
export function plainScore(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(Number(value));
}

/** "/20" style suffix for a maximum score. */
export function outOf(max: string | number): string {
  return `/${Number(max)}`;
}

export function useStudentResults(studentId: number) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "student-results", studentId],
    queryFn: ({ signal }) => api.get<StudentResults>(`/student-results/${studentId}/`, undefined, signal),
    enabled: schoolId !== null,
    retry: false,
  });
}

/** The report-card comments of a class, for a term or (term null) the year. */
export function useReportComments(classId: number, termId: number | null, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [GRADES_KEY, schoolId, "report-comments", classId, termId],
    queryFn: ({ signal }) =>
      api.get<ReportCommentRow[]>("/report-comments/", { class_group: classId, term: termId ?? undefined }, signal),
    enabled: schoolId !== null && enabled,
  });
}

/** Open report cards as a PDF: a class or one student; a term, or the year when `term` is null. */
export function openReportCards(params: { class_group: number; term: number | null; enrollment?: number }) {
  return openPdf("/report-cards/", { ...params, term: params.term ?? undefined });
}
