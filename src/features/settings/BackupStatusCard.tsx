import { useQuery } from "@tanstack/react-query";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSchoolId } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { BackupStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { formatDateTime } from "@/lib/format";

/** When the platform's data was last backed up (the backups themselves are the platform owner's). */
export function BackupStatusCard() {
  const { t, i18n } = useTranslation();
  const { membership } = useAuth();
  const schoolId = useSchoolId();
  const status = useQuery({
    queryKey: ["backup-status", schoolId],
    queryFn: ({ signal }) => api.get<BackupStatus>("/backup-status/", undefined, signal),
    enabled: schoolId !== null,
  });
  const data = status.data;
  const failing = data?.last_status === "failed";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.school.backups")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {data && (
          <>
            <p className="flex items-start gap-2">
              {data.last_success_at && !failing ? (
                <CircleCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {data.last_success_at
                ? t("settings.school.lastBackup", {
                    when: formatDateTime(data.last_success_at, i18n.language, membership?.school.timezone),
                  })
                : t("settings.school.noBackup")}
            </p>
            {failing && <p className="text-destructive">{t("settings.school.backupFailing")}</p>}
            <p className="text-muted-foreground text-xs">
              {t("settings.school.backupPolicy", { hours: data.every_hours, days: data.keep_days })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
