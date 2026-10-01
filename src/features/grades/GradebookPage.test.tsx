import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { gradebook, sheet } from "@/test/grades";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { GradebookPage } from "./GradebookPage";
import { parseCell, shares } from "./marks";

const TEACHER = ["grades.view", "grades.enter", "grades.submit"];

function gradebookApi(detail: object = gradebook, sheetData: object = sheet) {
  const posted: { path: string; body: unknown }[] = [];
  server.use(
    http.get(api("/gradebooks/40/"), () => HttpResponse.json(detail)),
    http.get(api("/gradebooks/40/sheet/"), () => HttpResponse.json(sheetData)),
    http.post(api("/gradebooks/40/grades/"), async ({ request }) => {
      const body = (await request.json()) as { grades: unknown[] };
      posted.push({ path: "grades", body });
      return HttpResponse.json({ changed: body.grades.length });
    }),
    http.post(api("/gradebooks/40/submit/"), () => {
      posted.push({ path: "submit", body: null });
      return HttpResponse.json({ ...detail, status: "submitted" });
    }),
    http.post(api("/grade-categories/"), async ({ request }) => {
      const body = await request.json();
      posted.push({ path: "category", body });
      return HttpResponse.json({ id: 9, ...(body as object) }, { status: 201 });
    }),
    http.post(api("/assessments/"), async ({ request }) => {
      const body = await request.json();
      posted.push({ path: "assessment", body });
      return HttpResponse.json({ id: 103, ...(body as object) }, { status: 201 });
    }),
  );
  return posted;
}

const renderGradebook = (permissions = TEACHER, tab = "") =>
  renderPage(<GradebookPage />, {
    path: `/assessments/40${tab ? `?tab=${tab}` : ""}`,
    pattern: "/assessments/:id",
    permissions,
  });

describe("parseCell", () => {
  it("reads scores, the excused code and empty cells", () => {
    expect(parseCell("", 20)).toEqual({ kind: "empty" });
    expect(parseCell(" e ", 20)).toEqual({ kind: "excused" });
    expect(parseCell("12,5", 20)).toEqual({ kind: "score", value: 12.5 });
    expect(parseCell("20", 20)).toEqual({ kind: "score", value: 20 });
    expect(parseCell("21", 20)).toEqual({ kind: "invalid", reason: "range" });
    expect(parseCell("abs", 20)).toEqual({ kind: "invalid", reason: "format" });
    expect(parseCell("-1", 20)).toEqual({ kind: "invalid", reason: "format" });
  });

  it("turns weights into shares of the mark", () => {
    expect(shares([1, 2]).map(Math.round)).toEqual([33, 67]);
    expect(shares([20, 20, 20, 40])).toEqual([20, 20, 20, 40]);
    expect(shares([])).toEqual([]);
  });
});

describe("GradebookPage — marks", () => {
  it("shows the teacher's own assessments, each student's marks, subject mark and rank", async () => {
    gradebookApi();
    renderGradebook();
    expect(await screen.findByRole("heading", { name: "Mathématiques — 7ème A" })).toBeInTheDocument();
    const grid = await screen.findByRole("table");
    expect(within(grid).getByRole("columnheader", { name: /Interro 1/ })).toHaveTextContent("/10");
    expect(within(grid).getByRole("columnheader", { name: /Compo T1/ })).toHaveTextContent("/40");
    expect(within(grid).getByText("33 %")).toBeInTheDocument();
    expect(within(grid).getByText("67 %")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Interro 1 — Awa Diallo" })).toHaveValue("8");
    const binta = within(grid).getByRole("rowheader", { name: /Binta Bah/ }).closest("tr")!;
    // Interrogations 6.00 (category), then the subject mark 6.00 — below the pass mark.
    expect(within(binta).getAllByText("6.00").at(-1)).toHaveClass("text-destructive");
    expect(within(grid).getByText("15.33")).toBeInTheDocument();
  });

  it("saves only the changed marks, with French decimal commas and E for excused", async () => {
    const posted = gradebookApi();
    renderGradebook();
    const awaCompo = await screen.findByRole("textbox", { name: "Compo T1 — Awa Diallo" });
    await userEvent.clear(awaCompo);
    await userEvent.type(awaCompo, "32,5");
    await userEvent.type(screen.getByRole("textbox", { name: "Compo T1 — Binta Bah" }), "e");
    expect(screen.getByRole("status")).toHaveTextContent("2 unsaved changes");
    await userEvent.click(screen.getByRole("button", { name: /Save marks/ }));
    await waitFor(() =>
      expect(posted).toContainEqual({
        path: "grades",
        body: {
          grades: [
            { assessment: 102, enrollment: 501, score: 32.5, excused: false, comment: "Good work" },
            { assessment: 102, enrollment: 502, score: null, excused: true, comment: "" },
          ],
        },
      }),
    );
  });

  it("refuses a mark above what the assessment is out of", async () => {
    gradebookApi();
    renderGradebook();
    const cell = await screen.findByRole("textbox", { name: "Interro 1 — Binta Bah" });
    await userEvent.clear(cell);
    await userEvent.type(cell, "11");
    expect(cell).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Save marks/ })).toBeDisabled();
  });

  it("moves down the column with Enter", async () => {
    gradebookApi();
    renderGradebook();
    await userEvent.click(await screen.findByRole("textbox", { name: "Interro 1 — Awa Diallo" }));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Interro 1 — Binta Bah" })).toHaveFocus();
  });

  it("is read-only once submitted, and the reviewer can send it back or publish", async () => {
    gradebookApi({
      ...gradebook,
      status: "submitted",
      can: { edit: false, submit: false, send_back: true, publish: true, reopen: false },
    });
    renderGradebook(["grades.view", "grades.review", "grades.publish"]);
    await screen.findByRole("table");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/submitted for review and can no longer be changed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send back to the teacher/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish/ })).toBeInTheDocument();
  });

  it("submits the marks for review after confirmation", async () => {
    const posted = gradebookApi();
    renderGradebook();
    await userEvent.click(await screen.findByRole("button", { name: /Submit for review/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit for review" }));
    await waitFor(() => expect(posted.map((p) => p.path)).toContain("submit"));
  });
});

describe("GradebookPage — rules", () => {
  it("starts an empty gradebook from a template the teacher can rename", async () => {
    const posted = gradebookApi({ ...gradebook, categories: [], assessments: [], assessment_count: 0 });
    renderGradebook();
    // An empty gradebook opens on its rules.
    await userEvent.click(await screen.findByRole("button", { name: /Class work \+ exam/ }));
    await waitFor(() =>
      expect(posted.filter((p) => p.path === "category").map((p) => p.body)).toEqual([
        { gradebook: 40, name: "Class work", weight: 1, method: "average", order: 0 },
        { gradebook: 40, name: "Exam", weight: 2, method: "average", order: 1 },
      ]),
    );
  });

  it("adds an assessment with any name, marked out of any number", async () => {
    const posted = gradebookApi();
    renderGradebook(TEACHER, "rules");
    await userEvent.click(await screen.findByRole("button", { name: /Add an assessment/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Devoir surveillé n°2");
    const max = within(dialog).getByRole("spinbutton", { name: "Marked out of" });
    await userEvent.clear(max);
    await userEvent.type(max, "15");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(posted).toContainEqual({
        path: "assessment",
        body: { gradebook: 40, name: "Devoir surveillé n°2", category: 1, max_score: 15, date: null, weight: 1 },
      }),
    );
  });

  it("shows categories with their share of the mark", async () => {
    gradebookApi();
    renderGradebook(TEACHER, "rules");
    const row = (await screen.findAllByRole("cell", { name: "Composition" }))[0].closest("tr")!;
    expect(within(row).getByText("67 %")).toBeInTheDocument();
    expect(within(row).getByText("Average of the assessments")).toBeInTheDocument();
  });
});
