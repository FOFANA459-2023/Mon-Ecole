import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { authValue } from "@/test/auth";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { VerifyEmailPage } from "./VerifyEmailPage";

const renderVerify = (path: string) =>
  renderPage(<VerifyEmailPage />, {
    path,
    auth: authValue(null),
    routes: [{ path: "/login", element: <p>Login page</p> }],
  });

describe("VerifyEmailPage", () => {
  it("confirms the address and sends the person to sign in", async () => {
    let body: unknown = null;
    server.use(
      http.post(api("/auth/verify-email/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ email: "fanta@espoir.test" });
      }),
    );
    renderVerify("/verify-email?token=abc123");
    expect(await screen.findByText(/fanta@espoir.test is confirmed/)).toBeInTheDocument();
    expect(body).toEqual({ token: "abc123" });
    await userEvent.click(screen.getByRole("link", { name: "Sign in" }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("explains an expired or invalid link", async () => {
    server.use(
      http.post(api("/auth/verify-email/"), () =>
        HttpResponse.json(
          { code: "validation_error", message: "This link is invalid or has expired.", fields: {} },
          { status: 400 },
        ),
      ),
    );
    renderVerify("/verify-email?token=old");
    expect(await screen.findByText("This link is invalid or has expired.")).toBeInTheDocument();
  });

  it("does not call the server without a token", () => {
    renderVerify("/verify-email");
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});
