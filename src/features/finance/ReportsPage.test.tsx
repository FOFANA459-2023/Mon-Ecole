import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { downloadFile, openPdf } from "@/lib/files";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { periodDates } from "./reports";
import { ReportsPage } from "./ReportsPage";

vi.mock("@/lib/files", () => ({
  openPdf: vi.fn(() => Promise.resolve()),
  downloadFile: vi.fn(() => Promise.resolve()),
}));

const paymentsReport = {
  key: "payments",
  title: "Payments report",
  subtitle: "1 Sep 2026 to 30 Sep 2026",
  currency: "GNF",
  sections: [
    {
      title: "Payments",
      note: "Reversed payments are listed but not counted in the totals.",
      columns: [
        { key: "number", label: "Receipt no.", kind: "text" },
        { key: "date", label: "Date", kind: "date" },
        { key: "student", label: "Student", kind: "text" },
        { key: "amount", label: "Amount", kind: "money" },
      ],
      rows: [
        { number: "REC-2026-000001", date: "2026-09-10", student: "Awa Diallo", amount: "1250000.00" },
        { number: "REC-2026-000002", date: "2026-09-11", student: "Awa Diallo", amount: "200000.00" },
      ],
      row_count: 2400,
      truncated: true,
      totals: { number: "Total (1)", amount: "1250000.00" },
    },
    {
      title: "School year 2026-2027",
      note: "",
      columns: [
        { key: "item", label: "Item", kind: "text" },
        { key: "value", label: "", kind: "auto" },
      ],
      rows: [
        { item: "Collection rate", value: "38.8", kind: "percent" },
        { item: "Students with a balance due", value: 8, kind: "number" },
      ],
      row_count: 2,
      truncated: false,
      totals: null,
    },
  ],
};

function reportsApi() {
  const requests: URL[] = [];
  server.use(
    http.get(api("/reports/finance/:key/"), ({ request, params }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ ...paymentsReport, key: params.key });
    }),
  );
  return requests;
}

describe("periodDates", () => {
  const wednesday = new Date(2026, 8, 30); // 30 September 2026
  it("gives the usual periods, ending today", () => {
    expect(periodDates("today", wednesday)).toEqual({ from: "2026-09-30", to: "2026-09-30" });
    expect(periodDates("week", wednesday)).toEqual({ from: "2026-09-28", to: "2026-09-30" });
    expect(periodDates("month", wednesday)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodDates("lastMonth", wednesday)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(periodDates("schoolYear", wednesday, "2026-09-01")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});

describe("ReportsPage", () => {
  it("shows the report with its figures formatted, and says when rows were left out", async () => {
    const requests = reportsApi();
    renderPage(<ReportsPage />, { permissions: ["finance.view"] });
    expect(await screen.findByText("Payments report")).toBeInTheDocument();
    expect(screen.getAllByText(/GNF\s1,250,000/)).toHaveLength(2); // a row and the total
    expect(screen.getByText("38.8 %")).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 2 of 2400 rows/)).toBeInTheDocument();
    const first = requests[0];
    expect(first.pathname).toMatch(/\/reports\/finance\/payments\/$/);
    expect(first.searchParams.get("date_from")).toMatch(/^\d{4}-\d{2}-01$/);
    // Exporting needs its own right.
    expect(screen.queryByRole("button", { name: /Excel/ })).not.toBeInTheDocument();
  });

  it("shows a totals label in a date column as text", async () => {
    server.use(
      http.get(api("/reports/finance/:key/"), () =>
        HttpResponse.json({
          ...paymentsReport,
          title: "Cash register report",
          sections: [
            {
              title: "Day by day",
              note: "",
              columns: [
                { key: "date", label: "Date", kind: "date" },
                { key: "opened", label: "Opened", kind: "datetime" },
                { key: "money_in", label: "In", kind: "money" },
              ],
              rows: [{ date: "2026-09-30", opened: "2026-09-30T07:34:00+00:00", money_in: "150000.00" }],
              row_count: 1,
              truncated: false,
              totals: { date: "Total", opened: "Total (1)", money_in: "150000.00" },
            },
          ],
        }),
      ),
    );
    renderPage(<ReportsPage />, { path: "/?report=cash", permissions: ["finance.view"] });
    expect(await screen.findByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Total (1)")).toBeInTheDocument();
  });

  it("the outstanding report has no period and can keep only overdue balances", async () => {
    const requests = reportsApi();
    renderPage(<ReportsPage />, { permissions: ["finance.view"] });
    await screen.findByText("Payments report");
    await userEvent.click(screen.getByRole("button", { name: /Outstanding balances/ }));
    await waitFor(() => expect(requests.at(-1)?.pathname).toMatch(/outstanding\/$/));
    expect(requests.at(-1)?.searchParams.has("date_from")).toBe(false);
    expect(screen.queryByRole("button", { name: "This month" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Overdue only" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("overdue_only")).toBe("true"));
  });

  it("changes the period with the presets", async () => {
    const requests = reportsApi();
    renderPage(<ReportsPage />, { permissions: ["finance.view"] });
    await screen.findByText("Payments report");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => {
      const last = requests.at(-1)!;
      expect(last.searchParams.get("date_from")).toBe(last.searchParams.get("date_to"));
    });
  });

  it("exports the report shown as PDF, Excel or CSV", async () => {
    reportsApi();
    renderPage(<ReportsPage />, { permissions: ["finance.view", "finance.export"] });
    await screen.findByText("Payments report");
    const actions = screen.getByRole("button", { name: /Excel/ }).parentElement as HTMLElement;
    await userEvent.click(within(actions).getByRole("button", { name: /PDF/ }));
    expect(openPdf).toHaveBeenCalledWith("/reports/finance/payments/", expect.objectContaining({ export: "pdf" }));
    await userEvent.click(within(actions).getByRole("button", { name: /Excel/ }));
    expect(downloadFile).toHaveBeenCalledWith(
      "/reports/finance/payments/",
      expect.objectContaining({ export: "xlsx", date_from: expect.any(String) }),
      "payments.xlsx",
    );
  });
});
