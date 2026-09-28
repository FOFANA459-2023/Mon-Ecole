import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { authValue, makeUser, WithAuth } from "@/test/auth";

import { LoginPage } from "./LoginPage";

function renderLogin(login = vi.fn(), initialPath = "/login") {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/", element: <p>Dashboard</p> },
      { path: "/settings/users", element: <p>Users page</p> },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <WithAuth value={authValue(null, { login })}>
      <RouterProvider router={router} />
    </WithAuth>,
  );
  return { login };
}

describe("LoginPage", () => {
  it("asks for both fields before calling the API", async () => {
    const { login } = renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findAllByText("This field is required.")).toHaveLength(2);
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in and goes to the requested page", async () => {
    const login = vi.fn().mockResolvedValue(makeUser([]));
    renderLogin(login, "/login?next=%2Fsettings%2Fusers");

    await userEvent.type(screen.getByLabelText("Email or username"), "awa@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "Correct-Horse-2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith("awa@test.local", "Correct-Horse-2026");
    expect(await screen.findByText("Users page")).toBeInTheDocument();
  });

  it("never redirects to another site after sign-in", async () => {
    const login = vi.fn().mockResolvedValue(makeUser([]));
    renderLogin(login, "/login?next=%2F%2Fevil.example");
    await userEvent.type(screen.getByLabelText("Email or username"), "awa");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("explains wrong credentials", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, { code: "invalid_credentials", message: "x", fields: {} }));
    renderLogin(login);
    await userEvent.type(screen.getByLabelText("Email or username"), "awa");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Incorrect login or password.")).toBeInTheDocument();
  });
});
