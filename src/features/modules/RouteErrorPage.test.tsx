import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorPage } from "./RouteErrorPage";

function Crash({ error }: { error: Error }): never {
  throw error;
}

function renderCrash(error: Error) {
  const router = createMemoryRouter([{ path: "/", element: <Crash error={error} />, errorElement: <RouteErrorPage /> }]);
  render(<RouterProvider router={router} />);
}

describe("RouteErrorPage", () => {
  const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
  afterEach(() => quiet.mockClear());

  it("explains a crash caused by the browser's translation", () => {
    const error = new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child.");
    error.name = "NotFoundError";
    renderCrash(error);
    expect(screen.getByRole("heading", { name: "This page stopped working" })).toBeInTheDocument();
    expect(screen.getByText(/automatic translation changed the page/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload the page/ })).toBeInTheDocument();
  });

  it("shows a plain message for any other crash", () => {
    renderCrash(new Error("boom"));
    expect(screen.getByText(/Something unexpected happened/)).toBeInTheDocument();
  });
});
