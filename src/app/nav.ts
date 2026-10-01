import {
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardPen,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  School,
  Settings,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "enrollments"
  | "students"
  | "administration"
  | "classes"
  | "subjects"
  | "teachers"
  | "finance"
  | "cashRegister"
  | "attendance"
  | "assessments"
  | "results";

export type NavItem = {
  key: "dashboard" | "settings" | ModuleKey;
  to: string;
  icon: LucideIcon;
  /** Visible when the user has any of these permissions. Empty = everyone. */
  anyOf: string[];
  /** Delivery phase for modules that are not built yet. */
  phase?: number;
};

// Menu order follows the Terms of Reference (§4).
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", to: "/", icon: LayoutDashboard, anyOf: [] },
  { key: "enrollments", to: "/enrollments", icon: UserPlus, anyOf: ["enrollments.view"] },
  { key: "students", to: "/students", icon: GraduationCap, anyOf: ["students.view"] },
  { key: "administration", to: "/administration", icon: Building2, anyOf: ["administration.view"], phase: 5 },
  { key: "classes", to: "/classes", icon: School, anyOf: ["classes.view"] },
  { key: "subjects", to: "/subjects", icon: BookOpen, anyOf: ["subjects.view"] },
  { key: "teachers", to: "/teachers", icon: Users, anyOf: ["staff.view"] },
  { key: "finance", to: "/finance", icon: Wallet, anyOf: ["finance.view"] },
  { key: "cashRegister", to: "/cash-register", icon: Landmark, anyOf: ["cash.view"] },
  { key: "attendance", to: "/attendance", icon: CalendarCheck, anyOf: ["attendance.view"], phase: 4 },
  { key: "assessments", to: "/assessments", icon: ClipboardPen, anyOf: ["grades.view"] },
  { key: "results", to: "/results", icon: Award, anyOf: ["grades.view"] },
  { key: "settings", to: "/settings", icon: Settings, anyOf: ["settings.manage", "users.manage", "audit.view"] },
];

export const SETTINGS_TABS = [
  { key: "school", to: "/settings/school", anyOf: [] as string[] },
  { key: "academic", to: "/settings/academic", anyOf: [] as string[] },
  { key: "users", to: "/settings/users", anyOf: ["users.manage"] },
  { key: "roles", to: "/settings/roles", anyOf: ["users.manage"] },
  { key: "audit", to: "/settings/audit", anyOf: ["audit.view"] },
] as const;
