import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { AbsenceAlertsPage } from "./AbsenceAlertsPage";

const alert = {
  id: 5,
  enrollment: 501,
  student: 7,
  student_name: "Awa Diallo",
  student_number: "MEC-2026-00007",
  class_group: 3,
  class_name: "7ème A",
  status: "open",
  raised_on: "2026-10-14",
  absences: 4,
  since: "2026-09-25",
  last_absence: "2026-10-14",
  closed_on: null,
  closed_by_name: "",
  note: "",
};

describe("AbsenceAlertsPage", () => {
  it("lists the students to follow up and closes an alert with a note", async () => {
    let query = "";
    let body: unknown = null;
    server.use(
      http.get(api("/attendance/alerts/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(page([alert]));
      }),
      http.post(api("/attendance/alerts/5/follow-up/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...alert, status: "followed_up" });
      }),
    );
    renderPage(<AbsenceAlertsPage />, { path: "/attendance/alerts", permissions: ["attendance.view"] });
    const row = (await screen.findByRole("link", { name: "Awa Diallo" })).closest("tr")!;
    expect(query).toContain("status=open");
    expect(within(row).getByText("4")).toBeInTheDocument();
    expect(within(row).getByText("7ème A · MEC-2026-00007")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Follow up" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Mark as followed up" });
    expect(save).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "What was done" }), "Called the father.");
    await userEvent.click(save);
    await waitFor(() => expect(body).toEqual({ note: "Called the father." }));
  });

  it("shows the alerts already followed up with who closed them", async () => {
    server.use(
      http.get(api("/attendance/alerts/"), () =>
        HttpResponse.json(
          page([
            {
              ...alert,
              status: "followed_up",
              closed_on: "2026-10-15",
              closed_by_name: "Mamadou Camara",
              note: "Called the father.",
            },
          ]),
        ),
      ),
    );
    renderPage(<AbsenceAlertsPage />, {
      path: "/attendance/alerts?status=followed_up",
      permissions: ["attendance.view"],
    });
    expect(await screen.findByText("Called the father.")).toBeInTheDocument();
    expect(screen.getByText(/Mamadou Camara/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow up" })).not.toBeInTheDocument();
  });

  it("says when nobody needs following up", async () => {
    server.use(http.get(api("/attendance/alerts/"), () => HttpResponse.json(page([]))));
    renderPage(<AbsenceAlertsPage />, { path: "/attendance/alerts", permissions: ["attendance.view"] });
    expect(await screen.findByText("No student to follow up")).toBeInTheDocument();
  });
});
