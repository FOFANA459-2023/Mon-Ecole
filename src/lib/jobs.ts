import { useQuery } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { Job } from "@/lib/api/types";
import { downloadFile } from "@/lib/files";

/** A background job the user started: polled every second until it is done or has failed. */
export function useJob(id: number | null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["jobs", schoolId, id],
    queryFn: ({ signal }) => api.get<Job>(`/jobs/${id}/`, undefined, signal),
    enabled: schoolId !== null && id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 1000;
    },
  });
}

export function jobPercent(job: Job | undefined): number {
  if (!job || !job.total) return job?.status === "done" ? 100 : 0;
  return Math.min(100, Math.round((100 * (job.done ?? 0)) / job.total));
}

export function downloadJobResult(job: Job): Promise<void> {
  return downloadFile(`/jobs/${job.id}/download/`, undefined, job.result_name || "download");
}
