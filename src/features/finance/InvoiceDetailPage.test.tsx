import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { invoice } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { InvoiceDetailPage } from "./InvoiceDetailPage";

function invoiceApi(data: object = invoice) {
  server.use(http.get(api("/invoices/5/"), () => HttpResponse.json(data)));
}

const renderInvoice = (permissions: string[]) =>
  renderPage(<InvoiceDetailPage />, {
    path: "/finance/invoices/5",
    pattern: "/finance/invoices/:id",
    permissions,
  });

describe("InvoiceDetailPage", () => {
  it("shows every installment and what is still due", async () => {
    invoiceApi();
    renderInvoice(["finance.view"]);
    expect(await screen.findByText("INV-2026-000005")).toBeInTheDocument();
    expect(screen.getByText("Tuition — installment 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Tuition — installment 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("Balance due")).toBeInTheDocument();
    expect(screen.getByText("Overdue", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Awa Diallo/ })).toHaveAttribute("href", "/students/7?tab=payments");
  });

  it("cancels an invoice only with a reason", async () => {
    invoiceApi();
    let body: unknown = null;
    server.use(
      http.post(api("/invoices/5/cancel/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...invoice, status: "cancelled", payment_status: "cancelled" });
      }),
    );
    renderInvoice(["finance.view", "finance.invoice.cancel"]);
    await userEvent.click(await screen.findByRole("button", { name: /Cancel invoice/ }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Cancel the invoice" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Reason" }), "Duplicate");
    await userEvent.click(confirm);
    await waitFor(() => expect(body).toEqual({ reason: "Duplicate" }));
  });

  it("does not offer cancellation without the permission", async () => {
    invoiceApi();
    renderInvoice(["finance.view"]);
    await screen.findByText("INV-2026-000005");
    expect(screen.queryByRole("button", { name: /Cancel invoice/ })).not.toBeInTheDocument();
  });

  it("says the invoice was not found instead of offering a useless retry", async () => {
    server.use(
      http.get(api("/invoices/5/"), () =>
        HttpResponse.json({ code: "not_found", message: "Not found.", fields: {} }, { status: 404 }),
      ),
    );
    renderInvoice(["finance.view"]);
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("marks a cancelled invoice and its reason", async () => {
    invoiceApi({
      ...invoice,
      status: "cancelled",
      payment_status: "cancelled",
      cancelled_at: "2026-10-05T09:00:00Z",
      cancel_reason: "Wrong class",
    });
    renderInvoice(["finance.view", "finance.invoice.cancel"]);
    expect(await screen.findByText(/Cancelled on .* — Wrong class/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel invoice/ })).not.toBeInTheDocument();
  });
});
