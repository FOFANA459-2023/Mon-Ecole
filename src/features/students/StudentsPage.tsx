import { Download, FileUp, GraduationCap, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { PersonAvatar, SearchInput, StatusBadge } from "@/components/display";
import { ageFrom } from "@/lib/dates";
import { ClassSelect, OptionSelect } from "@/components/pickers";
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
import { useStudents } from "@/features/people/api";
import { useAuth } from "@/lib/auth/context";
import { downloadFile } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

const DEFAULTS = { q: "", class: "", gender: "", status: "active", page: "1" };
const PAGE_SIZE = 25;

export function StudentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const year = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const params = {
    search,
    class_group: filters.class,
    gender: filters.gender,
    status: filters.status === "all" ? undefined : filters.status,
  };
  const students = useStudents({ ...params, page, page_size: PAGE_SIZE });

  const exportAs = (format: "xlsx" | "csv") =>
    downloadFile("/students/export/", { ...params, file_format: format }, `students.${format}`).catch((e) =>
      toast.error(errorMessage(e, t)),
    );

  return (
    <>
      <PageHeader
        title={t("students.title")}
        description={t("students.subtitle")}
        actions={
          <>
            {can("students.export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download /> {t("common.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void exportAs("xlsx")}>{t("students.exportExcel")}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportAs("csv")}>{t("students.exportCsv")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {can("students.create") && (
              <Button variant="outline" asChild>
                <Link to="/students/import">
                  <FileUp /> {t("common.import")}
                </Link>
              </Button>
            )}
            {can("enrollments.create") && can("students.create") && (
              <Button asChild>
                <Link to="/enrollments/new">
                  <UserPlus /> {t("students.newEnrolment")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_9rem_11rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} className="sm:col-span-2 lg:col-span-1" />
        <ClassSelect
          yearId={year?.id}
          value={toNumberOrNull(filters.class)}
          onChange={(v) => setFilters({ class: v ? String(v) : "" })}
          allLabel={t("classes.allClasses")}
          aria-label={t("students.class")}
        />
        <OptionSelect
          value={(filters.gender || null) as "M" | "F" | null}
          onChange={(v) => setFilters({ gender: v ?? "" })}
          allLabel={t("students.allGenders")}
          options={[
            { value: "F", label: t("gender.F") },
            { value: "M", label: t("gender.M") },
          ]}
          aria-label={t("students.gender")}
        />
        <OptionSelect
          value={filters.status as "active" | "archived" | "all"}
          onChange={(v) => setFilters({ status: v ?? "active" })}
          options={[
            { value: "active", label: t("students.statusActive") },
            { value: "archived", label: t("students.statusArchived") },
            { value: "all", label: t("students.statusAll") },
          ]}
          aria-label={t("common.status")}
        />
      </div>

      {students.isError ? (
        <QueryError onRetry={() => void students.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {students.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : students.data.results.length === 0 ? (
            <EmptyState icon={<GraduationCap className="size-8" />} title={t("students.noStudents")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("students.name")}</TableHead>
                    <TableHead>{t("students.class")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("students.gender")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("students.dateOfBirth")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("students.guardian")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.data.results.map((s) => {
                    const age = ageFrom(s.date_of_birth);
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={s.full_name} photoUrl={s.photo_url} className="size-8" />
                            <div className="min-w-0">
                              <Link
                                to={`/students/${s.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block truncate font-medium hover:underline"
                              >
                                {s.last_name.toUpperCase()} {s.first_name}
                              </Link>
                              <p className="text-muted-foreground text-xs">{s.student_number}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.status === "archived" ? (
                            <StatusBadge status="archived" />
                          ) : s.current_enrollment ? (
                            s.current_enrollment.class_name
                          ) : (
                            <span className="text-muted-foreground text-sm">{t("students.notEnrolled")}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{s.gender ? t(`gender.${s.gender}`) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {age !== null ? t("students.age", { count: age }) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                          {s.primary_guardian ? (
                            <>
                              {s.primary_guardian.full_name}
                              <span className="block text-xs">{s.primary_guardian.phone}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={students.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
    </>
  );
}
