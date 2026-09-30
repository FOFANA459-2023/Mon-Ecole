import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { payment } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { PaymentDetailPage } from "./PaymentDetailPage";
import { PaymentsPage } from "./PaymentsPage";

function paymentApi(data: object = payment) {
  server.use(http.get(api("/payments/9/"), () => HttpResponse.json(data)));
}

const renderPayment = (permissions: string[]) =>
  renderPage(<PaymentDetailPage />, { path: "/finance/payments/9", pattern: "/finance/payments/:id", permissions });

describe("PaymentDetailPage", () => {
  it("shows the payment, what it paid and the credit it left", async () => {
    paymentApi();
    renderPayment(["finance.view"]);
    expect(await screen.findByText("REC-2026-000009")).toBeInTheDocument();
    expect(screen.getByText("Mobile money")).toBeInTheDocument();
    expect(screen.getByText("Fatoumata Sylla")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "INV-2026-000005" })).toHaveAttribute("href", "/finance/invoices/5");
    expect(screen.getByText("Kept as credit").nextSibling).toHaveTextContent(/GNF\s30,000/);
    expect(screen.getByRole("button", { name: /Print the receipt/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reverse/ })).not.toBeInTheDocument();
  });

  it("reverses a payment only with a reason", async () => {
    paymentApi();
    let body: unknown = null;
    server.use(
      http.post(api("/payments/9/reverse/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...payment, status: "reversed" });
      }),
    );
    renderPayment(["finance.view", "finance.payment.reverse"]);
    await userEvent.click(await screen.findByRole("button", { name: /Reverse/ }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reverse the payment" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Reason" }), "Cheque bounced");
    await userEvent.click(confirm);
    await waitFor(() => expect(body).toEqual({ reason: "Cheque bounced" }));
  });

  it("marks a reversed payment, with who reversed it and why", async () => {
    paymentApi({
      ...payment,
      status: "reversed",
      unallocated: "0.00",
      reversed_at: "2026-09-20T08:00:00Z",
      reversed_by_name: "Sékou Keita",
      reversal_reason: "Wrong student",
    });
    renderPayment(["finance.view", "finance.payment.reverse"]);
    expect(await screen.findByText(/Reversed on .* by Sékou Keita — Wrong student/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reverse/ })).not.toBeInTheDocument();
  });
});

describe("PaymentsPage", () => {
  it("lists the payments and filters them", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(api("/payments/"), ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(page([payment, { ...payment, id: 10, number: "REC-2026-000010", status: "reversed" }]));
      }),
    );
    renderPage(<PaymentsPage />, { permissions: ["finance.view"] });
    expect(await screen.findByText("REC-2026-000010")).toBeInTheDocument();
    expect(screen.getByText("Reversed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record a payment/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("From"), "2026-09-01");
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("date__gte")).toBe("2026-09-01"));
  });

  it("offers to record a payment with the permission", async () => {
    server.use(http.get(api("/payments/"), () => HttpResponse.json(page([]))));
    renderPage(<PaymentsPage />, { permissions: ["finance.view", "finance.payment.record"] });
    expect(await screen.findByText("No payments match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Record a payment/ })).toBeInTheDocument();
  });
});
