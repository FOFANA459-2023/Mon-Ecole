import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { account, cashSession, expense, payment } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { ExpensesPage } from "./ExpensesPage";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { RefundDialog } from "./RefundDialog";

const openSession = { ...cashSession, movements: undefined, by_source: undefined };

function openSessions(sessions: object[]) {
  server.use(http.get(api("/cash-sessions/"), () => HttpResponse.json(page(sessions))));
}

async function choose(dialog: HTMLElement, combobox: string, option: string) {
  await userEvent.click(within(dialog).getByRole("combobox", { name: combobox }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("ExpensesPage", () => {
  it("lists the expenses and lets the accountant cancel one with a reason", async () => {
    let body: unknown = null;
    server.use(
      http.get(api("/expenses/"), () =>
        HttpResponse.json(page([expense, { ...expense, id: 2, number: "EXP-2026-000002", status: "cancelled" }])),
      ),
      http.post(api("/expenses/1/cancel/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...expense, status: "cancelled" });
      }),
    );
    renderPage(<ExpensesPage />, { permissions: ["finance.view", "finance.expense.create"] });
    expect(await screen.findByText("EXP-2026-000002")).toBeInTheDocument();
    expect(screen.getAllByText("Office and teaching supplies").length).toBeGreaterThan(0);
    // A cancelled expense cannot be cancelled again.
    expect(screen.queryByRole("button", { name: "Cancel expense EXP-2026-000002" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel expense EXP-2026-000001" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Reason" }), "Recorded twice");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel the expense" }));
    await waitFor(() => expect(body).toEqual({ reason: "Recorded twice" }));
  });

  it("records a cash expense through the open register", async () => {
    let body: Record<string, unknown> | null = null;
    openSessions([openSession]);
    server.use(
      http.get(api("/expenses/"), () => HttpResponse.json(page([]))),
      http.post(api("/expenses/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(expense, { status: 201 });
      }),
    );
    renderPage(<ExpensesPage />, { permissions: ["finance.view", "finance.expense.create", "cash.view"] });
    await userEvent.click(await screen.findByRole("button", { name: /Record an expense/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Description" }), "Chalk and markers");
    await choose(dialog, "Category", "Office and teaching supplies");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "85000");
    expect(await within(dialog).findByText(/The cash goes through Caisse principale/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Record an expense" }));
    await waitFor(() =>
      expect(body).toMatchObject({
        description: "Chalk and markers",
        category: "supplies",
        amount: 85000,
        method: "cash",
        cash_session: 31,
      }),
    );
  });

  it("does not offer the button without the right", async () => {
    server.use(http.get(api("/expenses/"), () => HttpResponse.json(page([expense]))));
    renderPage(<ExpensesPage />, { permissions: ["finance.view"] });
    await screen.findByText("EXP-2026-000001");
    expect(screen.queryByRole("button", { name: /Record an expense/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel expense/ })).not.toBeInTheDocument();
  });
});

describe("Cash in the payment form", () => {
  const renderDialog = () => {
    server.use(http.get(api("/student-accounts/7/"), () => HttpResponse.json(account)));
    renderPage(<RecordPaymentDialog student={{ id: 7, full_name: "Awa Diallo" }} onClose={vi.fn()} />, {
      permissions: ["finance.view", "finance.payment.record", "cash.view"],
    });
    return screen.findByRole("dialog");
  };

  it("cannot take cash while no register is open", async () => {
    openSessions([]);
    const dialog = await renderDialog();
    expect(await within(dialog).findByText(/No cash register is open/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Open the register" })).toHaveAttribute("href", "/cash-register");
    expect(within(dialog).getByRole("button", { name: "Record a payment" })).toBeDisabled();
    // Mobile money does not go through the register.
    await choose(dialog, "Payment method", "Mobile money");
    expect(within(dialog).queryByText(/No cash register is open/)).not.toBeInTheDocument();
  });

  it("asks which register when several are open", async () => {
    let body: Record<string, unknown> | null = null;
    openSessions([openSession, { ...openSession, id: 32, register: 2, register_name: "Caisse annexe" }]);
    server.use(
      http.post(api("/payments/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(payment, { status: 201 });
      }),
    );
    const dialog = await renderDialog();
    await within(dialog).findByText("Uniform");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "10000");
    const submit = within(dialog).getByRole("button", { name: "Record a payment" });
    expect(submit).toBeDisabled();
    await choose(dialog, "Register the cash goes through", "Caisse annexe");
    await userEvent.click(submit);
    await waitFor(() => expect(body).toMatchObject({ method: "cash", cash_session: 32 }));
  });
});

describe("RefundDialog", () => {
  it("refunds at most the credit", async () => {
    let body: Record<string, unknown> | null = null;
    openSessions([openSession]);
    server.use(
      http.post(api("/refunds/"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const onClose = vi.fn();
    renderPage(<RefundDialog student={{ id: 7, full_name: "Awa Diallo" }} credit={30000} onClose={onClose} />, {
      permissions: ["finance.view", "finance.refund", "cash.view"],
    });
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" });
    expect(amount).toHaveValue(30000);
    await userEvent.clear(amount);
    await userEvent.type(amount, "40000");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Reason" }), "Leaving the school");
    await userEvent.click(within(dialog).getByRole("button", { name: "Refund" }));
    expect(await within(dialog).findByText(/At most GNF\s30,000 can be refunded/)).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, "30000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Refund" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ student: 7, amount: 30000, method: "cash", reason: "Leaving the school", cash_session: 31 });
  });
});
