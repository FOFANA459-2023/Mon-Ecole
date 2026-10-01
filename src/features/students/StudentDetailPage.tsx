import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  FileText,
  IdCard,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailGrid, StatusBadge } from "@/components/display";
import { ageFrom, useFormatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EnrolExistingDialog,
  EnrollmentActionDialog,
  type EnrollmentAction,
  type EnrollmentRef,
} from "@/features/enrollments/EnrollmentActionDialogs";
import { invalidateSchooling } from "@/features/enrollments/api";
import { StudentAttendanceTab } from "@/features/attendance/StudentAttendanceTab";
import { StudentFinanceTab } from "@/features/finance/StudentFinanceTab";
import { useGuardianLinks, useStudent } from "@/features/people/api";
import { DocumentsPanel } from "@/features/people/DocumentsPanel";
import { PhotoUploader } from "@/features/people/PhotoUploader";
import { api } from "@/lib/api/client";
import type { GuardianLink, Student } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";

import { GuardianFields } from "./GuardianFields";
import { emptyGuardian, guardianErrors, guardianPayload, type GuardianDraft } from "./guardianDraft";
import { StudentFields } from "./StudentFields";
import { emptyStudent, studentPayload, validateStudent, type StudentDraft } from "./studentDraft";

function EditStudentDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<StudentDraft>({
    ...emptyStudent,
    last_name: student.last_name,
    first_name: student.first_name,
    gender: student.gender ?? "",
    date_of_birth: student.date_of_birth ?? "",
    place_of_birth: student.place_of_birth ?? "",
    nationality: student.nationality ?? "",
    phone: student.phone ?? "",
    email: student.email ?? "",
    address: student.address ?? "",
    notes: student.notes ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StudentDraft, string>>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const found = validateStudent(draft, t);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { student_number: _number, ...body } = studentPayload(draft);
      await api.patch(`/students/${student.id}/`, body);
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(t("students.updated"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("students.editTitle")}</DialogTitle>
        </DialogHeader>
        <StudentFields value={draft} onChange={setDraft} errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuardianDialog({
  studentId,
  link,
  onClose,
}: {
  studentId: number;
  link?: GuardianLink;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GuardianDraft>(
    link
      ? {
          ...emptyGuardian(link.relationship as GuardianDraft["relationship"]),
          first_name: link.guardian.first_name,
          last_name: link.guardian.last_name,
          phone: link.guardian.phone ?? "",
          alt_phone: link.guardian.alt_phone ?? "",
          email: link.guardian.email ?? "",
          address: link.guardian.address ?? "",
          occupation: link.guardian.occupation ?? "",
          is_primary: link.is_primary ?? false,
          is_financial_contact: link.is_financial_contact ?? false,
        }
      : emptyGuardian("mother"),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const found = guardianErrors(draft, t);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (link) await api.patch(`/students/${studentId}/guardians/${link.id}/`, guardianPayload(draft));
      else await api.post(`/students/${studentId}/guardians/`, guardianPayload(draft));
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.invalidateQueries({ queryKey: ["guardians"] });
      toast.success(link ? t("guardians.updated") : t("guardians.linked"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{link ? t("guardians.editTitle") : t("guardians.add")}</DialogTitle>
        </DialogHeader>
        <GuardianFields value={draft} onChange={setDraft} errors={errors} idPrefix="gd" allowExisting={!link} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuardiansTab({ studentId, canEdit }: { studentId: number; canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const links = useGuardianLinks(studentId);
  const [dialog, setDialog] = useState<{ link?: GuardianLink } | null>(null);
  const [unlinking, setUnlinking] = useState<GuardianLink | null>(null);

  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => setDialog({})}>
            <Plus /> {t("guardians.add")}
          </Button>
        </div>
      )}
      {links.isPending ? (
        <Spinner className="mx-auto my-8 size-6" />
      ) : !links.data?.length ? (
        <Card>
          <EmptyState title={t("guardians.noGuardians")} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {links.data.map((link) => {
            const siblings = link.guardian.students.filter((s) => s.id !== studentId);
            return (
              <Card key={link.id} className="gap-3">
                <CardContent className="grid gap-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold">
                        {link.guardian.full_name}
                        {link.is_primary && <Star className="size-4 fill-amber-400 text-amber-400" aria-label={t("guardians.primary")} />}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t(`relationship.${link.relationship}`)}
                        {link.guardian.occupation ? ` · ${link.guardian.occupation}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ link })}>
                            <Pencil /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setUnlinking(link)}>
                            <Trash2 /> {t("guardians.unlink")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <DetailGrid
                    className="sm:grid-cols-2 lg:grid-cols-2"
                    items={[
                      {
                        label: t("guardians.phone"),
                        value: [link.guardian.phone, link.guardian.alt_phone].filter(Boolean).join(" / "),
                      },
                      { label: t("guardians.email"), value: link.guardian.email },
                    ]}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {link.is_primary && <Badge variant="secondary">{t("guardians.primary")}</Badge>}
                    {link.is_financial_contact && <Badge variant="secondary">{t("guardians.financialContact")}</Badge>}
                  </div>
                  {siblings.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t("guardians.otherChildren", { names: "" })}
                      {siblings.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <Link to={`/students/${s.id}`} className="text-primary hover:underline">
                            {s.full_name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {dialog && <GuardianDialog studentId={studentId} link={dialog.link} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(o) => !o && setUnlinking(null)}
        title={t("guardians.unlink")}
        description={t("guardians.confirmUnlink", { name: unlinking?.guardian.full_name ?? "" })}
        confirmLabel={t("guardians.unlink")}
        destructive
        onConfirm={async () => {
          if (!unlinking) return;
          try {
            await api.delete(`/students/${studentId}/guardians/${unlinking.id}/`);
            await queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success(t("guardians.unlinked"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </>
  );
}

function ComingLater({ phase, icon }: { phase: number; icon: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card>
      <EmptyState icon={icon} title={t("common.comingSoon")}>
        {t("students.availableIn", { phase })}
      </EmptyState>
    </Card>
  );
}

export function StudentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const studentId = Number(id);
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const studentQuery = useStudent(studentId);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [action, setAction] = useState<{ kind: EnrollmentAction; ref: EnrollmentRef } | null>(null);

  if (studentQuery.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  const seesFinance = can("finance.view");
  const seesAttendance = can("attendance.view");
  if (studentQuery.isError) return <QueryError error={studentQuery.error} onRetry={() => void studentQuery.refetch()} />;
  const s = studentQuery.data;
  const current = s.current_enrollment;
  const age = ageFrom(s.date_of_birth);
  const currentRef: EnrollmentRef | null = current
    ? {
        id: current.id,
        studentName: s.full_name,
        className: current.class_name,
        academicYearId: current.academic_year,
        classId: current.class_group,
      }
    : null;

  const report = (promise: Promise<unknown>) => promise.catch((e) => toast.error(errorMessage(e, t)));
  const setArchived = async (archived: boolean) => {
    try {
      await api.post(`/students/${s.id}/${archived ? "archive" : "restore"}/`);
      await invalidateSchooling(queryClient);
      toast.success(archived ? t("students.archived") : t("students.restored"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <>
      <Link to="/students" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> {t("students.title")}
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <PhotoUploader
          name={s.full_name}
          photoUrl={s.photo_url}
          path={can("students.update") ? `/students/${s.id}/photo/` : undefined}
          label={t("students.changePhoto")}
          onUploaded={async () => {
            await queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success(t("students.photoUpdated"));
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {s.last_name.toUpperCase()} {s.first_name}
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">{s.student_number}</span>
            {age !== null && <>· {t("students.age", { count: age })}</>}
            {current ? (
              <Link to={`/classes/${current.class_group}`}>
                <Badge className="bg-primary/10 text-primary border-transparent">
                  {current.class_name} · {current.academic_year_name}
                </Badge>
              </Link>
            ) : (
              <Badge variant="outline">{t("students.notEnrolled")}</Badge>
            )}
            {s.status === "archived" && <StatusBadge status="archived" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void report(openPdf(`/students/${s.id}/card/`))}>
            <IdCard /> {t("students.printCard")}
          </Button>
          {can("students.update") && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> {t("common.edit")}
            </Button>
          )}
          {!current && s.status === "active" && can("enrollments.create") && (
            <Button onClick={() => setEnrolling(true)}>
              <UserPlus /> {t("students.enrol")}
            </Button>
          )}
          {(can("enrollments.update") || can("enrollments.cancel") || can("students.archive")) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("students.moreActions")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {currentRef && can("enrollments.update") && (
                  <>
                    <DropdownMenuItem onSelect={() => setAction({ kind: "change_class", ref: currentRef })}>
                      <ArrowRightLeft /> {t("enrollments.changeClass")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAction({ kind: "withdraw", ref: currentRef })}>
                      <LogOut /> {t("enrollments.withdraw")}
                    </DropdownMenuItem>
                  </>
                )}
                {currentRef && can("enrollments.cancel") && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "cancel", ref: currentRef })}>
                    <Ban /> {t("enrollments.cancel")}
                  </DropdownMenuItem>
                )}
                {can("students.archive") && (
                  <>
                    <DropdownMenuSeparator />
                    {s.status === "archived" ? (
                      <DropdownMenuItem onSelect={() => void setArchived(false)}>
                        <ArchiveRestore /> {t("students.restore")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => setArchiving(true)}>
                        <Archive /> {t("students.archive")}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Tabs
        defaultValue={
          (params.get("tab") === "payments" && !seesFinance) || (params.get("tab") === "attendance" && !seesAttendance)
            ? "profile"
            : (params.get("tab") ?? "profile")
        }
      >
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile">{t("students.profile")}</TabsTrigger>
          <TabsTrigger value="guardians">{t("students.guardians")}</TabsTrigger>
          <TabsTrigger value="schooling">{t("students.schooling")}</TabsTrigger>
          <TabsTrigger value="documents">{t("students.documents")}</TabsTrigger>
          {seesFinance && <TabsTrigger value="payments">{t("students.payments")}</TabsTrigger>}
          {seesAttendance && <TabsTrigger value="attendance">{t("students.attendance")}</TabsTrigger>}
          <TabsTrigger value="results">{t("students.results")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent>
              <DetailGrid
                items={[
                  { label: t("students.lastName"), value: s.last_name },
                  { label: t("students.firstName"), value: s.first_name },
                  { label: t("students.gender"), value: s.gender ? t(`gender.${s.gender}`) : "" },
                  { label: t("students.dateOfBirth"), value: formatDate(s.date_of_birth) },
                  { label: t("students.placeOfBirth"), value: s.place_of_birth },
                  { label: t("students.nationality"), value: s.nationality },
                  { label: t("students.phone"), value: s.phone },
                  { label: t("students.email"), value: s.email },
                  { label: t("students.address"), value: s.address },
                  { label: t("students.notes"), value: s.notes },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <GuardiansTab studentId={s.id} canEdit={can("students.update")} />
        </TabsContent>

        <TabsContent value="schooling">
          <Card className="gap-0 overflow-hidden py-0">
            {s.enrollments.length === 0 ? (
              <EmptyState title={t("students.noHistory")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("classes.year")}</TableHead>
                    <TableHead>{t("enrollments.class")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("enrollments.kind")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("enrollments.date")}</TableHead>
                    <TableHead>{t("enrollments.status")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.enrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.academic_year_name}</TableCell>
                      <TableCell>
                        <span className="font-medium">{e.class_name}</span>{" "}
                        <span className="text-muted-foreground text-xs">{e.level_name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{t(`kind.${e.kind}`)}</TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {formatDate(e.enrollment_date)}
                        {e.ended_on && <span className="block text-xs">{t("enrollments.endedOn", { date: formatDate(e.ended_on) })}</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("students.printForm")}
                          title={t("students.printForm")}
                          onClick={() => void report(openPdf(`/enrollments/${e.id}/form/`))}
                        >
                          <FileText />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel ownerType="student" ownerId={s.id} canEdit={can("students.update")} />
        </TabsContent>
        {seesFinance && (
          <TabsContent value="payments">
            <StudentFinanceTab student={s} />
          </TabsContent>
        )}
        {seesAttendance && (
          <TabsContent value="attendance">
            <StudentAttendanceTab studentId={s.id} />
          </TabsContent>
        )}
        <TabsContent value="results">
          <ComingLater phase={4} icon={<FileText className="size-8" />} />
        </TabsContent>
      </Tabs>

      {editing && <EditStudentDialog student={s} onClose={() => setEditing(false)} />}
      {enrolling && <EnrolExistingDialog studentId={s.id} studentName={s.full_name} onClose={() => setEnrolling(false)} />}
      {action && <EnrollmentActionDialog action={action.kind} enrollment={action.ref} onClose={() => setAction(null)} />}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={t("students.archive")}
        description={t("students.confirmArchive", { name: s.full_name })}
        confirmLabel={t("students.archive")}
        destructive
        onConfirm={() => setArchived(true)}
      />
    </>
  );
}
