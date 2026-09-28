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

export type Gender = "M" | "F";
export type Relationship = "father" | "mother" | "guardian" | "other";

export type DashboardSummary = {
  academic_year: { id: number; name: string } | null;
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
export type SearchResults = { students: SearchHit[]; guardians: SearchHit[]; staff: SearchHit[]; classes: SearchHit[] };

export type ImportResult = {
  total: number;
  valid: number;
  created: number;
  errors: { row: number; column: string; message: string }[];
  preview: Record<string, string | number | null>[];
  columns_found: string[];
  columns_missing: string[];
};
