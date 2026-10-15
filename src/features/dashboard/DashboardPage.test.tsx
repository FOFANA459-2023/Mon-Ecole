import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { DashboardPage } from "./DashboardPage";

const summary = {
  academic_year: { id: 1, name: "2026-2027" },
  scope: "school",
  filters: { term: 11, term_name: "Trimestre 1", level: null, class_group: null, payment_status: "" },
  students: 2,
  students_male: 1,
  students_female: 1,
  classes: 2,
  capacity: 90,
  teachers: 4,
  staff: 6,
  new_enrollments_30d: 2,
  attendance_today: { date: "2026-10-15", registers_taken: 1, classes: 2, present: 1, absent: 0, late: 0, excused: 0 },
  absence_alerts: 1,
  by_level: [{ level_id: 2, level: "7ème année", count: 2 }],
  by_class: [
    { class_group: 3, class_name: "7ème A", count: 1, capacity: 45 },
    { class_group: 4, class_name: "7ème B", count: 1, capacity: 45 },
  ],
  finance: {
    currency: "GNF",
    expected: "6500000.00",
    collected: "1250000.00",
    outstanding: "5250000.00",
    overdue: "1250000.00",
    students_with_balance: 2,
    students_overdue: 1,
    collection_rate: "19.2",
    by_month: [
      { month: "2026-09", amount: "1250000.00" },
      { month: "2026-10", amount: "0.00" },
    ],
    outstanding_by_class: [{ class_name: "7ème B", amount: "3250000.00", students: 1 }],
    upcoming_deadlines: { invoices: 0, amount: "0", days: 14 },
  },
  attendance: {
    date_from: "2026-10-01",
    date_to: "2026-10-15",
    rate: "66.7",
    present: 1,
    absent: 1,
    late: 1,
    excused: 0,
    days: [
      { date: "2026-10-13", present: 1, absent: 0, late: 0, excused: 0, rate: "100.0" },
      { date: "2026-10-14", present: 0, absent: 1, late: 0, excused: 0, rate: "0.0" },
    ],
  },
  performance: {
    term: { id: 11, name: "Trimestre 1" },
    counted: 2,
    passed: 1,
    pass_rate: "50.0",
    distribution: [
      { label: "Bien", count: 1 },
      { label: "< 10", count: 1, below_pass: true },
    ],
    by_class: [{ class_name: "7ème A", average: "14.50", pass_rate: "100.0", counted: 1 }],
  },
  missing_grades: { term: { id: 11, name: "Trimestre 1", end_date: "2026-12-19" }, open: 3, submitted: 1, published: 2 },
  upcoming_exams: [{ id: 5, title: "Compositions", start_date: "2026-10-25", end_date: "2026-10-27" }],
  announcements: [{ id: 9, title: "Staff meeting", priority: "important", pinned: true, publish_at: "2026-10-14T08:00:00Z" }],
};

const DIRECTOR = ["dashboard.view", "finance.view", "attendance.view", "grades.view", "students.view", "classes.view"];

describe("DashboardPage", () => {
  it("shows the money, the alerts and the charts", async () => {
    server.use(http.get(api("/dashboard/summary/"), () => HttpResponse.json(summary)));
    renderPage(<DashboardPage />, { permissions: DIRECTOR });
    expect(await screen.findByText("Expected revenue")).toBeInTheDocument();
    expect(screen.getByText(/19.2 % of the expected revenue/)).toBeInTheDocument();
    const alerts = screen.getByRole("list", { name: "Alerts" });
    expect(within(alerts).getByText(/1 student is absent too often/)).toBeInTheDocument();
    expect(within(alerts).getByText(/1 student is behind with payments/)).toBeInTheDocument();
    expect(within(alerts).getByText(/Exam: Compositions/)).toBeInTheDocument();
    expect(within(alerts).getByText(/4 subjects not published yet for Trimestre 1/)).toBeInTheDocument();
    expect(within(alerts).getByText("Staff meeting")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Payments received by month" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.getByText("Below 10")).toBeInTheDocument();
  });

  it("shows a chart's figures as a table", async () => {
    server.use(http.get(api("/dashboard/summary/"), () => HttpResponse.json(summary)));
    renderPage(<DashboardPage />, { permissions: DIRECTOR });
    const card = (await screen.findByText("Payments received by month")).closest("[data-slot=card]") as HTMLElement;
    await userEvent.click(within(card).getByRole("button", { name: "Show as a table" }));
    const table = within(card).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("sends the filters to the API", async () => {
    const queries: string[] = [];
    server.use(
      http.get(api("/dashboard/summary/"), ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json(summary);
      }),
    );
    renderPage(<DashboardPage />, { path: "/?payment=overdue&level=2", permissions: DIRECTOR });
    await screen.findByText("Expected revenue");
    await waitFor(() => expect(queries.at(-1)).toContain("payment_status=overdue"));
    expect(queries.at(-1)).toContain("level=2");
  });

  it("shows no money to a teacher", async () => {
    server.use(
      http.get(api("/dashboard/summary/"), () =>
        HttpResponse.json({ ...summary, scope: "my_classes", finance: null, performance: null, missing_grades: null }),
      ),
    );
    renderPage(<DashboardPage />, { permissions: ["dashboard.view", "attendance.view"] });
    expect(await screen.findByText("Students in my classes")).toBeInTheDocument();
    expect(screen.queryByText("Expected revenue")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Payment status" })).not.toBeInTheDocument();
  });
});
