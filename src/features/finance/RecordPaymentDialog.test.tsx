import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { account, payment } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { RecordPaymentDialog } from "./RecordPaymentDialog";

function paymentApi() {
  let body: Record<string, unknown> | null = null;
  server.use(
    http.get(api("/student-accounts/7/"), () => HttpResponse.json(account)),
    http.post(api("/payments/"), async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(payment, { status: 201 });
    }),
  );
  return () => body;
}

const student = { id: 7, full_name: "Awa Diallo" };

async function openDialog(props: Partial<Parameters<typeof RecordPaymentDialog>[0]> = {}) {
  const onClose = vi.fn();
  renderPage(<RecordPaymentDialog student={student} onClose={onClose} {...props} />, {
    permissions: ["finance.view", "finance.payment.record"],
  });
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Uniform");
  return { dialog, onClose };
}

const row = (dialog: HTMLElement, name: string) => within(dialog).getByText(name).closest("tr") as HTMLElement;

describe("RecordPaymentDialog", () => {
  it("shows what the money pays, oldest fees first, and lets the server allocate it", async () => {
    const posted = paymentApi();
    const { dialog, onClose } = await openDialog();
    expect(within(dialog).getByText(/GNF\s1,325,000/)).toBeInTheDocument(); // balance due
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "400000");
    expect(within(row(dialog, "Registration")).getAllByText(/GNF\s250,000/)).toHaveLength(2);
    expect(within(row(dialog, "Tuition — installment 1 of 3")).getByText(/GNF\s150,000/)).toBeInTheDocument();
    expect(within(row(dialog, "Uniform")).getByText("—")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Reference" }), "OM-4411");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record a payment" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted()).toMatchObject({ student: 7, amount: 400000, method: "cash", reference: "OM-4411" });
    expect(posted()).not.toHaveProperty("allocations");
  });

  it("from an invoice, pays only that invoice and keeps the rest as credit", async () => {
    const posted = paymentApi();
    const { dialog, onClose } = await openDialog({ invoice: { id: 6, number: "INV-2026-000006" } });
    expect(within(dialog).queryByText("Registration")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "100000");
    expect(within(dialog).getByText(/Kept as credit/).parentElement).toHaveTextContent(/GNF\s25,000/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Record a payment" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted()).toMatchObject({ allocations: [{ invoice_line: 21, amount: 75000 }] });
  });

  it("fills the amount with the whole balance", async () => {
    paymentApi();
    const { dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Whole balance" }));
    expect(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" })).toHaveValue(1325000);
  });

  it("lets the accountant choose the fees paid, never more than the payment", async () => {
    const posted = paymentApi();
    const { dialog, onClose } = await openDialog();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "100000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Choose the fees paid" }));
    const registration = within(dialog).getByRole("spinbutton", { name: "Paid now for Registration" });
    expect(registration).toHaveValue(100000);
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Paid now for Uniform" }), "50000");
    expect(within(dialog).getByText("The fees paid add up to more than the payment.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Record a payment" })).toBeDisabled();
    await userEvent.clear(registration);
    await userEvent.type(registration, "50000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record a payment" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted()).toMatchObject({
      allocations: [
        { invoice_line: 11, amount: 50000 },
        { invoice_line: 21, amount: 50000 },
      ],
    });
  });

  it("refuses a payment dated in the future", async () => {
    const posted = paymentApi();
    const { dialog } = await openDialog();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "1000");
    const date = within(dialog).getByLabelText("Payment date");
    await userEvent.clear(date);
    await userEvent.type(date, "2999-01-01");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record a payment" }));
    expect(await within(dialog).findByText("A payment cannot be dated in the future.")).toBeInTheDocument();
    expect(posted()).toBeNull();
  });
});
