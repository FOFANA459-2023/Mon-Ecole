import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { applyApiErrors, errorMessage } from "./forms";

const t = ((key: string) => key) as unknown as TFunction;
const validation = (fields: Record<string, string[]>, message = "Please correct the highlighted fields.") =>
  new ApiError(400, { code: "validation_error", message, fields });

describe("errorMessage", () => {
  it("maps network, permission and server errors to friendly messages", () => {
    expect(errorMessage(new ApiError(0, { code: "network_error", message: "", fields: {} }), t)).toBe("errors.network");
    expect(errorMessage(new ApiError(403, { code: "permission_denied", message: "x", fields: {} }), t)).toBe(
      "errors.forbidden",
    );
    expect(errorMessage(new ApiError(500, { code: "error", message: "Traceback…", fields: {} }), t)).toBe(
      "errors.generic",
    );
    expect(errorMessage(new Error("boom"), t)).toBe("errors.generic");
  });

  it("shows the API's own message for client errors", () => {
    expect(errorMessage(new ApiError(400, { code: "in_use", message: "Still in use", fields: {} }), t)).toBe(
      "Still in use",
    );
  });
});

describe("applyApiErrors", () => {
  it("puts field errors on the form and returns the rest", () => {
    const setError = vi.fn();
    const message = applyApiErrors(
      validation({ name: ["Taken"], "guardians.0.phone": ["Required"] }),
      setError,
      ["name"],
      t,
    );
    expect(setError).toHaveBeenCalledWith("name", { type: "server", message: "Taken" });
    expect(message).toBe("Required");
  });

  it("returns the general message when no field is named", () => {
    expect(applyApiErrors(validation({}, "Class is full"), vi.fn(), ["name"], t)).toBe("Class is full");
  });
});
