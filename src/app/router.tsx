import { createBrowserRouter, Navigate, type RouteObject } from "react-router";

import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoonPage } from "@/features/modules/ComingSoonPage";
import { NotFoundPage } from "@/features/modules/NotFoundPage";
import { RouteErrorPage } from "@/features/modules/RouteErrorPage";

import { PublicOnly, RequireAuth, RequirePermission, RequirePlatformOwner } from "./guards";
import { AppLayout } from "./layout/AppLayout";
import { NAV_ITEMS, SETTINGS_TABS } from "./nav";

const access = (key: (typeof NAV_ITEMS)[number]["key"]) => NAV_ITEMS.find((item) => item.key === key)!.anyOf;
const tabAccess = (key: (typeof SETTINGS_TABS)[number]["key"]) => [
  ...SETTINGS_TABS.find((tab) => tab.key === key)!.anyOf,
];

/** A permission-gated group of lazily loaded pages. */
function gated(anyOf: string[], children: RouteObject[]): RouteObject {
  return { element: <RequirePermission anyOf={anyOf} />, children };
}

// Modules planned for later phases render a placeholder so the whole menu can be reviewed now.
const comingSoonRoutes: RouteObject[] = NAV_ITEMS.filter((item) => item.phase).map((item) =>
  gated(item.anyOf, [{ path: item.to.slice(1), element: <ComingSoonPage item={item} /> }]),
);

const phase2Routes: RouteObject[] = [
  gated(access("students"), [
    { path: "students", lazy: () => import("@/features/students/StudentsPage").then((m) => ({ Component: m.StudentsPage })) },
    {
      path: "students/:id",
      lazy: () => import("@/features/students/StudentDetailPage").then((m) => ({ Component: m.StudentDetailPage })),
    },
  ]),
  gated(["students.create"], [
    {
      path: "students/import",
      lazy: () =>
        import("@/features/imports/ImportPage").then((m) => ({ Component: () => <m.ImportPage kind="students" /> })),
    },
  ]),
  gated(access("enrollments"), [
    {
      path: "enrollments",
      lazy: () => import("@/features/enrollments/EnrollmentsPage").then((m) => ({ Component: m.EnrollmentsPage })),
    },
  ]),
  gated(["enrollments.create"], [
    {
      path: "enrollments/new",
      lazy: () =>
        import("@/features/enrollments/EnrollmentWizardPage").then((m) => ({ Component: m.EnrollmentWizardPage })),
    },
    {
      path: "enrollments/promote",
      lazy: () => import("@/features/enrollments/PromotePage").then((m) => ({ Component: m.PromotePage })),
    },
  ]),
  gated(access("classes"), [
    { path: "classes", lazy: () => import("@/features/classes/ClassesPage").then((m) => ({ Component: m.ClassesPage })) },
    {
      path: "classes/:id",
      lazy: () => import("@/features/classes/ClassDetailPage").then((m) => ({ Component: m.ClassDetailPage })),
    },
  ]),
  gated(access("subjects"), [
    { path: "subjects", lazy: () => import("@/features/subjects/SubjectsPage").then((m) => ({ Component: m.SubjectsPage })) },
  ]),
  gated(access("teachers"), [
    { path: "teachers", lazy: () => import("@/features/staff/StaffListPage").then((m) => ({ Component: m.StaffListPage })) },
    {
      path: "teachers/:id",
      lazy: () => import("@/features/staff/StaffDetailPage").then((m) => ({ Component: m.StaffDetailPage })),
    },
  ]),
  gated(["staff.create"], [
    {
      path: "teachers/import",
      lazy: () => import("@/features/imports/ImportPage").then((m) => ({ Component: () => <m.ImportPage kind="staff" /> })),
    },
  ]),
];

const phase3Routes: RouteObject[] = [
  gated(access("finance"), [
    {
      path: "finance",
      lazy: () => import("@/features/finance/FinanceLayout").then((m) => ({ Component: m.FinanceLayout })),
      children: [
        { index: true, element: <Navigate to="/finance/invoices" replace /> },
        {
          path: "invoices",
          lazy: () => import("@/features/finance/InvoicesPage").then((m) => ({ Component: m.InvoicesPage })),
        },
        {
          path: "invoices/:id",
          lazy: () => import("@/features/finance/InvoiceDetailPage").then((m) => ({ Component: m.InvoiceDetailPage })),
        },
        {
          path: "payments",
          lazy: () => import("@/features/finance/PaymentsPage").then((m) => ({ Component: m.PaymentsPage })),
        },
        {
          path: "payments/:id",
          lazy: () => import("@/features/finance/PaymentDetailPage").then((m) => ({ Component: m.PaymentDetailPage })),
        },
        { path: "fees", lazy: () => import("@/features/finance/FeesPage").then((m) => ({ Component: m.FeesPage })) },
        {
          path: "expenses",
          lazy: () => import("@/features/finance/ExpensesPage").then((m) => ({ Component: m.ExpensesPage })),
        },
        {
          path: "discounts",
          lazy: () => import("@/features/finance/DiscountsPage").then((m) => ({ Component: m.DiscountsPage })),
        },
        {
          path: "reports",
          lazy: () => import("@/features/finance/ReportsPage").then((m) => ({ Component: m.ReportsPage })),
        },
      ],
    },
  ]),
  gated(access("cashRegister"), [
    {
      path: "cash-register",
      lazy: () => import("@/features/cash/CashRegisterPage").then((m) => ({ Component: m.CashRegisterPage })),
    },
    {
      path: "cash-register/sessions/:id",
      lazy: () => import("@/features/cash/CashSessionPage").then((m) => ({ Component: m.CashSessionPage })),
    },
  ]),
];

const phase4Routes: RouteObject[] = [
  gated(access("attendance"), [
    {
      path: "attendance",
      lazy: () => import("@/features/attendance/AttendanceLayout").then((m) => ({ Component: m.AttendanceLayout })),
      children: [
        gated(["attendance.view"], [
          {
            index: true,
            lazy: () =>
              import("@/features/attendance/AttendanceDayPage").then((m) => ({ Component: m.AttendanceDayPage })),
          },
          {
            path: "reports",
            lazy: () =>
              import("@/features/attendance/AttendanceReportsPage").then((m) => ({
                Component: m.AttendanceReportsPage,
              })),
          },
        ]),
        gated(["attendance.staff"], [
          {
            path: "staff",
            lazy: () =>
              import("@/features/attendance/StaffAttendancePage").then((m) => ({ Component: m.StaffAttendancePage })),
          },
        ]),
      ],
    },
  ]),
  gated(["attendance.view"], [
    {
      path: "attendance/classes/:id",
      lazy: () => import("@/features/attendance/RegisterPage").then((m) => ({ Component: m.RegisterPage })),
    },
  ]),
  gated(access("assessments"), [
    {
      path: "assessments",
      lazy: () => import("@/features/grades/GradebooksPage").then((m) => ({ Component: m.GradebooksPage })),
    },
    {
      path: "assessments/:id",
      lazy: () => import("@/features/grades/GradebookPage").then((m) => ({ Component: m.GradebookPage })),
    },
  ]),
  gated(access("results"), [
    {
      path: "results",
      lazy: () => import("@/features/grades/ClassResultsPage").then((m) => ({ Component: m.ClassResultsPage })),
    },
  ]),
];

const pages: RouteObject[] = [
  {
    path: "/login",
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    path: "/verify-email",
    lazy: () => import("@/features/auth/VerifyEmailPage").then((m) => ({ Component: m.VerifyEmailPage })),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/change-password",
        lazy: () => import("@/features/auth/ChangePasswordPage").then((m) => ({ Component: m.ChangePasswordPage })),
      },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          ...phase2Routes,
          ...phase3Routes,
          ...phase4Routes,
          {
            element: <RequirePlatformOwner />,
            children: [
              {
                path: "platform",
                lazy: () =>
                  import("@/features/platform/PlatformSchoolsPage").then((m) => ({ Component: m.PlatformSchoolsPage })),
              },
            ],
          },
          ...comingSoonRoutes,
          {
            path: "account",
            lazy: () => import("@/features/account/AccountPage").then((m) => ({ Component: m.AccountPage })),
          },
          gated(access("settings"), [
            {
              path: "settings",
              lazy: () => import("@/features/settings/SettingsLayout").then((m) => ({ Component: m.SettingsLayout })),
              children: [
                {
                  index: true,
                  lazy: () =>
                    import("@/features/settings/SettingsLayout").then((m) => ({ Component: m.SettingsIndexRedirect })),
                },
                {
                  path: "school",
                  lazy: () =>
                    import("@/features/settings/SchoolProfilePage").then((m) => ({ Component: m.SchoolProfilePage })),
                },
                {
                  path: "academic",
                  lazy: () =>
                    import("@/features/settings/AcademicSettingsPage").then((m) => ({
                      Component: m.AcademicSettingsPage,
                    })),
                },
                gated(tabAccess("users"), [
                  {
                    path: "users",
                    lazy: () => import("@/features/settings/UsersPage").then((m) => ({ Component: m.UsersPage })),
                  },
                  {
                    path: "roles",
                    lazy: () => import("@/features/settings/RolesPage").then((m) => ({ Component: m.RolesPage })),
                  },
                ]),
                gated(tabAccess("audit"), [
                  {
                    path: "audit",
                    lazy: () => import("@/features/settings/AuditLogPage").then((m) => ({ Component: m.AuditLogPage })),
                  },
                ]),
              ],
            },
          ]),
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

// One pathless parent catches any page crash and shows a plain message instead of React Router's screen.
export const routes: RouteObject[] = [{ errorElement: <RouteErrorPage />, children: pages }];

export const router = createBrowserRouter(routes);
