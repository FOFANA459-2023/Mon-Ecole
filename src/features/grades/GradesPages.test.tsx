import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { classResults, gradebookItem, yearWithTerms } from "@/test/grades";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { defaultTerm } from "./api";
import { ClassResultsPage } from "./ClassResultsPage";
import { GradebooksPage } from "./GradebooksPage";
import { GradingScalesCard } from "./GradingScalesCard";
import { StudentResultsTab } from "./StudentResultsTab";

const withTerms = () => server.use(http.get(api("/academic-years/"), () => HttpResponse.json([yearWithTerms])));

describe("defaultTerm", () => {
  it("picks today's term, else the next one, else the last one", () => {
    const terms = yearWithTerms.terms;
    expect(defaultTerm(terms, "2026-10-15")?.name).toBe("Trimestre 1");
    expect(defaultTerm(terms, "2026-12-28")?.name).toBe("Trimestre 2");
    expect(defaultTerm(terms, "2027-05-01")?.name).toBe("Trimestre 2");
    expect(defaultTerm([], "2027-05-01")).toBeNull();
  });
});

describe("GradebooksPage", () => {
  it("lists the subjects to mark for the chosen term with their progress", async () => {
    withTerms();
    let query = "";
    server.use(
      http.get(api("/gradebooks/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(page([gradebookItem]));
      }),
    );
    renderPage(<GradebooksPage />, { path: "/assessments?term=12", permissions: ["grades.view"] });
    expect(await screen.findByRole("link", { name: "Mathématiques" })).toHaveAttribute("href", "/assessments/40");
    expect(query).toContain("term=12");
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });
});

describe("ClassResultsPage", () => {
  it("shows each subject's mark, the average, the rank and the decision", async () => {
    withTerms();
    server.use(http.get(api("/class-results/"), () => HttpResponse.json(classResults)));
    renderPage(<ClassResultsPage />, { path: "/results?term=11&class=3", permissions: ["grades.view"] });
    const awa = (await screen.findByRole("link", { name: "Awa Diallo" })).closest("tr")!;
    expect(within(awa).getByText("16.47")).toBeInTheDocument();
    expect(within(awa).getByText("Passed")).toBeInTheDocument();
    const binta = screen.getByRole("link", { name: "Binta Bah" }).closest("tr")!;
    expect(within(binta).getByText("8.57")).toHaveClass("text-destructive");
    expect(within(binta).getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/1 subject is not published yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MATH" })).toHaveAttribute("href", "/assessments/40");
  });

  it("lets the director print the class's report cards and write the comments", async () => {
    withTerms();
    let comments: unknown = null;
    server.use(
      http.get(api("/class-results/"), () => HttpResponse.json(classResults)),
      http.get(api("/report-comments/"), () =>
        HttpResponse.json([
          { enrollment: 501, student: 7, student_name: "Awa Diallo", comment: "" },
          { enrollment: 502, student: 8, student_name: "Binta Bah", comment: "Peut mieux faire." },
        ]),
      ),
      http.post(api("/report-comments/"), async ({ request }) => {
        comments = await request.json();
        return HttpResponse.json([]);
      }),
    );
    renderPage(<ClassResultsPage />, {
      path: "/results?term=11&class=3",
      permissions: ["grades.view", "reportcards.generate"],
    });
    expect(await screen.findByRole("button", { name: /Print report cards/ })).toBeInTheDocument();
    expect(screen.getByText(/only show published subjects/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Report card" })).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /Comments/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Trimestre 1" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Awa Diallo" }), "Excellent trimestre.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(comments).toEqual({
        class_group: 3,
        term: 11,
        comments: [{ enrollment: 501, comment: "Excellent trimestre." }],
      }),
    );
  });

  it("offers no printing without the report-card right", async () => {
    withTerms();
    server.use(http.get(api("/class-results/"), () => HttpResponse.json(classResults)));
    renderPage(<ClassResultsPage />, { path: "/results?term=11&class=3", permissions: ["grades.view"] });
    await screen.findByRole("link", { name: "Awa Diallo" });
    expect(screen.queryByRole("button", { name: /Print report cards/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report card" })).not.toBeInTheDocument();
  });

  it("explains when only the class teacher may see a class's results", async () => {
    withTerms();
    server.use(
      http.get(api("/class-results/"), () =>
        HttpResponse.json({ code: "not_found", message: "Not found.", fields: {} }, { status: 404 }),
      ),
    );
    renderPage(<ClassResultsPage />, { path: "/results?term=11&class=3", permissions: ["grades.view"] });
    expect(await screen.findByText(/Only the class teacher and the school management/)).toBeInTheDocument();
  });
});

describe("GradingScalesCard", () => {
  it("shows the built-in scale and lets the director give a level its own", async () => {
    let body: unknown = null;
    server.use(
      http.get(api("/grading-scales/"), () => HttpResponse.json([])),
      http.get(api("/levels/"), () =>
        HttpResponse.json([{ id: 2, name: "CM2", order: 5, cycle: "primary", is_active: true, class_count: 1 }]),
      ),
      http.post(api("/grading-scales/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 1, level_name: "CM2", ...(body as object) }, { status: 201 });
      }),
    );
    renderPage(<GradingScalesCard canEdit />, { permissions: ["settings.manage"] });
    const row = (await screen.findByText("Whole school")).closest("tr")!;
    expect(within(row).getByText("/20")).toBeInTheDocument();
    expect(within(row).getByText("(default)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Different scale for a level/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Level" }));
    await userEvent.click(await screen.findByRole("option", { name: "CM2" }));
    const max = within(dialog).getByRole("spinbutton", { name: "Marks out of" });
    await userEvent.clear(max);
    await userEvent.type(max, "10");
    const pass = within(dialog).getByRole("spinbutton", { name: "Pass mark" });
    await userEvent.clear(pass);
    await userEvent.type(pass, "5");
    // The usual honours bands, scaled to a mark out of 10.
    await userEvent.click(within(dialog).getByRole("button", { name: "Use the usual bands" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(body).toEqual({
        level: 2,
        max_mark: 10,
        pass_mark: 5,
        decimals: 2,
        rank_method: "competition",
        mentions: [
          { min: 8, label: "Excellent" },
          { min: 7, label: "Very good" },
          { min: 6, label: "Good" },
          { min: 5, label: "Fair" },
        ],
      }),
    );
  });

  it("is read-only without the settings right", async () => {
    server.use(http.get(api("/grading-scales/"), () => HttpResponse.json([])));
    renderPage(<GradingScalesCard canEdit={false} />);
    await screen.findByText("Whole school");
    expect(screen.queryByRole("button", { name: /Different scale/ })).not.toBeInTheDocument();
  });
});

describe("StudentResultsTab", () => {
  it("shows each term's average, rank and honours band, and the year's decision", async () => {
    server.use(
      http.get(api("/student-results/7/"), () =>
        HttpResponse.json({
          enrollment: 501,
          class_group: 3,
          class_name: "7ème A",
          scale: { max_mark: "20.00", pass_mark: "10.00", decimals: 2, rank_method: "competition", mentions: [] },
          terms: [
            { term: 11, term_name: "Trimestre 1", average: "15.170", rank: 2, ranked: 30, mention: "Bien", passed: true, subjects: 8 },
            { term: 12, term_name: "Trimestre 2", average: null, rank: null, ranked: 0, mention: "", passed: null, subjects: 0 },
            { term: null, term_name: "", average: "15.170", rank: 2, ranked: 30, mention: "Bien", passed: true, subjects: 8 },
          ],
        }),
      ),
    );
    renderPage(<StudentResultsTab studentId={7} />, { permissions: ["grades.view", "reportcards.generate"] });
    expect((await screen.findAllByText("15.17")).length).toBe(2);
    expect(screen.getAllByText("2 of 30")).toHaveLength(2);
    expect(screen.getByText("nothing published yet")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print the report card — Trimestre 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Print the report card — Whole year" })).toBeEnabled();
  });
});
