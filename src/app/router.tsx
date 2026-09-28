import { createBrowserRouter, type RouteObject } from "react-router";

import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoonPage } from "@/features/modules/ComingSoonPage";
import { NotFoundPage } from "@/features/modules/NotFoundPage";

import { PublicOnly, RequireAuth, RequirePermission } from "./guards";
import { AppLayout } from "./layout/AppLayout";
import { NAV_ITEMS, SETTINGS_TABS } from "./nav";

const settingsAccess = NAV_ITEMS.find((item) => item.key === "settings")!.anyOf;
const tabAccess = (key: (typeof SETTINGS_TABS)[number]["key"]) => [
  ...SETTINGS_TABS.find((tab) => tab.key === key)!.anyOf,
];

// Modules planned for later phases render a placeholder so the whole menu can be reviewed now.
const moduleRoutes: RouteObject[] = NAV_ITEMS.filter((item) => item.phase).map((item) => ({
  element: <RequirePermission anyOf={item.anyOf} />,
  children: [{ path: item.to.slice(1), element: <ComingSoonPage item={item} /> }],
}));

export const routes: RouteObject[] = [
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
          ...moduleRoutes,
          {
            path: "account",
            lazy: () => import("@/features/account/AccountPage").then((m) => ({ Component: m.AccountPage })),
          },
          {
            element: <RequirePermission anyOf={settingsAccess} />,
            children: [
              {
                path: "settings",
                lazy: () =>
                  import("@/features/settings/SettingsLayout").then((m) => ({ Component: m.SettingsLayout })),
                children: [
                  {
                    index: true,
                    lazy: () =>
                      import("@/features/settings/SettingsLayout").then((m) => ({
                        Component: m.SettingsIndexRedirect,
                      })),
                  },
                  {
                    path: "school",
                    lazy: () =>
                      import("@/features/settings/SchoolProfilePage").then((m) => ({
                        Component: m.SchoolProfilePage,
                      })),
                  },
                  {
                    element: <RequirePermission anyOf={tabAccess("users")} />,
                    children: [
                      {
                        path: "users",
                        lazy: () =>
                          import("@/features/settings/UsersPage").then((m) => ({ Component: m.UsersPage })),
                      },
                      {
                        path: "roles",
                        lazy: () =>
                          import("@/features/settings/RolesPage").then((m) => ({ Component: m.RolesPage })),
                      },
                    ],
                  },
                  {
                    element: <RequirePermission anyOf={tabAccess("audit")} />,
                    children: [
                      {
                        path: "audit",
                        lazy: () =>
                          import("@/features/settings/AuditLogPage").then((m) => ({ Component: m.AuditLogPage })),
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
