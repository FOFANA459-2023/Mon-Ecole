import { useQuery } from "@tanstack/react-query";

import { useSchoolId } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type {
  AbsenceRow,
  AttendanceStatus,
  ClassMonth,
  DayClass,
  RegisterSheet,
  StaffAttendanceStatus,
  StaffSheet,
  StudentAttendance,
} from "@/lib/api/types";

/** Every attendance query key starts with "attendance": saving a register refreshes the day and reports. */
export const ATTENDANCE_KEY = "attendance";

export const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];
export const STAFF_STATUSES: StaffAttendanceStatus[] = ["present", "absent", "late", "excused", "leave"];

/** Today as YYYY-MM-DD in the school's time zone. */
export function todayIn(timeZone?: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function useAttendanceDay(date: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "day", date],
    queryFn: ({ signal }) => api.get<DayClass[]>("/attendance/day/", { date }, signal),
    enabled: schoolId !== null,
  });
}

export function useRegister(classId: number | undefined, date: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "register", classId, date],
    queryFn: ({ signal }) =>
      api.get<RegisterSheet>("/attendance/register/", { class_group: classId, date }, signal),
    enabled: schoolId !== null && classId !== undefined,
  });
}

export function useClassMonth(classId: number | null, month: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "month", classId, month],
    queryFn: ({ signal }) =>
      api.get<ClassMonth>("/attendance/class-month/", { class_group: classId, month }, signal),
    enabled: schoolId !== null && classId !== null && /^\d{4}-\d{2}$/.test(month),
  });
}

export function useAbsences(params: { date_from: string; date_to: string; class_group: number | null; min_absences: number }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "absences", params],
    queryFn: ({ signal }) =>
      api.get<AbsenceRow[]>(
        "/attendance/absences/",
        { ...params, class_group: params.class_group ?? undefined },
        signal,
      ),
    enabled: schoolId !== null && Boolean(params.date_from && params.date_to),
  });
}

export function useStudentAttendance(studentId: number, yearId: number | null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "student", studentId, yearId],
    queryFn: ({ signal }) =>
      api.get<StudentAttendance>(`/attendance/students/${studentId}/`, { academic_year: yearId ?? undefined }, signal),
    enabled: schoolId !== null,
    retry: false,
  });
}

export function useStaffSheet(date: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: [ATTENDANCE_KEY, schoolId, "staff", date],
    queryFn: ({ signal }) => api.get<StaffSheet>("/attendance/staff/", { date }, signal),
    enabled: schoolId !== null,
  });
}

/** Colours of the statuses (staff add "leave"), shared by buttons, badges and the month grid. */
export const STATUS_STYLES: Record<string, { on: string; soft: string }> = {
  present: { on: "bg-success text-white border-success", soft: "bg-success/15 text-success" },
  absent: { on: "bg-destructive text-white border-destructive", soft: "bg-destructive/10 text-destructive" },
  late: {
    on: "bg-amber-500 text-white border-amber-500",
    soft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  excused: { on: "bg-sky-600 text-white border-sky-600", soft: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  leave: {
    on: "bg-violet-600 text-white border-violet-600",
    soft: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
};
