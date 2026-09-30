import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { StaffFormDialog } from "./StaffFormDialog";

const roles = [
  { id: 1, key: "director", name: "School Director / Principal", is_system: true, permissions: [], member_count: 1 },
  { id: 2, key: "admin_staff", name: "Administrative Staff", is_system: true, permissions: [], member_count: 0 },
  { id: 3, key: "accountant", name: "Accountant", is_system: true, permissions: [], member_count: 0 },
  { id: 4, key: "teacher", name: "Teacher", is_system: true, permissions: [], member_count: 0 },
  { id: 5, key: "parent", name: "Parent / Guardian", is_system: true, permissions: [], member_count: 0 },
];

function staffApi() {
  let body: Record<string, unknown> | null = null;
  server.use(
    http.get(api("/roles/"), () => HttpResponse.json(roles)),
    http.get(api("/subjects/"), () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
    http.post(api("/staff/"), async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: 21, ...body }, { status: 201 });
    }),
  );
  return () => body;
}

async function chooseRole(dialog: HTMLElement, name: string) {
  await userEvent.click(within(dialog).getByRole("combobox", { name: "Role" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("StaffFormDialog (adding someone)", () => {
  it("never offers the Director or Parent roles", async () => {
    staffApi();
    renderPage(<StaffFormDialog onClose={vi.fn()} />, { permissions: ["staff.create", "users.manage"] });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Role" }));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toEqual(["Administrative Staff", "Accountant", "Teacher"]);
  });

  it("requires the email and role that the invitation needs", async () => {
    const posted = staffApi();
    renderPage(<StaffFormDialog onClose={vi.fn()} />, { permissions: ["staff.create", "users.manage"] });
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Sylla");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "First name" }), "Kadiatou");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("An email address is needed to send the invitation.")).toBeInTheDocument();
    expect(posted()).toBeNull();
  });

  it("adds a teacher with their role, login email and teaching", async () => {
    const posted = staffApi();
    const onClose = vi.fn();
    renderPage(<StaffFormDialog onClose={onClose} />, { permissions: ["staff.create", "users.manage"] });
    const dialog = await screen.findByRole("dialog");
    await chooseRole(dialog, "Teacher");
    // Choosing the role sets the staff type and opens the teaching section.
    expect(within(dialog).getByRole("combobox", { name: "Staff type" })).toHaveTextContent("Teacher");
    expect(within(dialog).getByText("Teaching this school year")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Email (used to sign in)" }), "k.sylla@test.local");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Sylla");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "First name" }), "Kadiatou");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted()).toMatchObject({
      role_id: 4,
      email: "k.sylla@test.local",
      staff_type: "teacher",
      teaching: { homeroom_class_ids: [], subjects: [] },
    });
  });

  it("does not send teaching for an accountant", async () => {
    const posted = staffApi();
    const onClose = vi.fn();
    renderPage(<StaffFormDialog onClose={onClose} />, { permissions: ["staff.create", "users.manage"] });
    const dialog = await screen.findByRole("dialog");
    await chooseRole(dialog, "Accountant");
    expect(within(dialog).queryByText("Teaching this school year")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Email (used to sign in)" }), "compta@test.local");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Keita");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "First name" }), "Sékou");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted()).toMatchObject({ role_id: 3, staff_type: "administrative" });
    expect(posted()).not.toHaveProperty("teaching");
  });
});
