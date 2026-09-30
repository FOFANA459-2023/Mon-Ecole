import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { account, discount, invoiceItem, payment, refund } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { StudentFinanceTab } from "./StudentFinanceTab";

function studentFinanceApi() {
  const requests: URL[] = [];
  server.use(
    http.get(api("/invoices/"), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(
        page([
          invoiceItem,
          // A cancelled invoice never counts in what the student owes.
          { ...invoiceItem, id: 6, number: "INV-2026-000006", status: "cancelled", payment_status: "cancelled" },
        ]),
      );
    }),
    http.get(api("/student-discounts/"), () => HttpResponse.json(page([discount]))),
    http.get(api("/payments/"), () =>
      HttpResponse.json(
        page([payment, { ...payment, id: 10, number: "REC-2026-000010", status: "reversed", unallocated: "0.00" }]),
      ),
    ),
    // The credit comes from the student's account: it already takes refunds into account.
    http.get(api("/student-accounts/7/"), () => HttpResponse.json({ ...account, credit: "30000.00" })),
    http.get(api("/refunds/"), () => HttpResponse.json(page([refund]))),
  );
  return requests;
}

const renderTab = (permissions: string[]) =>
  renderPage(<StudentFinanceTab student={{ id: 7, full_name: "Awa Diallo" }} />, { permissions });

describe("StudentFinanceTab", () => {
  it("shows what the student owes, their invoices and discounts", async () => {
    const requests = studentFinanceApi();
    renderTab(["finance.view"]);
    expect(await screen.findByText("INV-2026-000006")).toBeInTheDocument();
    expect(requests[0]?.searchParams.get("student")).toBe("7");
    // Balance and overdue come from the issued invoice only.
    expect(screen.getAllByText(/GNF\s810,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GNF\s270,000/)).toBeInTheDocument();
    expect(await screen.findByText("10 %")).toBeInTheDocument();
    expect(screen.getByText(/Sibling/)).toBeInTheDocument();
  });

  it("lists the student's payments, refunds and credit", async () => {
    studentFinanceApi();
    renderTab(["finance.view"]);
    expect(await screen.findByRole("link", { name: "REC-2026-000010" })).toHaveAttribute("href", "/finance/payments/10");
    expect(await screen.findByText(/GNF\s30,000/)).toBeInTheDocument();
    expect(await screen.findByText(/Paid twice/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record a payment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refund the credit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel the refund" })).not.toBeInTheDocument();
  });

  it("offers to refund the credit and cancel a refund with the right", async () => {
    studentFinanceApi();
    renderTab(["finance.view", "finance.refund"]);
    expect(await screen.findByRole("button", { name: /Refund the credit/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Cancel the refund" })).toBeInTheDocument();
  });

  it("offers invoicing and discounts only with the right permissions", async () => {
    studentFinanceApi();
    renderTab(["finance.view"]);
    await screen.findByText("INV-2026-000005");
    expect(screen.queryByRole("button", { name: /New invoice/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New discount/ })).not.toBeInTheDocument();
  });

  it("shows the actions to the accountant", async () => {
    studentFinanceApi();
    renderTab(["finance.view", "finance.invoice.create", "finance.fees.manage", "finance.payment.record"]);
    expect(await screen.findByRole("button", { name: /New invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Record a payment/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New discount/ })).toBeInTheDocument();
  });
});
