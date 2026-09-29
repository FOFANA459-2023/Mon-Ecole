import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import type { AuthContextValue } from "@/lib/auth/context";
import { authValue, makeUser, WithAuth } from "@/test/auth";

import { RequireAuth, RequirePermission } from "./guards";

function renderAt(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>Login page</p> },
      { path: "/change-password", element: <p>Change password page</p> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <p>Dashboard</p> },
          { path: "/students", element: <p>Students</p> },
          {
            element: <RequirePermission anyOf={["users.manage"]} />,
            children: [{ path: "/settings/users", element: <p>Users</p> }],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <WithAuth value={auth}>
      <RouterProvider router={router} />
    </WithAuth>,
  );
  return router;
}

describe("RequireAuth", () => {
  it("sends visitors to sign in and remembers where they were going", async () => {
    const router = renderAt("/students?q=awa", authValue(null));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/students?q=awa")}`);
  });

  it("shows the page to signed-in users", async () => {
    renderAt("/students", authValue(makeUser(["students.view"])));
    expect(await screen.findByText("Students")).toBeInTheDocument();
  });

  it("forces a pending password change first", async () => {
    renderAt("/students", authValue(makeUser([], { must_change_password: true })));
    expect(await screen.findByText("Change password page")).toBeInTheDocument();
  });

  it("explains when the account has no school", async () => {
    renderAt("/", authValue(makeUser([], { memberships: [] })));
    expect(await screen.findByText("No school")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });
});

describe("RequirePermission", () => {
  it("lets users with the permission in", async () => {
    renderAt("/settings/users", authValue(makeUser(["users.manage"])));
    expect(await screen.findByText("Users")).toBeInTheDocument();
  });

  it("sends everyone else back to the dashboard", async () => {
    renderAt("/settings/users", authValue(makeUser(["students.view"])));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});
