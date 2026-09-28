import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated, type Query } from "@/lib/api/client";
import type { Enrollment } from "@/lib/api/types";

export function useEnrollments(params: Query, enabled = true) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["enrollments", schoolId, params],
    queryFn: ({ signal }) => api.get<Paginated<Enrollment>>("/enrollments/", params, signal),
    enabled: schoolId !== null && enabled,
    placeholderData: keepPreviousData,
  });
}

/** Anything that changes who sits in which class affects these lists and counts. */
export async function invalidateSchooling(queryClient: QueryClient) {
  await Promise.all(
    ["enrollments", "students", "classes", "dashboard", "guardians"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
