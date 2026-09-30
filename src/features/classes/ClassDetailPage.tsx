import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, IdCard, MoreHorizontal, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, Field, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailGrid, PersonAvatar, StatusBadge } from "@/components/display";
import { ageFrom } from "@/lib/dates";
import { TeacherSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClass, useClassSubjects, useSubjects } from "@/features/academics/api";
import { useStudents } from "@/features/people/api";
import { api } from "@/lib/api/client";
import type { ClassGroup, ClassSubject } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { openPdf } from "@/lib/files";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { ClassFormDialog } from "./ClassFormDialog";

function ClassSubjectDialog({
  classGroup,
  item,
  taken,
  onClose,
}: {
  classGroup: ClassGroup;
  item?: ClassSubject;
  taken: number[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const subjects = useSubjects({ is_active: true, page_size: 100 });
  const options = (subjects.data?.results ?? []).filter((s) => s.id === item?.subject || !taken.includes(s.id));
  const schema = useMemo(
    () =>
      z.object({
        subject: z.number(t("validation.required")),
        teacher: z.number().nullable(),
        coefficient: z.number(t("validation.required")).min(0.1).max(99),
        weekly_hours: z.number().min(0).max(99).nullable(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: item?.subject,
      teacher: item?.teacher ?? null,
      coefficient: item ? Number(item.coefficient) : undefined,
      weekly_hours: item?.weekly_hours ? Number(item.weekly_hours) : null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const body = { ...values, class_group: classGroup.id };
      if (item) await api.patch(`/class-subjects/${item.id}/`, body);
      else await api.post("/class-subjects/", body);
      await Promise.all(
        ["class-subjects", "classes", "staff"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
      );
      toast.success(t(item ? "academics.saved" : "classes.subjectAdded"));
      onClose();
    } catch (error) {
      const message = applyApiErrors(error, form.setError, ["subject", "teacher", "coefficient", "weekly_hours"], t);
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? t("classes.editSubject") : t("classes.addSubject")}</DialogTitle>
        </DialogHeader>
        <form id="cs-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={t("classes.subject")} htmlFor="cs-subject" error={errors.subject?.message}>
            <Controller
              control={form.control}
              name="subject"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  disabled={Boolean(item)}
                  onValueChange={(v) => {
                    if (!v) return;
                    field.onChange(Number(v));
                    const subject = options.find((s) => s.id === Number(v));
                    if (subject && !form.getValues("coefficient")) {
                      form.setValue("coefficient", Number(subject.default_coefficient));
                    }
                  }}
                >
                  <SelectTrigger id="cs-subject" className="w-full">
                    <SelectValue placeholder={t("classes.subject")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={t("classes.teacher")} htmlFor="cs-teacher">
            <Controller
              control={form.control}
              name="teacher"
              render={({ field }) => <TeacherSelect id="cs-teacher" value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("classes.coefficient")} htmlFor="cs-coef" error={errors.coefficient?.message}>
              <Input id="cs-coef" type="number" step="0.5" min={0.1} {...form.register("coefficient", { valueAsNumber: true })} />
            </Field>
            <Field label={t("classes.weeklyHours")} htmlFor="cs-hours" error={errors.weekly_hours?.message}>
              <Input
                id="cs-hours"
                type="number"
                step="0.5"
                min={0}
                {...form.register("weekly_hours", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
              />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="cs-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClassDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const classId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const classQuery = useClass(classId);
  const subjects = useClassSubjects(classId);
  const students = useStudents({ class_group: classId, page_size: 100 }, can("students.view"));
  const [editing, setEditing] = useState(false);
  const [subjectDialog, setSubjectDialog] = useState<{ item?: ClassSubject } | null>(null);
  const [removing, setRemoving] = useState<ClassSubject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const manage = can("classes.manage");

  if (classQuery.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  if (classQuery.isError) return <QueryError error={classQuery.error} onRetry={() => void classQuery.refetch()} />;
  const c = classQuery.data;
  const totalCoefficients = (subjects.data ?? []).reduce((sum, s) => sum + Number(s.coefficient), 0);

  const printCards = () => openPdf(`/classes/${c.id}/cards/`).catch((e) => toast.error(errorMessage(e, t)));

  return (
    <>
      <Link to="/classes" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> {t("classes.title")}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {c.name} {c.status === "archived" && <StatusBadge status="archived" />}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {c.level_name} · {c.academic_year_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("students.view") && (
            <Button variant="outline" onClick={() => void printCards()} disabled={c.enrolled_count === 0}>
              <IdCard /> {t("classes.printCards")}
            </Button>
          )}
          {can("enrollments.create") && (
            <Button variant="outline" asChild>
              <Link to={`/enrollments/promote?from=${c.id}`}>
                <RefreshCcw /> {t("classes.reenrol")}
              </Link>
            </Button>
          )}
          {manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("common.actions")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2 /> {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardContent>
          <DetailGrid
            className="lg:grid-cols-4"
            items={[
              { label: t("classes.classTeacher"), value: c.class_teacher_name },
              { label: t("classes.room"), value: c.room },
              {
                label: t("classes.students"),
                value: c.capacity ? `${c.enrolled_count} / ${c.capacity}` : String(c.enrolled_count),
              },
              { label: t("classes.subjects"), value: String(c.subject_count) },
            ]}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue={can("students.view") ? "students" : "subjects"}>
        <TabsList>
          {can("students.view") && <TabsTrigger value="students">{t("classes.students")}</TabsTrigger>}
          <TabsTrigger value="subjects">{t("classes.subjects")}</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="gap-0 overflow-hidden py-0">
            {students.isPending ? (
              <Spinner className="mx-auto my-10 size-6" />
            ) : !students.data || students.data.results.length === 0 ? (
              <EmptyState title={t("classes.noStudents")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{t("students.name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("students.gender")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("students.dateOfBirth")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("students.guardian")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.data.results.map((s, index) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                      <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={s.full_name} photoUrl={s.photo_url} className="size-8" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {s.last_name.toUpperCase()} {s.first_name}
                            </p>
                            <p className="text-muted-foreground text-xs">{s.student_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{s.gender ? t(`gender.short.${s.gender}`) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {ageFrom(s.date_of_birth) !== null ? t("students.age", { count: ageFrom(s.date_of_birth) ?? 0 }) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                        {s.primary_guardian ? `${s.primary_guardian.full_name} · ${s.primary_guardian.phone}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="subjects">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {t("classes.totalCoefficients", { total: totalCoefficients })}
            </p>
            {manage && (
              <Button size="sm" onClick={() => setSubjectDialog({})}>
                <Plus /> {t("classes.addSubject")}
              </Button>
            )}
          </div>
          <Card className="gap-0 overflow-hidden py-0">
            {subjects.isPending ? (
              <Spinner className="mx-auto my-10 size-6" />
            ) : !subjects.data || subjects.data.length === 0 ? (
              <EmptyState title={t("classes.noSubjectsAssigned")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("classes.subject")}</TableHead>
                    <TableHead>{t("classes.teacher")}</TableHead>
                    <TableHead className="text-right">{t("classes.coefficient")}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">{t("classes.weeklyHours")}</TableHead>
                    {manage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.data.map((cs) => (
                    <TableRow key={cs.id}>
                      <TableCell>
                        <span className="font-medium">{cs.subject_name}</span>{" "}
                        <span className="text-muted-foreground text-xs">{cs.subject_code}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cs.teacher_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(cs.coefficient)}</TableCell>
                      <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                        {cs.weekly_hours ? Number(cs.weekly_hours) : "—"}
                      </TableCell>
                      {manage && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setSubjectDialog({ item: cs })}>
                                <Pencil /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(cs)}>
                                <Trash2 /> {t("common.remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {editing && <ClassFormDialog classGroup={c} onClose={() => setEditing(false)} />}
      {subjectDialog && (
        <ClassSubjectDialog
          classGroup={c}
          item={subjectDialog.item}
          taken={(subjects.data ?? []).map((s) => s.subject)}
          onClose={() => setSubjectDialog(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("common.remove")}
        description={t("classes.confirmRemoveSubject", { name: removing?.subject_name ?? "" })}
        confirmLabel={t("common.remove")}
        destructive
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.delete(`/class-subjects/${removing.id}/`);
            await queryClient.invalidateQueries({ queryKey: ["class-subjects"] });
            await queryClient.invalidateQueries({ queryKey: ["classes"] });
            toast.success(t("classes.subjectRemoved"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("common.delete")}
        description={t("classes.confirmDelete", { name: c.name })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          try {
            await api.delete(`/classes/${c.id}/`);
            await queryClient.invalidateQueries({ queryKey: ["classes"] });
            toast.success(t("classes.deleted"));
            navigate("/classes");
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </>
  );
}
