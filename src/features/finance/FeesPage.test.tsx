import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { level, schedule, tuition } from "@/test/finance";
import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { FeesPage } from "./FeesPage";

function feesApi(schedules: unknown[] = [schedule]) {
  server.use(
    http.get(api("/levels/"), () => HttpResponse.json([level])),
    http.get(api("/fee-categories/"), () => HttpResponse.json([tuition])),
    http.get(api("/fee-schedules/"), () => HttpResponse.json(schedules)),
  );
}

const renderFees = (permissions: string[]) => renderPage(<FeesPage />, { path: "/finance/fees", permissions });

async function openNewFee() {
  await userEvent.click(await screen.findByRole("button", { name: /Add a fee/ }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("combobox", { name: "Fee category" }));
  await userEvent.click(await screen.findByRole("option", { name: "Tuition" }));
  return dialog;
}

describe("FeesPage", () => {
  it("shows each level's fees with their due dates", async () => {
    feesApi();
    renderFees(["finance.view"]);
    expect(await screen.findByText("7ème année")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tuition" })).toBeInTheDocument();
    expect(screen.getByText(/GNF\s900,000 per new student/)).toBeInTheDocument();
    expect(screen.getByText(/1 Oct 2026 · 10 Jan 2027 · 1 Apr 2027/)).toBeInTheDocument();
  });

  it("is read-only without the fee set-up permission", async () => {
    feesApi();
    renderFees(["finance.view"]);
    await screen.findByText("7ème année");
    expect(screen.queryByRole("button", { name: /Add a fee/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New category/ })).not.toBeInTheDocument();
  });

  it("splits a new fee into equal installments and saves it", async () => {
    feesApi([]);
    let body: unknown = null;
    server.use(
      http.post(api("/fee-schedules/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(schedule, { status: 201 });
      }),
    );
    renderFees(["finance.view", "finance.fees.manage"]);
    const dialog = await openNewFee();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "900000");
    await userEvent.click(within(dialog).getByRole("button", { name: /Add an installment/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /Add an installment/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Split equally" }));
    const dates = within(dialog).getAllByLabelText("Due date");
    ["2026-10-01", "2027-01-10", "2027-04-01"].forEach((value, i) => fireEvent.change(dates[i]!, { target: { value } }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(body).toEqual({
        category: 1,
        applies_to: "all",
        amount: 900000,
        installments: [
          { label: "", due_date: "2026-10-01", amount: 300000 },
          { label: "", due_date: "2027-01-10", amount: 300000 },
          { label: "", due_date: "2027-04-01", amount: 300000 },
        ],
        academic_year: 1,
        level: 3,
      }),
    );
  });

  it("refuses installments that do not add up to the fee", async () => {
    feesApi([]);
    let posted = false;
    server.use(
      http.post(api("/fee-schedules/"), () => {
        posted = true;
        return HttpResponse.json(schedule, { status: 201 });
      }),
    );
    renderFees(["finance.view", "finance.fees.manage"]);
    const dialog = await openNewFee();
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Amount (GNF)" }), "900000");
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-10-01" } });
    const [, installment] = within(dialog).getAllByRole("spinbutton");
    await userEvent.clear(installment!);
    await userEvent.type(installment!, "400000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("The installments must add up to the fee amount.")).toBeInTheDocument();
    expect(posted).toBe(false);
  });
});
