import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { QueryError, Spinner } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import type { NotificationPreference } from "@/lib/api/types";
import { errorMessage } from "@/lib/forms";

import { NOTIFICATIONS_KEY, usePreferences } from "./api";

/** What the user wants to be told of, in the app and by email. Saved as soon as a switch is flipped. */
export function PreferencesCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = usePreferences();

  const change = async (row: NotificationPreference, field: "in_app" | "email", value: boolean) => {
    try {
      await api.patch("/notifications/preferences/", [
        { kind: row.kind, in_app: row.in_app, email: row.email, [field]: value },
      ]);
      await queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.preferences.title")}</CardTitle>
        <CardDescription>{t("notifications.preferences.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {preferences.isError ? (
          <QueryError onRetry={() => void preferences.refetch()} />
        ) : preferences.isPending ? (
          <Spinner className="mx-auto my-6 size-5" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">{t("notifications.preferences.kind")}</TableHead>
                <TableHead className="w-24 text-center">{t("notifications.preferences.inApp")}</TableHead>
                <TableHead className="w-24 pr-6 text-center">{t("notifications.preferences.email")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preferences.data.map((row) => {
                const label = t(`notifications.kinds.${row.kind}`);
                return (
                  <TableRow key={row.kind}>
                    <TableCell className="pl-6">{label}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={row.in_app}
                        aria-label={t("notifications.preferences.inAppOf", { kind: label })}
                        onCheckedChange={(value) => void change(row, "in_app", value)}
                      />
                    </TableCell>
                    <TableCell className="pr-6 text-center">
                      <Switch
                        checked={row.email}
                        aria-label={t("notifications.preferences.emailOf", { kind: label })}
                        onCheckedChange={(value) => void change(row, "email", value)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
