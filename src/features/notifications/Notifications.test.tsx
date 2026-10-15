import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { NotificationsBell } from "./NotificationsBell";
import { NotificationsPage } from "./NotificationsPage";
import { PreferencesCard } from "./PreferencesCard";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const items = [
  {
    id: 1,
    kind: "grades_sent_back",
    title: "Marks sent back: Mathematics — 7ème A",
    body: "Term 1: D2 is missing.",
    link: "/assessments/40",
    read_at: null,
    created_at: minutesAgo(5),
  },
  {
    id: 2,
    kind: "announcement",
    title: "Staff meeting",
    body: "Thursday 3 pm.",
    link: "/",
    read_at: minutesAgo(60),
    created_at: minutesAgo(120),
  },
];

describe("NotificationsBell", () => {
  it("shows the unread count, the latest notifications, and opens one", async () => {
    let read = 0;
    server.use(
      http.get(api("/notifications/unread-count/"), () => HttpResponse.json({ unread: 1 })),
      http.get(api("/notifications/"), () => HttpResponse.json(page(items))),
      http.post(api("/notifications/1/read/"), () => {
        read += 1;
        return HttpResponse.json({ ...items[0], read_at: new Date().toISOString() });
      }),
    );
    const { router } = renderPage(<NotificationsBell />, { permissions: [] });
    const bell = await screen.findByRole("button", { name: "Notifications: 1 unread" });
    expect(within(bell).getByText("1")).toBeInTheDocument();
    await userEvent.click(bell);
    expect(await screen.findByText("Staff meeting")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Marks sent back: Mathematics — 7ème A"));
    await waitFor(() => expect(read).toBe(1));
    expect(router.state.location.pathname).toBe("/assessments/40");
  });

  it("has no badge when everything is read", async () => {
    server.use(http.get(api("/notifications/unread-count/"), () => HttpResponse.json({ unread: 0 })));
    renderPage(<NotificationsBell />, { permissions: [] });
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});

describe("NotificationsPage", () => {
  it("lists them, filters the unread ones and marks all as read", async () => {
    let query = "";
    let readAll = false;
    server.use(
      http.get(api("/notifications/unread-count/"), () => HttpResponse.json({ unread: readAll ? 0 : 1 })),
      http.get(api("/notifications/"), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(page(items));
      }),
      http.post(api("/notifications/read-all/"), () => {
        readAll = true;
        return HttpResponse.json({ unread: 0 });
      }),
    );
    renderPage(<NotificationsPage />, { path: "/notifications" });
    expect(await screen.findByText("Staff meeting")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unread (1)" }));
    await waitFor(() => expect(query).toContain("unread=1"));
    await userEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));
    await waitFor(() => expect(readAll).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Mark all as read/ })).not.toBeInTheDocument());
  });
});

describe("PreferencesCard", () => {
  it("saves a switch as soon as it is flipped", async () => {
    let body: unknown = null;
    server.use(
      http.get(api("/notifications/preferences/"), () =>
        HttpResponse.json([
          { kind: "exam_soon", label: "Upcoming exams", in_app: true, email: false },
          { kind: "grades_sent_back", label: "Marks sent back or reopened", in_app: true, email: true },
        ]),
      ),
      http.patch(api("/notifications/preferences/"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([]);
      }),
    );
    renderPage(<PreferencesCard />);
    await userEvent.click(await screen.findByRole("switch", { name: "Upcoming exams by email" }));
    await waitFor(() => expect(body).toEqual([{ kind: "exam_soon", in_app: true, email: true }]));
  });
});
