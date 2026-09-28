import { ArrowRightLeft, Ban, ClipboardList, FileText, LogOut, MoreHorizontal, RefreshCcw, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { PersonAvatar, SearchInput, StatusBadge } from "@/components/display";
import { useFormatDate } from "@/lib/dates";
import { ClassSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import { useAuth } from "@/lib/auth/context";
import { openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { useEnrollments } from "./api";
import { EnrollmentActionDialog, type EnrollmentAction, type EnrollmentRef } from "./EnrollmentActionDialogs";

const DEFAULTS = { year: "", class: "", status: "active", q: "", page: "1" };
const PAGE_SIZE = 25;
const STATUSES = ["active", "class_changed", "withdrawn", "completed", "cancelled"] as const;

export function EnrollmentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [action, setAction] = useState<{ kind: EnrollmentAction; ref: EnrollmentRef } | null>(null);
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const enrollments = useEnrollments(
    {
      academic_year: yearId ?? undefined,
      class_group: filters.class,
      status: filters.status === "all" ? undefined : filters.status,
      search,
      page,
      page_size: PAGE_SIZE,
    },
    yearId !== null,
  );

  return (
    <>
      <PageHeader
        title={t("enrollments.title")}
        description={t("enrollments.subtitle")}
        actions={
          can("enrollments.create") && (
            <>
              <Button variant="outline" asChild>
                <Link to="/enrollments/promote">
                  <RefreshCcw /> {t("enrollments.promote")}
                </Link>
              </Button>
              {can("students.create") && (
                <Button asChild>
                  <Link to="/enrollments/new">
                    <UserPlus /> {t("enrollments.new")}
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[11rem_12rem_12rem_1fr]">
        <YearSelect
          value={yearId}
          onChange={(v) => setFilters({ year: v ? String(v) : "", class: "" })}
          aria-label={t("classes.year")}
        />
        <ClassSelect
          yearId={yearId}
          value={toNumberOrNull(filters.class)}
          onChange={(v) => setFilters({ class: v ? String(v) : "" })}
          allLabel={t("classes.allClasses")}
          aria-label={t("enrollments.class")}
        />
        <OptionSelect
          value={filters.status === "all" ? null : (filters.status as (typeof STATUSES)[number])}
          onChange={(v) => setFilters({ status: v ?? "all" })}
          allLabel={t("enrollments.allStatuses")}
          options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          aria-label={t("enrollments.status")}
        />
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} />
      </div>

      {enrollments.isError ? (
        <QueryError onRetry={() => void enrollments.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {yearId === null ? (
            <EmptyState title={t("academics.noYearWarning")} />
          ) : enrollments.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : enrollments.data.results.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-8" />} title={t("enrollments.noEnrollments")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("enrollments.student")}</TableHead>
                    <TableHead>{t("enrollments.class")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("enrollments.date")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("enrollments.kind")}</TableHead>
                    <TableHead>{t("enrollments.status")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.data.results.map((e) => {
                    const ref: EnrollmentRef = {
                      id: e.id,
                      studentName: e.student.full_name,
                      className: e.class_name,
                      academicYearId: e.academic_year,
                      classId: e.class_group,
                    };
                    const active = e.status === "active";
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Link to={`/students/${e.student.id}`} className="flex items-center gap-3 hover:underline">
                            <PersonAvatar name={e.student.full_name} photoUrl={e.student.photo_url} className="size-8" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{e.student.full_name}</span>
                              <span className="text-muted-foreground block text-xs">{e.student.student_number}</span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>{e.class_name}</TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                          {formatDate(e.enrollment_date)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{t(`kind.${e.kind}`)}</TableCell>
                        <TableCell>
                          <StatusBadge status={e.status} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  void openPdf(`/enrollments/${e.id}/form/`).catch((err) => toast.error(errorMessage(err, t)))
                                }
                              >
                                <FileText /> {t("enrollments.form")}
                              </DropdownMenuItem>
                              {active && can("enrollments.update") && (
                                <>
                                  <DropdownMenuItem onSelect={() => setAction({ kind: "change_class", ref })}>
                                    <ArrowRightLeft /> {t("enrollments.changeClass")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setAction({ kind: "withdraw", ref })}>
                                    <LogOut /> {t("enrollments.withdraw")}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {active && can("enrollments.cancel") && (
                                <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "cancel", ref })}>
                                  <Ban /> {t("enrollments.cancel")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={enrollments.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {action && <EnrollmentActionDialog action={action.kind} enrollment={action.ref} onClose={() => setAction(null)} />}
    </>
  );
}
