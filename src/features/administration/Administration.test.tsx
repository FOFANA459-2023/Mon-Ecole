import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { monthRange, shiftMonth } from "./api";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { CalendarPage } from "./CalendarPage";
import { DepartmentsPage } from "./DepartmentsPage";

const announcement = {
  id: 1,
  title: "Rentrée",
  body: "Lundi 8 h.",
  priority: "important",
  roles: [],
  role_names: [],
  publish_at: "2026-10-01T08:00:00Z",
  expires_on: null,
  pinned: true,
  is_published: true,
  author_name: "Mamadou Camara",
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

describe("month helpers", () => {
  it("give a month's first and last day and move between months", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("AnnouncementsPage", () => {
  it("shows the announcements meant for a member, without the managing buttons", async () => {
    let query = "";
    server.use(
      http.get(api("/announcements/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(page([announcement]));
      }),
    );
    renderPage(<AnnouncementsPage />, { permissions: [] });
    expect(await screen.findByText("Rentrée")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByText(/Everyone/)).toBeInTheDocument();
    expect(query).not.toContain("manage");
    expect(screen.queryByRole("button", { name: /New announcement/ })).not.toBeInTheDocument();
  });

  it("lets a manager write one for some roles", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/announcements/"), () => HttpResponse.json(page([]))),
      http.get(api("/roles/"), () =>
        HttpResponse.json([
          { id: 4, key: "teacher", name: "Teacher" },
          { id: 5, key: "accountant", name: "Accountant" },
        ]),
      ),
      http.post(api("/announcements/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...announcement, ...body }, { status: 201 });
      }),
    );
    renderPage(<AnnouncementsPage />, { permissions: ["administration.view", "administration.manage"] });
    await userEvent.click(await screen.findByRole("button", { name: /New announcement/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Title"), "Conseil pédagogique");
    await userEvent.type(within(dialog).getByLabelText("Message"), "Jeudi à 15 h.");
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: "Teacher" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ title: "Conseil pédagogique", body: "Jeudi à 15 h.", roles: [4], expires_on: null });
  });
});

describe("CalendarPage", () => {
  it("lists the month's dates and asks the API for that month only", async () => {
    let query = "";
    server.use(
      http.get(api("/calendar-events/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([
          {
            id: 1,
            title: "Compositions T1",
            kind: "exam",
            start_date: "2026-12-14",
            end_date: "2026-12-18",
            start_time: null,
            end_time: null,
            location: "",
            description: "",
            levels: [2],
            level_names: ["7ème année"],
          },
        ]);
      }),
    );
    renderPage(<CalendarPage />, { path: "/administration/calendar?month=2026-12", permissions: [] });
    expect(await screen.findByText("Compositions T1")).toBeInTheDocument();
    expect(screen.getByText("Exam")).toBeInTheDocument();
    expect(screen.getByText(/7ème année/)).toBeInTheDocument();
    expect(query).toContain("date_from=2026-12-01");
    expect(query).toContain("date_to=2026-12-31");
    expect(screen.queryByRole("button", { name: /Add a date/ })).not.toBeInTheDocument();
  });

  it("lets a manager add a one-day date", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(api("/calendar-events/"), () => HttpResponse.json([])),
      http.get(api("/levels/"), () => HttpResponse.json([])),
      http.post(api("/calendar-events/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 2, ...body }, { status: 201 });
      }),
    );
    renderPage(<CalendarPage />, {
      path: "/administration/calendar?month=2026-11",
      permissions: ["administration.manage"],
    });
    await userEvent.click(await screen.findByRole("button", { name: /Add a date/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Title"), "Réunion des parents");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      title: "Réunion des parents",
      kind: "event",
      start_date: "2026-11-01",
      end_date: "2026-11-01",
      start_time: null,
      levels: [],
    });
  });
});

describe("DepartmentsPage", () => {
  it("lists the departments with their head and staff", async () => {
    server.use(
      http.get(api("/departments/"), () =>
        HttpResponse.json([
          { id: 3, name: "Sciences", description: "Maths, PC, SVT", head: 9, head_name: "Mamadou Barry", staff_count: 6 },
        ]),
      ),
    );
    renderPage(<DepartmentsPage />, { permissions: ["administration.view"] });
    const row = (await screen.findByRole("link", { name: "Sciences" })).closest("tr")!;
    expect(row).toHaveTextContent("Mamadou Barry");
    expect(row).toHaveTextContent("6");
    expect(screen.getByRole("link", { name: "Sciences" })).toHaveAttribute("href", "/teachers?department=3");
    expect(screen.queryByRole("button", { name: /New department/ })).not.toBeInTheDocument();
  });
});
