import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { YearSwitcher } from "@/features/academics/YearSwitcher";
import { LoginPage } from "@/features/auth/LoginPage";
import { ClassesPage } from "@/features/classes/ClassesPage";
import { DirectorsDialog } from "@/features/platform/PlatformSchoolDialogs";
import type { PlatformSchool } from "@/lib/api/types";
import { authValue } from "@/test/auth";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { AcademicSettingsPage } from "./AcademicSettingsPage";
import { UsersPage } from "./UsersPage";

const member = (id: number, name: string, roleKey: string, roleName: string) => ({
  id,
  user: {
    id: id + 100,
    username: `${roleKey}${id}@test.local`,
    email: `${roleKey}${id}@test.local`,
    first_name: name,
    last_name: "",
    full_name: name,
    phone: "",
    language: "fr",
    last_login: null,
    account_status: "active",
  },
  roles: [{ id: id, key: roleKey, name: roleName }],
  is_active: true,
  created_at: "2026-09-01T10:00:00Z",
});

describe("UsersPage", () => {
  it("removes a teacher for good, but offers nothing against a Director", async () => {
    let removed = false;
    server.use(
      http.get(api("/users/"), () =>
        HttpResponse.json(page([member(1, "Fanta Camara", "teacher", "Teacher"), member(2, "Awa Diallo", "director", "Director")])),
      ),
      http.get(api("/roles/"), () => HttpResponse.json([])),
      http.delete(api("/users/1/"), () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<UsersPage />, { permissions: ["users.manage"] });

    const director = (await screen.findByText("Awa Diallo")).closest("tr")!;
    await userEvent.click(within(director).getByRole("button", { name: "Actions" }));
    expect(screen.queryByRole("menuitem", { name: /Suspend|Remove/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const teacher = screen.getByText("Fanta Camara").closest("tr")!;
    await userEvent.click(within(teacher).getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: /Suspend/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /Remove from the school/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove from the school" }));
    await waitFor(() => expect(removed).toBe(true));
  });
});

describe("Forgotten passwords: reset by hand, never by email", () => {
  it("lets the principal give a teacher a temporary password, but not another Director", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/users/"), () =>
        HttpResponse.json(page([member(1, "Fanta Camara", "teacher", "Teacher"), member(2, "Awa Diallo", "director", "Director")])),
      ),
      http.get(api("/roles/"), () => HttpResponse.json([])),
      http.post(api("/users/1/reset-password/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<UsersPage />, { permissions: ["users.manage"] });

    const director = (await screen.findByText("Awa Diallo")).closest("tr")!;
    await userEvent.click(within(director).getByRole("button", { name: "Actions" }));
    expect(screen.queryByRole("menuitem", { name: /Reset password/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const teacher = screen.getByText("Fanta Camara").closest("tr")!;
    await userEvent.click(within(teacher).getByRole("button", { name: "Actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Reset password/ }));
    const dialog = await screen.findByRole("dialog", { name: /Reset the password of Fanta Camara/ });
    const input = within(dialog).getByLabelText("Temporary password");
    await userEvent.clear(input);
    await userEvent.type(input, "Bienvenue-2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set the password" }));
    await waitFor(() => expect(body).toEqual({ new_password: "Bienvenue-2026" }));
    expect(await within(dialog).findByText("Bienvenue-2026")).toBeInTheDocument();
  });

  it("lets the platform administrator reset a principal's password", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/platform/schools/5/directors/reset-password/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const school = {
      id: 5,
      name: "Les Palmiers",
      directors: [
        { id: 42, full_name: "Awa Diallo", email: "awa@test.local", phone: "", account_status: "active", is_active: true },
      ],
    } as unknown as PlatformSchool;
    renderPage(<DirectorsDialog school={school} onClose={() => undefined} />);
    await userEvent.click(await screen.findByRole("button", { name: "Reset the password of Awa Diallo" }));
    const dialog = await screen.findByRole("dialog", { name: /Reset the password of Awa Diallo/ });
    await userEvent.click(within(dialog).getByRole("button", { name: "Set the password" }));
    await waitFor(() => expect(body).toMatchObject({ user_id: 42 }));
    expect(String(body!["new_password"])).toMatch(/^\w{4}-\w{4}-\w{4}$/);
  });

  it("tells someone who forgot their password who to ask, without any email link", async () => {
    renderPage(<LoginPage />, { auth: authValue(null) });
    await userEvent.click(await screen.findByText("Forgot your password?"));
    expect(screen.getByText(/Ask your school's principal for a temporary password/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /Forgot/ })).not.toBeInTheDocument();
  });
});

describe("YearSwitcher", () => {
  it("switches every page to the school year picked in the top bar", async () => {
    localStorage.clear();
    const years = [
      { id: 1, name: "2026-2027", start_date: "2026-09-01", end_date: "2027-06-30", is_current: true, status: "open", terms: [] },
      { id: 2, name: "2025-2026", start_date: "2025-09-01", end_date: "2026-06-30", is_current: false, status: "closed", terms: [] },
    ];
    const asked: (string | null)[] = [];
    server.use(
      http.get(api("/academic-years/"), () => HttpResponse.json(years)),
      http.get(api("/levels/"), () => HttpResponse.json([])),
      http.get(api("/classes/"), ({ request }) => {
        asked.push(new URL(request.url).searchParams.get("academic_year"));
        return HttpResponse.json(page([]));
      }),
    );
    renderPage(
      <>
        <YearSwitcher />
        <ClassesPage />
      </>,
      { permissions: ["classes.view_all"] },
    );
    const switcher = await screen.findByRole("combobox", { name: "School year shown on every page" });
    await waitFor(() => expect(asked).toContain("1"));
    await userEvent.click(switcher);
    await userEvent.click(await screen.findByRole("option", { name: "2025-2026" }));
    await waitFor(() => expect(asked.at(-1)).toBe("2"));
    expect(switcher).toHaveTextContent("not current");
    localStorage.clear();
  });
});

describe("AcademicSettingsPage — starting a new year", () => {
  it("asks who continues and sends the team that stays", async () => {
    let body: Record<string, unknown> | null = null;
    const years = [
      { id: 1, name: "2026-2027", start_date: "2026-09-01", end_date: "2027-06-30", is_current: true, status: "open", terms: [] },
      { id: 2, name: "2027-2028", start_date: "2027-09-01", end_date: "2028-06-30", is_current: false, status: "open", terms: [] },
    ];
    const staff = (id: number, full_name: string, is_director = false) => ({
      id,
      full_name,
      first_name: full_name,
      last_name: "",
      staff_type: "teacher",
      position: "",
      status: "active",
      is_director,
      has_access: true,
    });
    server.use(
      http.get(api("/academic-years/"), () => HttpResponse.json(years)),
      http.get(api("/levels/"), () => HttpResponse.json([])),
      http.get(api("/grading-scales/"), () => HttpResponse.json([])),
      http.get(api("/staff/"), () =>
        HttpResponse.json(page([staff(7, "Awa Diallo", true), staff(8, "Ibrahima Sow"), staff(9, "Fanta Camara")])),
      ),
      http.post(api("/academic-years/2/set-current/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...years[1], is_current: true });
      }),
    );
    renderPage(<AcademicSettingsPage />, { permissions: ["settings.manage", "staff.archive"] });

    const next = (await screen.findByText("2027-2028")).closest("div.rounded-lg")! as HTMLElement;
    await userEvent.click(within(next).getByRole("button", { name: "Actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /current/i }));
    const dialog = await screen.findByRole("dialog", { name: /Start 2027-2028/ });
    expect(within(dialog).getByRole("checkbox", { name: /Awa Diallo/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Fanta Camara/ }));
    expect(within(dialog).getByText("2 continue · 1 leave")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Start 2027-2028" }));
    await waitFor(() => expect(body).toEqual({ continuing_staff_ids: [7, 8] }));
  });
});
