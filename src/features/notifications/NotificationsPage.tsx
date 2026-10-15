import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { PageHeader, Pagination, QueryError } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AppNotification } from "@/lib/api/types";
import { useUrlState } from "@/lib/useUrlState";

import { useNotificationActions, useNotifications, useUnreadCount } from "./api";
import { NotificationList } from "./NotificationsBell";

const PAGE_SIZE = 25;

/** Every notification of the user in this school, newest first. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useUrlState({ unread: "", page: "1" });
  const page = Math.max(1, Number(filters.page) || 1);
  const list = useNotifications({ page, page_size: PAGE_SIZE, ...(filters.unread && { unread: "1" }) });
  const unread = useUnreadCount().data?.unread ?? 0;
  const { read, readAll } = useNotificationActions();
  const navigate = useNavigate();

  const open = (item: AppNotification) => {
    if (!item.read_at) read.mutate(item.id);
    if (item.link) void navigate(item.link);
  };

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.subtitle")}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={() => readAll.mutate()}>
              <CheckCheck /> {t("notifications.markAllRead")}
            </Button>
          )
        }
      />
      <div className="mb-4 flex gap-2" role="group" aria-label={t("notifications.show")}>
        <Button size="sm" variant={filters.unread ? "outline" : "default"} onClick={() => setFilters({ unread: "", page: "1" })}>
          {t("notifications.all")}
        </Button>
        <Button size="sm" variant={filters.unread ? "default" : "outline"} onClick={() => setFilters({ unread: "1", page: "1" })}>
          {t("notifications.unreadOnly", { count: unread })}
        </Button>
      </div>
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <NotificationList items={list.data?.results} loading={list.isPending} onOpen={open} />
          {list.data && list.data.count > PAGE_SIZE && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              count={list.data.count}
              onPageChange={(next) => setFilters({ page: String(next) })}
            />
          )}
        </Card>
      )}
    </>
  );
}
