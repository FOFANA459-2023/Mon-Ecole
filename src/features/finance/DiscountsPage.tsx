import { BadgePercent, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState, Pagination, QueryError, Spinner } from "@/components/common";
import { SearchInput, StatusBadge } from "@/components/display";
import { YearSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import type { StudentDiscount } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toNumberOrNull, useUrlState } from "@/lib/useUrlState";

import { useDiscountLabel, useStudentDiscounts } from "./api";
import { DiscountDialog } from "./DiscountDialog";

const DEFAULTS = { q: "", year: "", page: "1" };
const PAGE_SIZE = 50;

export function DiscountsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manage = can("finance.fees.manage");
  const label = useDiscountLabel();
  const currentYear = useCurrentYear();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const search = useDebouncedValue(filters.q);
  const yearId = toNumberOrNull(filters.year) ?? currentYear?.id ?? null;
  const page = Number(filters.page);
  const discounts = useStudentDiscounts(
    { search, academic_year: yearId ?? undefined, page, page_size: PAGE_SIZE },
    yearId !== null,
  );
  const [dialog, setDialog] = useState<{ discount?: StudentDiscount } | null>(null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("finance.discountsIntro")}</p>
        {manage && (
          <Button onClick={() => setDialog({})}>
            <Plus /> {t("finance.newDiscount")}
          </Button>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} />
        <YearSelect value={yearId} onChange={(v) => setFilters({ year: v ? String(v) : "" })} aria-label={t("classes.year")} />
      </div>
      {discounts.isError ? (
        <QueryError onRetry={() => void discounts.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {discounts.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : discounts.data.results.length === 0 ? (
            <EmptyState icon={<BadgePercent className="size-8" />} title={t("finance.noDiscounts")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("finance.student")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("finance.category")}</TableHead>
                    <TableHead className="text-right">{t("finance.discount")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("common.reason")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.data.results.map((d) => (
                    <TableRow
                      key={d.id}
                      className={manage ? "cursor-pointer" : undefined}
                      onClick={manage ? () => setDialog({ discount: d }) : undefined}
                    >
                      <TableCell>
                        <Link
                          to={`/students/${d.student}?tab=payments`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {d.student_name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{d.student_number}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{d.category_name ?? t("finance.allCategories")}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{label(d)}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {t(`finance.reasons.${d.reason}`)}
                        {d.note && ` — ${d.note}`}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusBadge status={d.is_active ? "active" : "archived"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={discounts.data.count}
                onPageChange={(p) => setFilters({ page: String(p) })}
              />
            </>
          )}
        </Card>
      )}
      {dialog && <DiscountDialog discount={dialog.discount} defaultYearId={yearId} onClose={() => setDialog(null)} />}
    </>
  );
}
