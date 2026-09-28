import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, FileText, IdCard, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Field, PageHeader } from "@/components/common";
import { DetailGrid, PersonAvatar, SearchInput } from "@/components/display";
import { useFormatDate } from "@/lib/dates";
import { ClassSelect, OptionSelect, YearSelect } from "@/components/pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentYear, useYearClasses } from "@/features/academics/api";
import { useGuardianLinks, useStudents } from "@/features/people/api";
import { GuardianFields } from "@/features/students/GuardianFields";
import { emptyGuardian, guardianErrors, guardianPayload, type GuardianDraft } from "@/features/students/guardianDraft";
import { StudentFields } from "@/features/students/StudentFields";
import { emptyStudent, studentPayload, validateStudent, type StudentDraft } from "@/features/students/studentDraft";
import { api } from "@/lib/api/client";
import type { Enrollment, StudentListItem } from "@/lib/api/types";
import { openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

import { invalidateSchooling } from "./api";

const STEPS = ["student", "guardians", "schooling", "review"] as const;
type Step = (typeof STEPS)[number];
type Kind = "new" | "re_enrolment" | "transfer_in";

function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation();
  const index = STEPS.indexOf(step);
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
              i < index && "bg-primary border-primary text-primary-foreground",
              i === index && "border-primary text-primary",
              i > index && "text-muted-foreground",
            )}
          >
            {i < index ? <Check className="size-4" /> : i + 1}
          </span>
          <span className={cn(i === index ? "font-medium" : "text-muted-foreground")}>{t(`enrollments.steps.${s}`)}</span>
          {i < STEPS.length - 1 && <span className="bg-border mx-1 h-px w-8" />}
        </li>
      ))}
    </ol>
  );
}

function ExistingStudentPicker({
  selected,
  onSelect,
}: {
  selected: StudentListItem | null;
  onSelect: (student: StudentListItem | null) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query);
  const results = useStudents({ search, status: "active", page_size: 8 }, search.trim().length >= 2);

  if (selected) {
    return (
      <div className="bg-accent/50 flex items-center gap-3 rounded-lg border p-3">
        <PersonAvatar name={selected.full_name} photoUrl={selected.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{selected.full_name}</p>
          <p className="text-muted-foreground text-sm">
            {selected.student_number}
            {selected.current_enrollment && ` · ${selected.current_enrollment.class_name} (${selected.current_enrollment.academic_year_name})`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          {t("guardians.changeChoice")}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <SearchInput value={query} onChange={setQuery} placeholder={t("enrollments.searchStudent")} />
      <ul className="grid gap-1">
        {results.data?.results.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm"
            >
              <PersonAvatar name={s.full_name} photoUrl={s.photo_url} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.full_name}</span>
                <span className="text-muted-foreground block text-xs">
                  {s.student_number}
                  {s.current_enrollment && ` · ${s.current_enrollment.class_name}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Success({ enrollment, onAnother }: { enrollment: Enrollment; onAnother: () => void }) {
  const { t } = useTranslation();
  const report = (p: Promise<unknown>) => p.catch((e) => toast.error(errorMessage(e, t)));
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="text-success size-12" />
        <h2 className="text-xl font-semibold">{t("enrollments.successTitle")}</h2>
        <p className="text-muted-foreground max-w-md">
          {t("enrollments.successBody", {
            name: enrollment.student.full_name,
            class: enrollment.class_name,
            year: enrollment.academic_year_name,
            number: enrollment.student.student_number,
          })}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void report(openPdf(`/enrollments/${enrollment.id}/form/`))}>
            <FileText /> {t("students.printForm")}
          </Button>
          <Button variant="outline" onClick={() => void report(openPdf(`/students/${enrollment.student.id}/card/`))}>
            <IdCard /> {t("students.printCard")}
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/students/${enrollment.student.id}?tab=documents`}>
              <Plus /> {t("enrollments.addDocuments")}
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="ghost" asChild>
            <Link to={`/students/${enrollment.student.id}`}>{t("enrollments.viewStudent")}</Link>
          </Button>
          <Button onClick={onAnother}>{t("enrollments.another")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnrollmentWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const currentYear = useCurrentYear();

  const [step, setStep] = useState<Step>("student");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [student, setStudent] = useState<StudentDraft>(emptyStudent);
  const [studentErrors, setStudentErrors] = useState<Partial<Record<keyof StudentDraft, string>>>({});
  const [existing, setExisting] = useState<StudentListItem | null>(null);
  const [guardians, setGuardians] = useState<GuardianDraft[]>([emptyGuardian("mother", true)]);
  const [guardianErrorList, setGuardianErrorList] = useState<Record<string, string>[]>([]);
  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<Kind>("new");
  const [previousSchool, setPreviousSchool] = useState("");
  const [notes, setNotes] = useState("");
  const [schoolingError, setSchoolingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Enrollment | null>(null);

  const effectiveYear = yearId ?? currentYear?.id ?? null;
  const { classes } = useYearClasses(effectiveYear);
  const chosenClass = classes.find((c) => c.id === classId) ?? null;
  const existingLinks = useGuardianLinks(existing?.id);
  const activeGuardians = guardians.filter((g) => g.mode === "existing" ? g.existing : g.first_name || g.last_name || g.phone || g.email);

  const next = () => {
    if (step === "student") {
      if (mode === "new") {
        const errors = validateStudent(student, t);
        setStudentErrors(errors);
        if (Object.keys(errors).length) return;
      } else if (!existing) {
        return;
      } else if (existing.current_enrollment && existing.current_enrollment.academic_year === effectiveYear) {
        toast.error(t("enrollments.alreadyEnrolled", { class: existing.current_enrollment.class_name }));
        return;
      }
      if (mode === "existing") setKind("re_enrolment");
      setStep("guardians");
    } else if (step === "guardians") {
      const errors = activeGuardians.map((g) => guardianErrors(g, t));
      const all = guardians.map((g) => (activeGuardians.includes(g) ? guardianErrors(g, t) : {}));
      setGuardianErrorList(all);
      if (errors.some((e) => Object.keys(e).length)) return;
      setStep("schooling");
    } else if (step === "schooling") {
      if (!classId) {
        setSchoolingError(t("validation.required"));
        return;
      }
      setSchoolingError(null);
      setStep("review");
    }
  };
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        ...(mode === "new" ? { student: studentPayload(student) } : { student_id: existing?.id }),
        guardians: activeGuardians.map(guardianPayload),
        class_group: classId,
        enrollment_date: date,
        kind,
        previous_school: previousSchool,
        notes,
      };
      const enrollment = await api.post<Enrollment>("/enrollments/register/", payload);
      await invalidateSchooling(queryClient);
      setResult(enrollment);
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("student");
    setMode("new");
    setStudent(emptyStudent);
    setExisting(null);
    setGuardians([emptyGuardian("mother", true)]);
    setClassId(null);
    setKind("new");
    setPreviousSchool("");
    setNotes("");
    setResult(null);
  };

  if (result) {
    return (
      <>
        <PageHeader title={t("enrollments.new")} />
        <Success enrollment={result} onAnother={reset} />
      </>
    );
  }

  const studentName = mode === "new" ? `${student.first_name} ${student.last_name}`.trim() : existing?.full_name ?? "";

  return (
    <>
      <PageHeader title={t("enrollments.new")} description={t("enrollments.subtitle")} />
      <Stepper step={step} />
      <Card className="max-w-4xl">
        <CardContent className="grid gap-6">
          {step === "student" && (
            <>
              <div className="bg-muted inline-flex w-fit rounded-lg p-1 text-sm">
                {(["new", "existing"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn("rounded-md px-3 py-1.5", mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                  >
                    {m === "new" ? t("enrollments.newStudent") : t("enrollments.existingStudent")}
                  </button>
                ))}
              </div>
              {mode === "new" ? (
                <StudentFields value={student} onChange={setStudent} errors={studentErrors} showNumber />
              ) : (
                <ExistingStudentPicker selected={existing} onSelect={setExisting} />
              )}
            </>
          )}

          {step === "guardians" && (
            <>
              {mode === "existing" && existingLinks.data && existingLinks.data.length > 0 && (
                <Alert>
                  <UserRound />
                  <AlertDescription>
                    {t("enrollments.guardiansExisting")}{" "}
                    {existingLinks.data.map((l) => `${l.guardian.full_name} (${t(`relationship.${l.relationship}`)})`).join(", ")}
                  </AlertDescription>
                </Alert>
              )}
              {guardians.map((g, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {t("students.guardian")} {index + 1}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.remove")}
                      onClick={() => setGuardians(guardians.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <GuardianFields
                    idPrefix={`g${index}`}
                    value={g}
                    errors={guardianErrorList[index]}
                    onChange={(value) => {
                      let nextList = guardians.map((item, i) => (i === index ? value : item));
                      if (value.is_primary && !g.is_primary) {
                        nextList = nextList.map((item, i) => (i === index ? item : { ...item, is_primary: false }));
                      }
                      setGuardians(nextList);
                    }}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() => setGuardians([...guardians, emptyGuardian(guardians.length === 0 ? "mother" : "father", guardians.length === 0)])}
              >
                <Plus /> {t("guardians.add")}
              </Button>
              {activeGuardians.length === 0 && mode === "new" && (
                <Alert>
                  <AlertTriangle />
                  <AlertDescription>{t("enrollments.noGuardiansWarning")}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {step === "schooling" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("classes.year")} htmlFor="w-year">
                <YearSelect id="w-year" value={effectiveYear} onChange={(v) => { setYearId(v); setClassId(null); }} />
              </Field>
              <Field label={t("enrollments.class")} htmlFor="w-class" error={schoolingError ?? undefined}>
                <ClassSelect id="w-class" yearId={effectiveYear} value={classId} onChange={setClassId} showPlaces />
              </Field>
              <Field label={t("common.date")} htmlFor="w-date">
                <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t("enrollments.kind")} htmlFor="w-kind">
                <OptionSelect
                  id="w-kind"
                  value={kind}
                  onChange={(v) => v && setKind(v)}
                  options={(["new", "re_enrolment", "transfer_in"] as const).map((k) => ({ value: k, label: t(`kind.${k}`) }))}
                />
              </Field>
              <Field label={t("enrollments.previousSchool")} htmlFor="w-prev" className="sm:col-span-2">
                <Input id="w-prev" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} />
              </Field>
              <Field label={t("enrollments.notes")} htmlFor="w-notes" className="sm:col-span-2">
                <Textarea id="w-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          )}

          {step === "review" && (
            <div className="grid gap-5">
              <p className="text-muted-foreground text-sm">{t("enrollments.reviewTitle")}</p>
              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{t("enrollments.steps.student")}</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <DetailGrid
                    items={[
                      { label: t("common.name"), value: studentName },
                      ...(mode === "new"
                        ? [
                            { label: t("students.gender"), value: student.gender ? t(`gender.${student.gender}`) : "" },
                            { label: t("students.dateOfBirth"), value: formatDate(student.date_of_birth || null) },
                          ]
                        : [{ label: t("students.number"), value: existing?.student_number ?? "" }]),
                    ]}
                  />
                </CardContent>
              </Card>
              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{t("enrollments.steps.guardians")}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 text-sm">
                  {activeGuardians.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="grid gap-1">
                      {activeGuardians.map((g, i) => (
                        <li key={i}>
                          <span className="font-medium">
                            {g.existing ? g.existing.full_name : `${g.first_name} ${g.last_name}`}
                          </span>{" "}
                          · {t(`relationship.${g.relationship}`)} · {g.existing ? g.existing.phone : g.phone || g.email}
                          {g.is_primary && ` · ${t("guardians.primary")}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{t("enrollments.steps.schooling")}</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <DetailGrid
                    items={[
                      { label: t("enrollments.class"), value: chosenClass ? `${chosenClass.name} · ${chosenClass.academic_year_name}` : "" },
                      { label: t("common.date"), value: formatDate(date) },
                      { label: t("enrollments.kind"), value: t(`kind.${kind}`) },
                      { label: t("enrollments.previousSchool"), value: previousSchool },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-between gap-2 border-t pt-4">
            <Button variant="outline" onClick={step === "student" ? () => navigate(-1) : back} disabled={busy}>
              {step === "student" ? t("common.cancel") : t("enrollments.back")}
            </Button>
            {step === "review" ? (
              <Button onClick={() => void submit()} disabled={busy}>
                {busy ? t("enrollments.submitting") : t("enrollments.submit")}
              </Button>
            ) : (
              <Button onClick={next} disabled={step === "student" && mode === "existing" && !existing}>
                {t("enrollments.next")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
