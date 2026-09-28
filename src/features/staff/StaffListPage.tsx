import { FileUp, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { EmptyState, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { PersonAvatar, SearchInput, StatusBadge } from "@/components/display";
import { OptionSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaffList } from "@/features/people/api";
import { useAuth } from "@/lib/auth/context";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

import { StaffFormDialog } from "./StaffFormDialog";

const DEFAULTS = { q: "", type: "", status: "active", page: "1" };
const PAGE_SIZE = 25;
const TYPES = ["teacher", "administrative", "support"] as const;

export function StaffListPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);
  const staff = useStaffList({
    search,
    staff_type: filters.type,
    status: filters.status === "all" ? undefined : filters.status,
    page,
    page_size: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title={t("staff.title")}
        description={t("staff.subtitle")}
        actions={
          can("staff.create") && (
            <>
              <Button variant="outline" asChild>
                <Link to="/teachers/import">
                  <FileUp /> {t("common.import")}
                </Link>
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t("staff.add")}
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_11rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} />
        <OptionSelect
          value={(filters.type || null) as (typeof TYPES)[number] | null}
          onChange={(v) => setFilters({ type: v ?? "" })}
          allLabel={t("staff.allTypes")}
          options={TYPES.map((v) => ({ value: v, label: t(`staffType.${v}`) }))}
          aria-label={t("staff.type")}
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

      {staff.isError ? (
        <QueryError onRetry={() => void staff.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {staff.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : staff.data.results.length === 0 ? (
            <EmptyState icon={<Users className="size-8" />} title={t("staff.noStaff")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("staff.position")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("staff.phone")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("classes.title")}</TableHead>
                    <TableHead>{t("staff.access")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.data.results.map((s) => {
                    const classes = new Set([
                      ...s.assignments.homeroom_classes.map((c) => c.name),
                      ...s.assignments.subjects.map((a) => a.class_name),
                    ]);
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/teachers/${s.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={s.full_name} photoUrl={s.photo_url} className="size-8" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {s.full_name} {s.status === "archived" && <StatusBadge status="archived" />}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {s.employee_number} · {t(`staffType.${s.staff_type}`)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{s.position || "—"}</TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                          {s.phone || s.email || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {classes.size ? t("staff.classesCount", { count: classes.size }) : "—"}
                        </TableCell>
                        <TableCell>
                          {s.has_access ? (
                            <Badge className="bg-success/15 text-success border-transparent">{t("staff.hasAccess")}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t("staff.noAccess")}</span>
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
                count={staff.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {creating && (
        <StaffFormDialog
          onClose={(saved) => {
            setCreating(false);
            if (saved) navigate(`/teachers/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
