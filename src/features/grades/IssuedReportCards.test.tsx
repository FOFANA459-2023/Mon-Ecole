import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { classResults, yearWithTerms } from "@/test/grades";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { ClassResultsPage } from "./ClassResultsPage";
import { IssuedReportCardsCard } from "./IssuedReportCardsCard";

const job = {
  id: 77,
  kind: "report_cards",
  total: 34,
  error: "",
  result_name: "",
  has_result: false,
  created_at: "2026-10-14T10:00:00Z",
  started_at: null,
  finished_at: null,
};

function withResults() {
  server.use(
    http.get(api("/academic-years/"), () => HttpResponse.json([yearWithTerms])),
    http.get(api("/class-results/"), () => HttpResponse.json(classResults)),
    http.get(api("/classes/3/"), () => HttpResponse.json({ id: 3, name: "7ème A", level: 2, level_name: "7ème" })),
  );
}

async function openBulkDialog() {
  await userEvent.click(await screen.findByRole("button", { name: /Print report cards/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Several classes/ }));
  return screen.findByRole("dialog");
}

describe("Printing report cards for many classes", () => {
  it("makes the whole school's cards in the background and offers the file", async () => {
    withResults();
    let body: unknown = null;
    let polls = 0;
    server.use(
      http.post(api("/report-cards/jobs/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...job, status: "queued", done: 0, outcome: {} }, { status: 202 });
      }),
      http.get(api("/jobs/77/"), () => {
        polls += 1;
        return polls < 2
          ? HttpResponse.json({ ...job, status: "running", done: 12, outcome: {} })
          : HttpResponse.json({
              ...job,
              status: "done",
              done: 34,
              outcome: { classes: 2, cards: 34, new: 3 },
              result_name: "bulletins-trimestre-1.zip",
              has_result: true,
            });
      }),
    );
    renderPage(<ClassResultsPage />, {
      path: "/results?term=11&class=3",
      permissions: ["grades.view", "reportcards.generate", "classes.view_all"],
    });
    const dialog = await openBulkDialog();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Classes" }));
    await userEvent.click(await screen.findByRole("option", { name: "The whole school" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Make the report cards" }));
    await waitFor(() => expect(body).toEqual({ academic_year: 1, term: 11, class_group: null, level: null }));
    expect(await within(dialog).findByText("12 of 34 report cards")).toBeInTheDocument();
    expect(
      await within(dialog).findByText("34 report cards ready (3 newly issued).", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Download/ })).toBeInTheDocument();
  });

  it("lets a class teacher print only their class", async () => {
    withResults();
    renderPage(<ClassResultsPage />, {
      path: "/results?term=11&class=3",
      permissions: ["grades.view", "reportcards.generate"],
    });
    const dialog = await openBulkDialog();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Classes" }));
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "This class" })).toBeInTheDocument();
  });

  it("says when the job failed", async () => {
    withResults();
    server.use(
      http.post(api("/report-cards/jobs/"), () =>
        HttpResponse.json({ ...job, status: "queued", done: 0, outcome: {} }, { status: 202 }),
      ),
      http.get(api("/jobs/77/"), () => HttpResponse.json({ ...job, status: "failed", done: 0, outcome: {} })),
    );
    renderPage(<ClassResultsPage />, {
      path: "/results?term=11&class=3",
      permissions: ["grades.view", "reportcards.generate"],
    });
    const dialog = await openBulkDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Make the report cards" }));
    expect(await within(dialog).findByText(/could not be made/)).toBeInTheDocument();
  });
});

describe("IssuedReportCardsCard", () => {
  it("lists every version handed out, the replaced ones marked", async () => {
    const card = {
      enrollment: 501,
      class_name: "7ème A",
      academic_year_name: "2026-2027",
      term: 11,
      term_name: "Trimestre 1",
      average: "15.170",
      rank: 2,
      size: 4000,
      issued_by_name: "Mamadou Camara",
    };
    server.use(
      http.get(api("/issued-report-cards/"), () =>
        HttpResponse.json([
          { ...card, id: 9, version: 2, is_latest: true, created_at: "2026-10-12T09:00:00Z" },
          { ...card, id: 8, version: 1, is_latest: false, created_at: "2026-10-10T09:00:00Z" },
        ]),
      ),
    );
    renderPage(<IssuedReportCardsCard studentId={7} />, { permissions: ["grades.view"] });
    expect(await screen.findByText("Issued report cards")).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("replaced")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the report card — Trimestre 1, version 1" })).toBeEnabled();
  });

  it("shows nothing before a first report card", async () => {
    server.use(http.get(api("/issued-report-cards/"), () => HttpResponse.json([])));
    const { container } = renderPage(<IssuedReportCardsCard studentId={7} />, { permissions: ["grades.view"] });
    await waitFor(() => expect(container.querySelector("svg.animate-spin")).toBeNull());
    expect(screen.queryByText("Issued report cards")).not.toBeInTheDocument();
  });
});
