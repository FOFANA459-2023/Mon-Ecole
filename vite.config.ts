/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same-origin in development: the SPA calls /api/... and Vite forwards it to Django.
    proxy: {
      "/api": { target: apiTarget },
      "/media": { target: apiTarget },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/lib/api/schema.d.ts", "src/components/ui/**", "src/test/**", "**/*.test.*", "src/main.tsx"],
      reporter: ["text-summary", "html", "lcov"],
      // A floor, not a target: raise it as pages get component tests (the E2E suite covers the rest).
      thresholds: { statements: 15, branches: 11, functions: 11, lines: 15 },
    },
  },
});
