import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { yearWithTerms } from "@/test/grades";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { AcademicReportsPage } from "./AcademicReportsPage";

const ranking = {
  key: "ranking",
  title: "Ranking report",
  subtitle: "Trimestre 1 · 2026-2027 · Whole school",
  currency: "GNF",
  sections: [
    {
      title: "Classes",
      note: "Only published marks count.",
      columns: [
        { key: "class", label: "Class", kind: "text" },
        { key: "average", label: "Class avg.", kind: "mark" },
        { key: "rate", label: "Pass rate", kind: "percent" },
      ],
      rows: [{ class: "7ème A", average: "14.50", rate: "75.0" }],
      row_count: 1,
      truncated: false,
      totals: null,
    },
  ],
};

function withYear() {
  server.use(
    http.get(api("/academic-years/"), () => HttpResponse.json([yearWithTerms])),
    http.get(api("/classes/"), () => HttpResponse.json(page([{ id: 3, name: "7ème A", capacity: null, enrolled_count: 30 }]))),
  );
}

describe("AcademicReportsPage", () => {
  it("shows the school's ranking for the term and offers the exports", async () => {
    withYear();
    let query = "";
    server.use(
      http.get(api("/reports/academic/ranking/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(ranking);
      }),
    );
    renderPage(<AcademicReportsPage />, {
      path: "/results/reports?report=ranking&term=11",
      permissions: ["grades.view", "classes.view_all", "reports.export"],
    });
    expect(await screen.findByRole("heading", { name: "Ranking report" })).toBeInTheDocument();
    // Marks keep their two decimals.
    expect(screen.getByText("14.50")).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(query).toContain("term=11");
    expect(query).toContain("academic_year=1");
    expect(screen.getByRole("button", { name: /PDF/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Whole year" }));
    await waitFor(() => expect(query).not.toContain("term="));
  });

  it("asks a class teacher to choose their class, and hides the exports without the right", async () => {
    withYear();
    let calls = 0;
    server.use(
      http.get(api("/reports/academic/ranking/"), () => {
        calls += 1;
        return HttpResponse.json(ranking);
      }),
    );
    renderPage(<AcademicReportsPage />, { path: "/results/reports?report=ranking&term=11", permissions: ["grades.view"] });
    expect(await screen.findByText("Choose a class")).toBeInTheDocument();
    expect(calls).toBe(0);
    expect(screen.queryByRole("button", { name: /PDF/ })).not.toBeInTheDocument();
  });
});
