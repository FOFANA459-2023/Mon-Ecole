import type { components } from "./schema";

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
export type School = components["schemas"]["School"];
export type Role = components["schemas"]["Role"];
export type Member = components["schemas"]["Member"];
export type AuditLogEntry = components["schemas"]["AuditLog"];
