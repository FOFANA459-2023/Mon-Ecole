import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { authValue, makeUser } from "@/test/auth";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { PlatformSchoolsPage } from "./PlatformSchoolsPage";

const horizon = {
  id: 10,
  name: "Groupe Scolaire Horizon",
  code: "horizon",
  country: "GN",
  currency: "GNF",
  timezone: "Africa/Conakry",
  default_language: "fr",
  status: "active",
  created_at: "2026-09-01T10:00:00Z",
  student_count: 220,
  member_count: 12,
  directors: [
    { id: 3, full_name: "Mamadou Camara", email: "directeur@horizon.test", phone: "", account_status: "pending", is_active: true },
  ],
};

const owner = authValue(makeUser([], { is_platform_admin: true }));

function schoolsApi() {
  server.use(http.get(api("/platform/schools/"), () => HttpResponse.json(page([horizon]))));
}

describe("PlatformSchoolsPage", () => {
  it("lists every school with its Director and their invitation status", async () => {
    schoolsApi();
    renderPage(<PlatformSchoolsPage />, { path: "/platform", auth: owner });
    expect(await screen.findByText("Groupe Scolaire Horizon")).toBeInTheDocument();
    expect(screen.getByText("Mamadou Camara")).toBeInTheDocument();
    expect(screen.getByText("Invitation sent")).toBeInTheDocument();
    expect(screen.getByText(/Guinea · GNF · Français/)).toBeInTheDocument();
  });

  it("registers a school with its Director in the school's language", async () => {
    schoolsApi();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/platform/schools/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...horizon, id: 11, name: "Bright Future", code: "bright" }, { status: 201 });
      }),
    );
    renderPage(<PlatformSchoolsPage />, { path: "/platform", auth: owner });
    await userEvent.click(await screen.findByRole("button", { name: /Register a school/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "School" }), "Bright Future");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Short code" }), "bright");
    // Choosing Liberia switches the currency and language defaults.
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Country" }));
    await userEvent.click(await screen.findByRole("option", { name: "Liberia" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "First name" }), "Grace");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Tubman");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Email" }), "grace@bright.test");
    await userEvent.click(within(dialog).getByRole("button", { name: "Register the school" }));
    await waitFor(() =>
      expect(body).toEqual({
        name: "Bright Future",
        code: "bright",
        country: "LR",
        currency: "LRD",
        default_language: "en",
        timezone: "Africa/Monrovia",
        director: { first_name: "Grace", last_name: "Tubman", email: "grace@bright.test", phone: "" },
      }),
    );
  });

  it("checks the code format before sending", async () => {
    schoolsApi();
    let posted = false;
    server.use(
      http.post(api("/platform/schools/"), () => {
        posted = true;
        return HttpResponse.json(horizon, { status: 201 });
      }),
    );
    renderPage(<PlatformSchoolsPage />, { path: "/platform", auth: owner });
    await userEvent.click(await screen.findByRole("button", { name: /Register a school/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Short code" }), "Bad Code!");
    await userEvent.click(within(dialog).getByRole("button", { name: "Register the school" }));
    expect(await within(dialog).findByText("Use lowercase letters, digits and dashes only.")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("suspends a Director and adds another one", async () => {
    let body: Record<string, unknown> | null = null;
    let invited: Record<string, unknown> | null = null;
    schoolsApi();
    server.use(
      http.post(api("/platform/schools/10/directors/change/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(horizon);
      }),
      http.post(api("/platform/schools/10/directors/"), async ({ request }) => {
        invited = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(horizon, { status: 201 });
      }),
    );
    renderPage(<PlatformSchoolsPage />, { path: "/platform", auth: owner });
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Directors \/ Principals/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Suspend/ }));
    await waitFor(() => expect(body).toEqual({ user_id: 3, action: "suspend" }));

    await userEvent.click(within(dialog).getByRole("button", { name: /Add a Director/ }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "First name" }), "Aissatou");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Bah");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Email" }), "aissatou@horizon.test");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send the invitation" }));
    await waitFor(() => expect(invited).toMatchObject({ email: "aissatou@horizon.test", last_name: "Bah" }));
  });

  it("deletes a suspended school only once its code is typed", async () => {
    let confirmCode: unknown = null;
    server.use(
      http.get(api("/platform/schools/"), () => HttpResponse.json(page([{ ...horizon, status: "suspended" }]))),
      http.post(api("/platform/schools/10/delete/"), async ({ request }) => {
        confirmCode = ((await request.json()) as { confirm_code: string }).confirm_code;
        return HttpResponse.json({ ...horizon, status: "deleting" }, { status: 202 });
      }),
    );
    renderPage(<PlatformSchoolsPage />, { path: "/platform", auth: owner });
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete the school/ }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete for good" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "horizon");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(confirmCode).toBe("horizon"));
  });
});
