import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type Paginated, type Query } from "@/lib/api/client";
import type { AcademicYear, ClassGroup, ClassSubject, Level, Subject } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";

export function useSchoolId(): number | null {
  return useAuth().membership?.school.id ?? null;
}

export function useAcademicYears() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["academic-years", schoolId],
    queryFn: ({ signal }) => api.get<AcademicYear[]>("/academic-years/", undefined, signal),
    enabled: schoolId !== null,
    staleTime: 5 * 60_000,
  });
}

/** The school's current academic year (or the most recent one when none is marked current). */
export function useCurrentYear(): AcademicYear | null {
  const years = useAcademicYears().data ?? [];
  return years.find((y) => y.is_current) ?? years[0] ?? null;
}

export function useLevels() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["levels", schoolId],
    queryFn: ({ signal }) => api.get<Level[]>("/levels/", undefined, signal),
    enabled: schoolId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useClasses(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["classes", schoolId, params],
    queryFn: ({ signal }) => api.get<Paginated<ClassGroup>>("/classes/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

/** Every class of one academic year, for pickers. */
export function useYearClasses(yearId: number | null | undefined) {
  const query = useClasses({ academic_year: yearId ?? undefined, page_size: 100, status: "active" }, Boolean(yearId));
  return { ...query, classes: query.data?.results ?? [] };
}

export function useClass(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["classes", schoolId, "detail", id],
    queryFn: ({ signal }) => api.get<ClassGroup>(`/classes/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function useSubjects(params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["subjects", schoolId, params],
    queryFn: ({ signal }) => api.get<Paginated<Subject>>("/subjects/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useClassSubjects(classId: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["class-subjects", schoolId, classId],
    queryFn: ({ signal }) => api.get<ClassSubject[]>("/class-subjects/", { class_group: classId }, signal),
    enabled: schoolId !== null && classId !== undefined,
  });
}
