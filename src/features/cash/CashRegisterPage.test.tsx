import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { cashSession, registers } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { CashRegisterPage } from "./CashRegisterPage";
import { CashSessionPage } from "./CashSessionPage";

function cashApi() {
  const posted: { path: string; body: unknown }[] = [];
  server.use(
    http.get(api("/cash-registers/"), () => HttpResponse.json(registers)),
    http.get(api("/cash-sessions/"), () =>
      HttpResponse.json(
        page([
          { ...cashSession, movements: undefined, by_source: undefined },
          {
            ...cashSession,
            id: 30,
            status: "closed",
            opened_at: "2026-09-29T07:40:00Z",
            closed_at: "2026-09-29T17:10:00Z",
            expected_closing: "155000.00",
            counted_closing: "150000.00",
            difference: "-5000.00",
            closing_note: "Missing note of 5 000",
          },
        ]),
      ),
    ),
    http.post(api("/cash-sessions/"), async ({ request }) => {
      posted.push({ path: "open", body: await request.json() });
      return HttpResponse.json(cashSession, { status: 201 });
    }),
    http.post(api("/cash-sessions/31/close/"), async ({ request }) => {
      posted.push({ path: "close", body: await request.json() });
      return HttpResponse.json({ ...cashSession, status: "closed" });
    }),
  );
  return posted;
}

const CASHIER = ["cash.view", "cash.open", "cash.close", "cash.record", "finance.view"];

describe("CashRegisterPage", () => {
  it("shows each register, what the open one should hold, and past sessions", async () => {
    cashApi();
    renderPage(<CashRegisterPage />, { permissions: ["cash.view"] });
    // The open register's expected cash, on its card and in the sessions list.
    expect((await screen.findAllByText(/GNF\s600,000/)).length).toBe(2);
    expect(screen.getByText(/Counted at the last closing: GNF\s40,000/)).toBeInTheDocument();
    expect(await screen.findByText(/-GNF\s5,000|GNF\s-5,000|−GNF\s5,000/)).toBeInTheDocument();
    // Without the rights, nothing can be opened, closed or added.
    expect(screen.queryByRole("button", { name: /Open the register/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Close the register/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a register/ })).not.toBeInTheDocument();
  });

  it("opens a register with the last count as the float", async () => {
    const posted = cashApi();
    renderPage(<CashRegisterPage />, { permissions: CASHIER });
    await userEvent.click(await screen.findByRole("button", { name: /Open the register/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("spinbutton", { name: "Float (GNF)" })).toHaveValue(40000);
    await userEvent.click(within(dialog).getByRole("button", { name: "Open the register" }));
    await waitFor(() => expect(posted).toContainEqual({ path: "open", body: { register: 2, opening_balance: 40000, note: "" } }));
  });

  it("closes with a count, and asks why when it does not match", async () => {
    const posted = cashApi();
    renderPage(<CashRegisterPage />, { permissions: CASHIER });
    await userEvent.click(await screen.findByRole("button", { name: "Close the register" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Cash counted (GNF)" }), "595000");
    expect(within(dialog).getByRole("status")).toHaveTextContent(/Shortage of GNF\s5,000/);
    expect(within(dialog).getByText("Explain the difference.")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Close the register" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Note" }), "Change given twice");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(posted).toContainEqual({
        path: "close",
        body: { counted_closing: 595000, closing_note: "Change given twice" },
      }),
    );
  });
});

describe("CashSessionPage", () => {
  const renderSession = (permissions: string[]) => {
    server.use(http.get(api("/cash-sessions/31/"), () => HttpResponse.json(cashSession)));
    return renderPage(<CashSessionPage />, {
      path: "/cash-register/sessions/31",
      pattern: "/cash-register/sessions/:id",
      permissions,
    });
  };

  it("lists the movements with where they came from, and the totals", async () => {
    renderSession(["cash.view"]);
    expect(await screen.findByRole("link", { name: "REC-2026-000009 — Awa Diallo" })).toHaveAttribute(
      "href",
      "/finance/payments/9",
    );
    expect(screen.getByRole("link", { name: "EXP-2026-000001 — Chalk and markers" })).toHaveAttribute(
      "href",
      "/finance/expenses?q=EXP-2026-000001",
    );
    expect(screen.getAllByText(/GNF\s600,000/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Print the journal/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Other cash movement/ })).not.toBeInTheDocument();
  });

  it("records another movement with a description", async () => {
    let body: unknown = null;
    server.use(
      http.post(api("/cash-sessions/31/movements/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderSession(["cash.view", "cash.record"]);
    await userEvent.click(await screen.findByRole("button", { name: /Other cash movement/ }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "500000");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Description" }), "Deposit at Ecobank");
    await userEvent.click(save);
    await waitFor(() => expect(body).toEqual({ direction: "out", amount: 500000, description: "Deposit at Ecobank" }));
  });
});
