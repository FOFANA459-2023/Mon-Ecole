import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppNotification } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useNotificationActions, useNotifications, useUnreadCount } from "./api";
import { useTimeAgo } from "./useTimeAgo";

/** The bell in the top bar: how many notifications are unread, and the latest ones. */
export function NotificationsBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount().data?.unread ?? 0;
  const latest = useNotifications({ page_size: 8 }, open);
  const { read, readAll } = useNotificationActions();
  const navigate = useNavigate();

  const go = (item: AppNotification) => {
    if (!item.read_at) read.mutate(item.id);
    setOpen(false);
    if (item.link) void navigate(item.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? t("notifications.bellUnread", { count: unread }) : t("notifications.title")}
        >
          <Bell />
          {unread > 0 && (
            <span className="bg-destructive absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => readAll.mutate()}>
              <CheckCheck /> {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <NotificationList items={latest.data?.results} loading={latest.isPending} onOpen={go} compact />
        <div className="border-t px-3 py-2 text-center">
          <Link to="/notifications" className="text-primary text-sm font-medium hover:underline" onClick={() => setOpen(false)}>
            {t("notifications.seeAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationList({
  items,
  loading,
  onOpen,
  compact = false,
}: {
  items: AppNotification[] | undefined;
  loading: boolean;
  onOpen: (item: AppNotification) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const ago = useTimeAgo();
  if (loading) return <Spinner className="mx-auto my-6 size-5" />;
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("notifications.none")}</p>;
  }
  return (
    <ul className={cn("divide-y", compact && "max-h-96 overflow-y-auto")}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className={cn("hover:bg-muted flex w-full gap-3 px-3 py-2.5 text-left", !item.read_at && "bg-primary/5")}
          >
            <span
              aria-hidden
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-primary")}
            />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm", !item.read_at && "font-semibold")}>{item.title}</span>
              {item.body && (
                <span className={cn("text-muted-foreground block text-xs", compact && "line-clamp-2")}>{item.body}</span>
              )}
              <span className="text-muted-foreground block text-[11px]">
                {ago(item.created_at)}
                {!item.read_at && <span className="sr-only"> · {t("notifications.unread")}</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
