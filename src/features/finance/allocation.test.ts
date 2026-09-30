import { describe, expect, it } from "vitest";

import { allocateOldestFirst, total } from "./allocation";

const lines = [
  { id: 1, balance: "250000.00" },
  { id: 2, balance: "1000000.00" },
  { id: 3, balance: "75000.00" },
];

describe("allocateOldestFirst", () => {
  it("pays the lines in order until the money runs out", () => {
    expect([...allocateOldestFirst(400000, lines, "GNF")]).toEqual([
      [1, 250000],
      [2, 150000],
    ]);
  });

  it("never pays a line more than is due", () => {
    expect(total(allocateOldestFirst(2_000_000, lines, "GNF").values(), "GNF")).toBe(1_325_000);
  });

  it("works in cents without drifting", () => {
    const cents = [
      { id: 1, balance: "0.10" },
      { id: 2, balance: "0.20" },
    ];
    expect([...allocateOldestFirst(0.3, cents, "LRD")]).toEqual([
      [1, 0.1],
      [2, 0.2],
    ]);
    expect(total([0.1, 0.2], "LRD")).toBe(0.3);
  });
});
