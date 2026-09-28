import { Plus, School } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { EmptyState, PageHeader, Pagination, QueryError, Spinner } from "@/components/common";
import { SearchInput } from "@/components/display";
import { LevelSelect, YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClasses, useCurrentYear } from "@/features/academics/api";
import { useAuth } from "@/lib/auth/context";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { ClassFormDialog } from "./ClassFormDialog";

const DEFAULTS = { year: "", level: "", q: "", page: "1" };
const PAGE_SIZE = 50;

export function ClassesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const search = useDebouncedValue(filters.q);
  const page = Number(filters.page);

  const classes = useClasses(
    { academic_year: yearId ?? undefined, level: filters.level, search, page, page_size: PAGE_SIZE },
    yearId !== null,
  );

  return (
    <>
      <PageHeader
        title={t("classes.title")}
        description={t("classes.subtitle")}
        actions={
          can("classes.manage") && (
            <Button onClick={() => setCreating(true)} disabled={!yearId}>
              <Plus /> {t("classes.newClass")}
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[12rem_12rem_1fr]">
        <YearSelect value={yearId} onChange={(v) => setFilters({ year: v ? String(v) : "" })} aria-label={t("classes.year")} />
        <LevelSelect
          value={toNumberOrNull(filters.level)}
          onChange={(v) => setFilters({ level: v ? String(v) : "" })}
          allLabel={t("academics.allLevels")}
          aria-label={t("classes.level")}
        />
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} />
      </div>

      {yearId === null ? (
        <Card>
          <EmptyState icon={<School className="size-8" />} title={t("academics.noYearWarning")}>
            {can("settings.manage") && (
              <Link to="/settings/academic" className="text-primary hover:underline">
                {t("academics.setupLink")}
              </Link>
            )}
          </EmptyState>
        </Card>
      ) : classes.isError ? (
        <QueryError onRetry={() => void classes.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {classes.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : classes.data.results.length === 0 ? (
            <EmptyState icon={<School className="size-8" />} title={t("classes.noClasses")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("classes.name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("classes.level")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("classes.classTeacher")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("classes.room")}</TableHead>
                    <TableHead className="w-48">{t("classes.students")}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">{t("classes.subjects")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.data.results.map((c) => {
                    const ratio = c.capacity ? Math.min(100, (c.enrolled_count / c.capacity) * 100) : null;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/classes/${c.id}`)}>
                        <TableCell className="font-medium">
                          <Link to={`/classes/${c.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                            {c.name}
                          </Link>
                          {c.status === "archived" && (
                            <span className="text-muted-foreground ml-2 text-xs">({t("status.archived")})</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{c.level_name}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {c.class_teacher_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">{c.room || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <span className="w-14">
                              {c.enrolled_count}
                              {c.capacity ? `/${c.capacity}` : ""}
                            </span>
                            {ratio !== null && (
                              <Progress
                                value={ratio}
                                className={ratio >= 100 ? "[&>div]:bg-destructive h-1.5" : "h-1.5"}
                                aria-label={t("classes.capacity")}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">
                          {c.subject_count}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={classes.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}

      {creating && (
        <ClassFormDialog
          defaultYearId={yearId}
          onClose={(saved) => {
            setCreating(false);
            if (saved) navigate(`/classes/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
