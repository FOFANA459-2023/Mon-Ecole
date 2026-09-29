import { describe, expect, it } from "vitest";

import { formatMoney, initials, localeFor } from "./format";

describe("format", () => {
  it("formats Guinean francs without decimals and dollars with cents", () => {
    expect(formatMoney(1500000, "GNF", "fr").replace(/\s/g, " ")).toMatch(/1 500 000\sGNF|1 500 000 FG/);
    expect(formatMoney("12.5", "USD", "en")).toBe("US$12.50");
  });

  it("falls back to French for unknown languages", () => {
    expect(localeFor("xx")).toBe("fr-FR");
  });

  it("builds initials from up to two names", () => {
    expect(initials("Aïssatou  Diallo Bah")).toBe("AD");
    expect(initials("")).toBe("");
  });
});
