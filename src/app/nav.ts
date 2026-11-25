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

/** Menu sections, in order: the menu reads as the school's day rather than a list of modules. */
export const NAV_GROUPS = ["overview", "schoolLife", "teaching", "money", "office"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavItem = {
  key: "dashboard" | "settings" | ModuleKey;
  group: NavGroup;
  to: string;
  icon: LucideIcon;
  /** Visible when the user has any of these permissions. Empty = everyone. */
  anyOf: string[];
  /** Delivery phase for modules that are not built yet. */
  phase?: number;
};

// Every module of the Terms of Reference (§4), grouped by task.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", group: "overview", to: "/", icon: LayoutDashboard, anyOf: [] },
  { key: "enrollments", group: "schoolLife", to: "/enrollments", icon: UserPlus, anyOf: ["enrollments.view"] },
  { key: "students", group: "schoolLife", to: "/students", icon: GraduationCap, anyOf: ["students.view"] },
  {
    key: "attendance",
    group: "schoolLife",
    to: "/attendance",
    icon: CalendarCheck,
    anyOf: ["attendance.view", "attendance.staff"],
  },
  { key: "classes", group: "teaching", to: "/classes", icon: School, anyOf: ["classes.view"] },
  { key: "subjects", group: "teaching", to: "/subjects", icon: BookOpen, anyOf: ["subjects.view"] },
  { key: "teachers", group: "teaching", to: "/teachers", icon: Users, anyOf: ["staff.view"] },
  { key: "assessments", group: "teaching", to: "/assessments", icon: ClipboardPen, anyOf: ["grades.view"] },
  { key: "results", group: "teaching", to: "/results", icon: Award, anyOf: ["grades.view"] },
  { key: "finance", group: "money", to: "/finance", icon: Wallet, anyOf: ["finance.view"] },
  { key: "cashRegister", group: "money", to: "/cash-register", icon: Landmark, anyOf: ["cash.view"] },
  { key: "administration", group: "office", to: "/administration", icon: Building2, anyOf: ["administration.view"] },
  {
    key: "settings",
    group: "office",
    to: "/settings",
    icon: Settings,
    anyOf: ["settings.manage", "users.manage", "audit.view"],
  },
];

export const SETTINGS_TABS = [
  { key: "school", to: "/settings/school", anyOf: [] as string[] },
  { key: "academic", to: "/settings/academic", anyOf: [] as string[] },
  { key: "users", to: "/settings/users", anyOf: ["users.manage"] },
  { key: "roles", to: "/settings/roles", anyOf: ["users.manage"] },
  { key: "audit", to: "/settings/audit", anyOf: ["audit.view"] },
] as const;
