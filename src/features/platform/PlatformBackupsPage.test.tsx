import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { PlatformBackupsPage } from "./PlatformBackupsPage";

const done = {
  id: 1,
  kind: "automatic",
  status: "done",
  engine: "postgresql",
  size: 5 * 1024 * 1024,
  error: "",
  started_at: "2026-10-15T08:15:00Z",
  finished_at: "2026-10-15T08:16:00Z",
  created_by_name: "",
  has_file: true,
};

describe("PlatformBackupsPage", () => {
  it("lists the backups and starts one now", async () => {
    let started = false;
    server.use(
      http.get(api("/platform/backups/"), () =>
        HttpResponse.json(page(started ? [{ ...done, id: 2, kind: "manual", status: "running", has_file: false, size: 0 }, done] : [done])),
      ),
      http.post(api("/platform/backups/"), () => {
        started = true;
        return HttpResponse.json({ ...done, id: 2, kind: "manual", status: "running" }, { status: 202 });
      }),
    );
    renderPage(<PlatformBackupsPage />, { path: "/platform/backups" });
    expect(await screen.findByText("Automatic")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("5 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download the backup" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back up now/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Backing up/ })).toBeDisabled());
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});
