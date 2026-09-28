import { useQueryClient } from "@tanstack/react-query";
import { MailPlus, MoreHorizontal, Pencil, Plus, Search, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import type { Member } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { formatDateTime, initials } from "@/lib/format";
import { errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useMembers } from "./api";
import { UserFormDialog } from "./UserFormDialog";

const PAGE_SIZE = 25;

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser, membership } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "true" | "false">("all");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; member?: Member }>({ open: false });
  const [toDeactivate, setToDeactivate] = useState<Member | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const members = useMembers({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    is_active: status === "all" ? undefined : status,
    ordering: "user__last_name",
  });

  const setActive = async (member: Member, isActive: boolean) => {
    try {
      await api.patch(`/users/${member.id}/`, { is_active: isActive });
      toast.success(isActive ? t("settings.users.reactivated") : t("settings.users.deactivated"));
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  const resendInvite = async (member: Member) => {
    try {
      await api.post(`/users/${member.id}/send-invite/`);
      toast.success(t("settings.users.inviteSent"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("common.search")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label={t("settings.users.filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="true">{t("common.active")}</SelectItem>
            <SelectItem value="false">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialog({ open: true })}>
          <Plus /> {t("settings.users.add")}
        </Button>
      </div>

      {members.isError ? (
        <QueryError onRetry={() => void members.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {members.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : members.data.results.length === 0 ? (
            <EmptyState title={t("settings.users.empty")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.users.name")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("settings.users.roles")}</TableHead>
                    <TableHead>{t("settings.users.status")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("settings.users.lastLogin")}</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.data.results.map((member) => {
                    const isSelf = member.user.id === currentUser?.id;
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">{initials(member.user.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{member.user.full_name}</p>
                              <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {member.roles.map((role) => (
                              <Badge key={role.id} variant="secondary">
                                {role.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!member.is_active ? (
                            <Badge variant="outline">{t("common.inactive")}</Badge>
                          ) : !member.user.has_password ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {t("settings.users.invitePending")}
                            </Badge>
                          ) : (
                            <Badge className="bg-success/15 text-success border-transparent">{t("common.active")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                          {member.user.last_login
                            ? formatDateTime(member.user.last_login, i18n.language, membership?.school.timezone)
                            : t("common.never")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ open: true, member })}>
                                <Pencil /> {t("common.edit")}
                              </DropdownMenuItem>
                              {member.is_active && !member.user.has_password && (
                                <DropdownMenuItem onSelect={() => void resendInvite(member)}>
                                  <MailPlus /> {t("settings.users.resendInvite")}
                                </DropdownMenuItem>
                              )}
                              {!isSelf && <DropdownMenuSeparator />}
                              {!isSelf &&
                                (member.is_active ? (
                                  <DropdownMenuItem variant="destructive" onSelect={() => setToDeactivate(member)}>
                                    <UserX /> {t("settings.users.deactivate")}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => void setActive(member, true)}>
                                    <UserCheck /> {t("settings.users.reactivate")}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} count={members.data.count} onPageChange={setPage} />
            </>
          )}
        </Card>
      )}

      <UserFormDialog
        key={dialog.member?.id ?? "new"}
        open={dialog.open}
        member={dialog.member}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
        title={t("settings.users.deactivate")}
        description={t("settings.users.confirmDeactivate", { name: toDeactivate?.user.full_name ?? "" })}
        confirmLabel={t("settings.users.deactivate")}
        destructive
        onConfirm={() => (toDeactivate ? setActive(toDeactivate, false) : undefined)}
      />
    </>
  );
}
