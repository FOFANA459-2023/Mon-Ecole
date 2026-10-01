import type { components } from "./schema";

type Schemas = components["schemas"];

export type Language = "fr" | "en";

export type SchoolSummary = {
  id: number;
  name: string;
  code: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  default_language: Language;
  idle_timeout_minutes: number;
};

export type RoleBrief = { id: number | null; key: string; name: string };

export type MembershipInfo = {
  school: SchoolSummary;
  roles: RoleBrief[];
  permissions: string[];
};

export type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  language: Language;
  must_change_password: boolean;
  is_platform_admin: boolean;
  memberships: MembershipInfo[];
};

export type SessionResponse = { access: string; user: Me };

export type PermissionGroup = {
  module: string;
  label: string;
  permissions: { code: string; label: string }[];
};

// Types generated from the backend OpenAPI schema (npm run gen:api).
export type School = Schemas["School"];
export type Role = Schemas["Role"];
export type Member = Schemas["Member"];
export type AuditLogEntry = Schemas["AuditLog"];
export type AcademicYear = Schemas["AcademicYear"];
export type Term = Schemas["Term"];
export type Level = Schemas["Level"];
export type ClassGroup = Schemas["ClassGroup"];
export type Subject = Schemas["Subject"];
export type ClassSubject = Schemas["ClassSubject"];
export type StudentListItem = Schemas["StudentList"];
export type Student = Schemas["Student"];
export type EnrollmentBrief = Schemas["EnrollmentBrief"];
export type Guardian = Schemas["Guardian"];
export type GuardianLink = Schemas["GuardianLink"];
export type Staff = Schemas["Staff"];
export type Enrollment = Schemas["Enrollment"];
export type SchoolDocument = Schemas["Document"];
export type PromoteResult = Schemas["PromoteResult"];
export type FeeCategory = Schemas["FeeCategory"];
export type FeeCategoryKind = Schemas["FeeCategoryKindEnum"];
export type FeeSchedule = Schemas["FeeSchedule"];
export type FeeAppliesTo = Schemas["FeeAppliesToEnum"];
export type StudentDiscount = Schemas["StudentDiscount"];
export type DiscountKind = Schemas["DiscountKindEnum"];
export type DiscountReason = Schemas["DiscountReasonEnum"];
export type Invoice = Schemas["Invoice"];
export type InvoiceListItem = Schemas["InvoiceList"];
export type PaymentStatus = Schemas["PaymentStatusEnum"];
export type GenerateInvoicesResult = Schemas["GenerateInvoicesResult"];
export type Payment = Schemas["Payment"];
export type PaymentListItem = Schemas["PaymentList"];
export type PaymentMethod = Schemas["PaymentMethodEnum"];
export type PaymentState = Schemas["PaymentStateEnum"];
export type StudentAccount = Schemas["StudentAccount"];
export type OpenLine = Schemas["OpenLine"];
export type Expense = Schemas["Expense"];
export type ExpenseCategory = Schemas["ExpenseCategoryEnum"];
export type ExpenseStatus = Schemas["ExpenseStatusEnum"];
export type Refund = Schemas["Refund"];
export type CashRegister = Schemas["CashRegister"];
export type CashSession = Schemas["CashSession"];
export type CashSessionDetail = Schemas["CashSessionDetail"];
export type CashMovement = Schemas["CashMovement"];
export type CashDirection = Schemas["CashDirectionEnum"];
export type CashSource = Schemas["CashSourceEnum"];
export type GradingScale = Schemas["GradingScale"];
export type ScaleBrief = Schemas["ScaleBrief"];
export type RankMethod = Schemas["RankMethodEnum"];
export type Gradebook = Schemas["Gradebook"];
export type GradebookDetail = Schemas["GradebookDetail"];
export type GradebookStatus = Schemas["GradebookStatusEnum"];
export type MissingPolicy = Schemas["MissingPolicyEnum"];
export type GradeCategory = Schemas["GradeCategory"];
export type GradeCategoryMethod = Schemas["GradeCategoryMethodEnum"];
export type Assessment = Schemas["Assessment"];
export type GradebookSheet = Schemas["GradebookSheet"];
export type SheetStudent = Schemas["SheetStudent"];
export type ClassResults = Schemas["ClassResults"];
export type AttendanceStatus = Schemas["AttendanceStatusEnum"];
export type StaffAttendanceStatus = Schemas["StaffAttendanceStatusEnum"];
export type DayClass = Schemas["DayClass"];
export type RegisterSheet = Schemas["RegisterSheet"];
export type RegisterStudent = Schemas["RegisterStudent"];
export type ClassMonth = Schemas["ClassMonth"];
export type AbsenceRow = Schemas["AbsenceRow"];
export type StudentAttendance = Schemas["StudentAttendance"];
export type StaffSheet = Schemas["StaffSheet"];

/** GET /reports/finance/{key}/: a report as titled sections of columns and rows. */
export type ReportKind = "text" | "money" | "number" | "percent" | "date" | "datetime" | "auto";
export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell> & { kind?: ReportKind };
export type ReportSection = {
  title: string;
  note: string;
  columns: { key: string; label: string; kind: ReportKind }[];
  rows: ReportRow[];
  row_count: number;
  truncated: boolean;
  totals: ReportRow | null;
};
export type FinanceReport = { key: string; title: string; subtitle: string; currency: string; sections: ReportSection[] };
export type PlatformSchool = Schemas["PlatformSchool"];
export type RegisterSchoolRequest = Schemas["RegisterSchoolRequest"];
export type AccountStatus = Schemas["AccountStatusEnum"];

export type Gender = "M" | "F";
export type Relationship = "father" | "mother" | "guardian" | "other";

export type DashboardSummary = {
  academic_year: { id: number; name: string } | null;
  /** "my_classes": the figures cover only the classes the user teaches or leads. */
  scope?: "school" | "my_classes";
  students?: number;
  students_male?: number;
  students_female?: number;
  classes?: number;
  capacity?: number | null;
  teachers?: number;
  staff?: number;
  new_enrollments_30d?: number;
  by_level?: { level_id: number; level: string; count: number }[];
};

export type SearchHit = { id: number; title: string; subtitle: string; status?: string; student_id?: number | null };
export type SearchResults = {
  students: SearchHit[];
  guardians: SearchHit[];
  staff: SearchHit[];
  classes: SearchHit[];
  receipts?: SearchHit[];
  invoices?: SearchHit[];
};

export type ImportResult = {
  total: number;
  valid: number;
  created: number;
  errors: { row: number; column: string; message: string }[];
  preview: Record<string, string | number | null>[];
  columns_found: string[];
  columns_missing: string[];
};
