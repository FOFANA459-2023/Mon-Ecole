import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";

import { session } from "@/lib/api/client";
import type { AuthContextValue } from "@/lib/auth/context";

import { authValue, makeUser, WithAuth } from "./auth";

type Options = {
  /** Permission codes of the signed-in user (ignored when `auth` is given). */
  permissions?: string[];
  auth?: AuthContextValue;
  path?: string;
  /** Extra routes next to the page under test, e.g. the pages it links to. */
  routes?: RouteObject[];
};

/** Render a page with the providers the app uses: React Query, auth and the router. */
export function renderPage(element: ReactNode, { permissions = [], auth, path = "/", routes = [] }: Options = {}) {
  const value = auth ?? authValue(makeUser(permissions));
  session.setSchoolId(value.membership?.school.id ?? null);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: path.split("?")[0], element }, ...routes, { path: "*", element: <p>Other page</p> }],
    { initialEntries: [path] },
  );
  const result = render(
    <QueryClientProvider client={queryClient}>
      <WithAuth value={value}>
        <RouterProvider router={router} />
      </WithAuth>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
