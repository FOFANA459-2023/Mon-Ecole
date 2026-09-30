import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ClassSelect, OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentYear, useSubjects, useYearClasses } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import { errorMessage } from "@/lib/forms";

import { type Teaching, teachingPayload } from "./teaching";

/** The class a teacher leads and the subjects they teach, class by class, in the current school year. */
export function TeachingEditor({ value, onChange }: { value: Teaching; onChange: (value: Teaching) => void }) {
  const { t } = useTranslation();
  const year = useCurrentYear();
  const { classes } = useYearClasses(year?.id);
  const subjects = (useSubjects({ page_size: 200, is_active: true }).data?.results ?? []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const setRow = (index: number, patch: Partial<Teaching["subjects"][number]>) =>
    onChange({ ...value, subjects: value.subjects.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  if (!year) return <p className="text-muted-foreground text-sm">{t("staff.teachingNoYear")}</p>;
  if (classes.length === 0) return <p className="text-muted-foreground text-sm">{t("staff.teachingNoClasses")}</p>;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="teach-homeroom" className="text-sm font-medium">
          {t("staff.homeroomClass")}
        </label>
        <ClassSelect
          id="teach-homeroom"
          yearId={year.id}
          value={value.homeroom_class_ids[0] ?? null}
          onChange={(id) => onChange({ ...value, homeroom_class_ids: id ? [id] : [] })}
          allLabel={t("common.none")}
        />
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{t("staff.subjectsTaught")}</p>
        {value.subjects.length === 0 && <p className="text-muted-foreground text-xs">{t("staff.noSubjectsYet")}</p>}
        {value.subjects.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <ClassSelect
              yearId={year.id}
              value={row.class_group}
              onChange={(id) => setRow(index, { class_group: id })}
              aria-label={t("classes.chooseClass")}
            />
            <OptionSelect
              value={row.subject !== null ? String(row.subject) : null}
              onChange={(v) => setRow(index, { subject: v ? Number(v) : null })}
              options={subjects}
              placeholder={t("staff.subject")}
              aria-label={t("staff.subject")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.remove")}
              onClick={() => onChange({ ...value, subjects: value.subjects.filter((_, i) => i !== index) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange({ ...value, subjects: [...value.subjects, { class_group: null, subject: null }] })}
        >
          <Plus /> {t("staff.addSubject")}
        </Button>
      </div>
    </div>
  );
}

/** Change what a teacher does this year, from their profile. */
export function TeachingDialog({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<Teaching>(() => ({
    homeroom_class_ids: staff.assignments.homeroom_classes.map((c) => c.id),
    subjects: staff.assignments.subjects.map((a) => ({ class_group: a.class_id, subject: a.subject_id })),
  }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/staff/${staff.id}/teaching/`, teachingPayload(value));
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("staff.teachingSaved"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("staff.teachingTitle", { name: staff.full_name })}</DialogTitle>
          <DialogDescription>{t("staff.teachingHint")}</DialogDescription>
        </DialogHeader>
        <TeachingEditor value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
