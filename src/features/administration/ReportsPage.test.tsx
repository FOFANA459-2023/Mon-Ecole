import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { ReportsPage } from "./ReportsPage";

const report = (key: string, title: string) => ({
  key,
  title,
  subtitle: "2026-2027 · Whole school",
  currency: "GNF",
  sections: [
    {
      title: "By class",
      note: "",
      columns: [
        { key: "class", label: "Class", kind: "text" },
        { key: "total", label: "Total", kind: "number" },
      ],
      rows: [{ class: "7ème A", total: 31 }],
      row_count: 1,
      truncated: false,
      totals: null,
    },
  ],
});

describe("Administration ReportsPage", () => {
  it("shows a school report, switches report and lists the others", async () => {
    const paths: string[] = [];
    server.use(
      http.get(api("/reports/school/:key/"), ({ request, params }) => {
        paths.push(`${params.key}${new URL(request.url).search}`);
        return HttpResponse.json(report(String(params.key), params.key === "classes" ? "Class report" : "Enrolment report"));
      }),
    );
    renderPage(<ReportsPage />, {
      path: "/administration/reports",
      permissions: ["reports.view", "reports.export", "finance.view"],
    });
    expect(await screen.findByRole("heading", { name: "Enrolment report" })).toBeInTheDocument();
    expect(screen.getByText("7ème A")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Classes/ }));
    expect(await screen.findByRole("heading", { name: "Class report" })).toBeInTheDocument();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    await waitFor(() => expect(paths.at(-1)).toMatch(/^classes/));
    expect(screen.getByRole("link", { name: /Financial report/ })).toHaveAttribute("href", "/finance/reports?report=summary");
    expect(screen.queryByRole("link", { name: /Grade report/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF/ })).toBeInTheDocument();
  });
});
