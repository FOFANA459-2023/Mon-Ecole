import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { invoiceItem } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { InvoicesPage } from "./InvoicesPage";

function invoicesApi(results: unknown[] = [invoiceItem]) {
  const requests: URL[] = [];
  server.use(
    http.get(api("/invoices/"), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(page(results));
    }),
  );
  return requests;
}

const renderInvoices = (permissions: string[], path = "/finance/invoices") =>
  renderPage(<InvoicesPage />, {
    path,
    permissions,
    routes: [{ path: "/finance/invoices/:id", element: <p>Invoice page</p> }],
  });

describe("InvoicesPage", () => {
  it("lists invoices with amounts in the school currency and their payment status", async () => {
    invoicesApi();
    renderInvoices(["finance.view"]);
    expect(await screen.findByText("INV-2026-000005")).toBeInTheDocument();
    expect(screen.getByText("Awa Diallo")).toBeInTheDocument();
    expect(screen.getAllByText(/GNF\s810,000/)).toHaveLength(2); // total and balance
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("sends the filters from the address bar to the API, for the current year", async () => {
    const requests = invoicesApi();
    renderInvoices(["finance.view"], "/finance/invoices?status=overdue&q=awa");
    await screen.findByText("INV-2026-000005");
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("search")).toBe("awa"));
    const last = requests.at(-1)!;
    expect(last.searchParams.get("payment_status")).toBe("overdue");
    expect(last.searchParams.get("academic_year")).toBe("1");
  });

  it("opens an invoice from the list", async () => {
    invoicesApi();
    renderInvoices(["finance.view"]);
    await userEvent.click(await screen.findByText("INV-2026-000005"));
    expect(await screen.findByText("Invoice page")).toBeInTheDocument();
  });

  it("shows an empty state that explains where invoices come from", async () => {
    invoicesApi([]);
    renderInvoices(["finance.view"]);
    expect(await screen.findByText("No invoices match these filters.")).toBeInTheDocument();
  });

  it("hides the invoicing actions from read-only users", async () => {
    invoicesApi();
    renderInvoices(["finance.view"]);
    await screen.findByText("INV-2026-000005");
    expect(screen.queryByRole("button", { name: /Issue missing invoices/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New invoice/ })).not.toBeInTheDocument();
  });

  it("issues the missing invoices of the year", async () => {
    invoicesApi();
    let body: unknown = null;
    server.use(
      http.post(api("/invoices/generate/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ created: 3, skipped: 1, without_fees: 0 });
      }),
    );
    renderInvoices(["finance.view", "finance.invoice.create"]);
    await userEvent.click(await screen.findByRole("button", { name: /Issue missing invoices/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Issue missing invoices" })).toBeEnabled());
    await userEvent.click(within(dialog).getByRole("button", { name: "Issue missing invoices" }));
    await waitFor(() => expect(body).toEqual({ academic_year: 1, class_group: null }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
