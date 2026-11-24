import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { QueryError, Spinner } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSchoolId } from "@/features/academics/api";
import { api, type Paginated } from "@/lib/api/client";
import type { AcademicYear, Staff } from "@/lib/api/types";

/** Every active staff member (the list API pages by 100). */
function useAllActiveStaff() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ["staff", schoolId, "all-active"],
    queryFn: async ({ signal }) => {
      const all: Staff[] = [];
      for (let page = 1; ; page++) {
        const data = await api.get<Paginated<Staff>>("/staff/", { status: "active", page, page_size: 100 }, signal);
        all.push(...data.results);
        if (!data.next) return all;
      }
    },
    enabled: schoolId !== null,
  });
}

/** Starting a new school year renews the team: the Director ticks who continues; the others are archived
 * as having left and lose their access. Directors always continue. */
export function StartYearDialog({
  year,
  onClose,
  onStart,
}: {
  year: AcademicYear;
  onClose: () => void;
  onStart: (continuingStaffIds: number[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const staff = useAllActiveStaff();
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const people = useMemo(() => staff.data ?? [], [staff.data]);
  const renewable = people.filter((s) => !s.is_director);
  const continuing = people.filter((s) => !leaving.has(s.id));

  const toggle = (id: number, stays: boolean) =>
    setLeaving((current) => {
      const next = new Set(current);
      if (stays) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = async () => {
    setBusy(true);
    try {
      await onStart(continuing.map((s) => s.id));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("academics.startYear.title", { year: year.name })}</DialogTitle>
          <DialogDescription>{t("academics.startYear.hint")}</DialogDescription>
        </DialogHeader>
        {staff.isError ? (
          <QueryError error={staff.error} onRetry={() => void staff.refetch()} />
        ) : staff.isPending ? (
          <Spinner className="mx-auto my-8 size-6" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">
                {t("academics.startYear.summary", {
                  stay: continuing.length,
                  leave: people.length - continuing.length,
                })}
              </span>
              <span className="ml-auto flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setLeaving(new Set())}>
                  {t("academics.startYear.everyoneStays")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLeaving(new Set(renewable.map((s) => s.id)))}
                >
                  {t("academics.startYear.nobodyStays")}
                </Button>
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {people.length === 0 && (
                <li className="text-muted-foreground p-3 text-sm">{t("academics.startYear.noStaff")}</li>
              )}
              {people.map((person) => {
                const stays = !leaving.has(person.id);
                const id = `stays-${person.id}`;
                return (
                  <li key={person.id} className="flex items-center gap-3 p-3">
                    <Checkbox
                      id={id}
                      checked={stays}
                      disabled={person.is_director}
                      onCheckedChange={(value) => toggle(person.id, value === true)}
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-sm font-medium">{person.full_name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[person.position, person.staff_type && t(`staffType.${person.staff_type}`)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </label>
                    {person.is_director ? (
                      <Badge variant="secondary">{t("academics.startYear.directorStays")}</Badge>
                    ) : !stays ? (
                      <Badge variant="outline" className="text-destructive">
                        {t("academics.startYear.leaves")}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground text-xs">
              {t("academics.startYear.newcomers")}{" "}
              <Link to="/teachers" className="text-primary underline-offset-4 hover:underline" onClick={onClose}>
                {t("academics.startYear.goToStaff")}
              </Link>
            </p>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void start()} disabled={busy || staff.isPending || staff.isError}>
            {busy ? t("common.saving") : t("academics.startYear.confirm", { year: year.name })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
