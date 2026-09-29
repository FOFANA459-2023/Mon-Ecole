import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { session } from "@/lib/api/client";
import i18n from "@/lib/i18n";

import { server } from "./server";

void i18n.changeLanguage("en");

// Any request a test did not expect fails the test instead of silently hanging.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  session.clear();
});

afterAll(() => server.close());
