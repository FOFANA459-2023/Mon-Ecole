import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type Paginated, type Query } from "@/lib/api/client";
import type { AuditLogEntry, Member, PermissionGroup, Role, School } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";

function useSchoolId(): number | null {
  return useAuth().membership?.school.id ?? null;
}

export const keys = {
  school: (schoolId: number | null) => ["school", schoolId] as const,
  roles: (schoolId: number | null) => ["roles", schoolId] as const,
  permissions: (schoolId: number | null) => ["permissions", schoolId] as const,
  members: (schoolId: number | null, params?: Query) => ["members", schoolId, params ?? {}] as const,
  audit: (schoolId: number | null, params?: Query) => ["audit", schoolId, params ?? {}] as const,
};

export function useSchool() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: keys.school(schoolId),
    queryFn: ({ signal }) => api.get<School>("/school/", undefined, signal),
    enabled: schoolId !== null,
  });
}

export function useRoles() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: keys.roles(schoolId),
    queryFn: ({ signal }) => api.get<Role[]>("/roles/", undefined, signal),
    enabled: schoolId !== null,
  });
}

export function usePermissionGroups() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: keys.permissions(schoolId),
    queryFn: ({ signal }) => api.get<PermissionGroup[]>("/permissions/", undefined, signal),
    enabled: schoolId !== null,
    staleTime: Infinity,
  });
}

export function useMembers(params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: keys.members(schoolId, params),
    queryFn: ({ signal }) => api.get<Paginated<Member>>("/users/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useAuditLogs(params: Query) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: keys.audit(schoolId, params),
    queryFn: ({ signal }) => api.get<Paginated<AuditLogEntry>>("/audit-logs/", params, signal),
    enabled: schoolId !== null,
    placeholderData: keepPreviousData,
  });
}
