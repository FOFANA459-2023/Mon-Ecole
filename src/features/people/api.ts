import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type {
  Guardian,
  GuardianLink,
  SchoolDocument,
  Staff,
  Student,
  StudentListItem,
} from "@/lib/api/types";

export function useStudents(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["students", schoolId, params],
    queryFn: ({ signal }) => api.get<Paginated<StudentListItem>>("/students/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useStudent(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["students", schoolId, "detail", id],
    queryFn: ({ signal }) => api.get<Student>(`/students/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function useGuardianLinks(studentId: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["students", schoolId, "guardians", studentId],
    queryFn: ({ signal }) => api.get<GuardianLink[]>(`/students/${studentId}/guardians/`, undefined, signal),
    enabled: schoolId !== null && studentId !== undefined,
  });
}

export function useGuardianSearch(search: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["guardians", schoolId, search],
    queryFn: ({ signal }) => api.get<Paginated<Guardian>>("/guardians/", { search, page_size: 8 }, signal),
    enabled: schoolId !== null && search.trim().length >= 2,
  });
}

export function useStaffList(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["staff", schoolId, params],
    queryFn: ({ signal }) => api.get<Paginated<Staff>>("/staff/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

/** Active teachers, for class-teacher and subject-teacher pickers. */
export function useTeacherOptions(enabled = true) {
  const query = useStaffList({ status: "active", staff_type: "teacher", page_size: 100 }, enabled);
  return { ...query, teachers: query.data?.results ?? [] };
}

export function useStaffMember(id: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["staff", schoolId, "detail", id],
    queryFn: ({ signal }) => api.get<Staff>(`/staff/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== undefined,
  });
}

export function useDocuments(ownerType: "student" | "staff", ownerId: number | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["documents", schoolId, ownerType, ownerId],
    queryFn: ({ signal }) =>
      api.get<SchoolDocument[]>("/documents/", { owner_type: ownerType, owner_id: ownerId }, signal),
    enabled: schoolId !== null && ownerId !== undefined,
  });
}
