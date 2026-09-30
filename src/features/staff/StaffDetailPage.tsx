import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, KeyRound, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailGrid, StatusBadge } from "@/components/display";
import { useFormatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaffMember } from "@/features/people/api";
import { DocumentsPanel } from "@/features/people/DocumentsPanel";
import { PhotoUploader } from "@/features/people/PhotoUploader";
import { useRoles } from "@/features/settings/api";
import { api } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/forms";

import { StaffFormDialog } from "./StaffFormDialog";

function GrantAccessDialog({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const teacherRole = roles.data?.find((r) => r.key === "teacher");
  const chosen = selected.length ? selected : teacherRole && staff.staff_type === "teacher" ? [teacherRole.id] : [];

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/staff/${staff.id}/grant-access/`, { role_ids: chosen });
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success(t("staff.accessGranted"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("staff.grantAccess")}</DialogTitle>
          <DialogDescription>{t("staff.grantAccessBody", { email: staff.email })}</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t("settings.users.roles")}</legend>
          {(roles.data ?? [])
            .filter((r) => r.key !== "parent")
            .map((role) => (
              <label key={role.id} className="hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={chosen.includes(role.id)}
                  onCheckedChange={(v) =>
                    setSelected(v ? [...chosen, role.id] : chosen.filter((id) => id !== role.id))
                  }
                />
                {role.name}
              </label>
            ))}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || chosen.length === 0}>
            {t("staff.grantAccess")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StaffDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const staffId = Number(id);
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const staffQuery = useStaffMember(staffId);
  const [editing, setEditing] = useState(false);
  const [granting, setGranting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (staffQuery.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  if (staffQuery.isError) return <QueryError error={staffQuery.error} onRetry={() => void staffQuery.refetch()} />;
  const s = staffQuery.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const setArchived = async (archived: boolean) => {
    try {
      await api.post(`/staff/${s.id}/${archived ? "archive" : "restore"}/`);
      await refresh();
      toast.success(archived ? t("staff.archived") : t("staff.restored"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <>
      <Link to="/teachers" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> {t("staff.title")}
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <PhotoUploader
          name={s.full_name}
          photoUrl={s.photo_url}
          path={can("staff.update") ? `/staff/${s.id}/photo/` : undefined}
          label={t("staff.changePhoto")}
          onUploaded={async () => {
            await refresh();
            toast.success(t("staff.photoUpdated"));
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{s.full_name}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>{s.employee_number}</span>·<span>{t(`staffType.${s.staff_type}`)}</span>
            {s.position && <>·<span>{s.position}</span></>}
            <StatusBadge status={s.status ?? "active"} />
            {s.has_access && (
              <Badge className="bg-success/15 text-success border-transparent">{t("staff.hasAccess")}</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("users.manage") && !s.has_access && s.status === "active" && (
            <Button
              variant="outline"
              onClick={() => (s.email ? setGranting(true) : toast.error(t("staff.needsEmail")))}
            >
              <KeyRound /> {t("staff.grantAccess")}
            </Button>
          )}
          {can("staff.update") && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> {t("common.edit")}
            </Button>
          )}
          {can("staff.archive") &&
            (s.status === "archived" ? (
              <Button variant="outline" onClick={() => void setArchived(false)}>
                <ArchiveRestore /> {t("staff.restore")}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setArchiving(true)}>
                <Archive /> {t("staff.archive")}
              </Button>
            ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("staff.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid
              items={[
                { label: t("staff.gender"), value: s.gender ? t(`gender.${s.gender}`) : "" },
                { label: t("staff.dateOfBirth"), value: formatDate(s.date_of_birth) },
                { label: t("staff.phone"), value: s.phone },
                { label: t("staff.email"), value: s.email },
                { label: t("staff.qualification"), value: s.qualification },
                { label: t("staff.specialization"), value: s.specialization },
                { label: t("staff.employmentDate"), value: formatDate(s.employment_date) },
                { label: t("staff.address"), value: s.address },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("staff.assignments")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {s.assignments.homeroom_classes.length === 0 && s.assignments.subjects.length === 0 ? (
              <p className="text-muted-foreground">{t("staff.noAssignments")}</p>
            ) : (
              <>
                {s.assignments.homeroom_classes.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">{t("staff.homeroom")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.assignments.homeroom_classes.map((c) => (
                        <Link key={c.id} to={`/classes/${c.id}`}>
                          <Badge variant="secondary">{c.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {s.assignments.subjects.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">{t("staff.teaches")}</p>
                    <ul className="grid gap-1">
                      {s.assignments.subjects.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2">
                          <span>{a.subject_name}</span>
                          <span className="text-muted-foreground">{a.class_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">{t("students.documents")}</h2>
          <DocumentsPanel ownerType="staff" ownerId={s.id} canEdit={can("staff.update")} />
        </div>
      </div>

      {editing && <StaffFormDialog staff={s} onClose={() => setEditing(false)} />}
      {granting && <GrantAccessDialog staff={s} onClose={() => setGranting(false)} />}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={t("staff.archive")}
        description={t("staff.confirmArchive", { name: s.full_name })}
        confirmLabel={t("staff.archive")}
        destructive
        onConfirm={() => setArchived(true)}
      />
    </>
  );
}
