import { describe, expect, it } from "vitest";

import en from "./en.json";
import fr from "./fr.json";

function keys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("translations", () => {
  it("French and English define exactly the same keys", () => {
    const french = new Set(keys(fr));
    const english = new Set(keys(en));
    expect([...french].filter((k) => !english.has(k))).toEqual([]);
    expect([...english].filter((k) => !french.has(k))).toEqual([]);
  });

  it("no translation is left empty", () => {
    const empty = (source: object) =>
      keys(source).filter((path) => {
        const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], source);
        return typeof value === "string" && value.trim() === "";
      });
    expect(empty(fr)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });
});
