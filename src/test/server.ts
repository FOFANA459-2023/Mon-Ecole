import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** Fake API for component tests. Tests add their own handlers with `server.use(...)`. */
export const server = setupServer(
  http.get("*/api/v1/academic-years/", () =>
    HttpResponse.json([
      {
        id: 1,
        name: "2026-2027",
        start_date: "2026-09-01",
        end_date: "2027-06-30",
        is_current: true,
        status: "open",
        terms: [],
      },
    ]),
  ),
  http.get("*/api/v1/classes/", () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
);

export const api = (path: string) => `*/api/v1${path}`;

export function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}
