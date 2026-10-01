/** What a teacher types in a marks cell. */
export type CellValue =
  | { kind: "empty" }
  | { kind: "excused" }
  | { kind: "score"; value: number }
  | { kind: "invalid"; reason: "format" | "range" };

/** Typed in a cell to excuse a student from an assessment ("E" for Excused / Excusé). */
export const EXCUSED_CODE = "E";

/**
 * Read a cell: empty, "E" (excused) or a score between 0 and `max`. A comma works as the decimal separator,
 * as French speakers type it ("12,5").
 */
export function parseCell(input: string, max: number): CellValue {
  const text = input.trim();
  if (text === "") return { kind: "empty" };
  if (text.toUpperCase() === EXCUSED_CODE) return { kind: "excused" };
  const normalised = text.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(normalised)) return { kind: "invalid", reason: "format" };
  const value = Number(normalised);
  if (value < 0 || value > max) return { kind: "invalid", reason: "range" };
  return { kind: "score", value };
}

/** The text a stored mark shows in its cell. */
export function cellText(mark: { score: string | null; excused: boolean } | undefined): string {
  if (!mark) return "";
  if (mark.excused) return EXCUSED_CODE;
  return mark.score === null ? "" : String(Number(mark.score));
}

export const cellKey = (assessment: number, enrollment: number) => `${assessment}:${enrollment}`;

/** The API entry for a cell (score null + not excused clears the mark). */
export function toEntry(assessment: number, enrollment: number, value: CellValue, comment = "") {
  return {
    assessment,
    enrollment,
    score: value.kind === "score" ? value.value : null,
    excused: value.kind === "excused",
    comment,
  };
}

/** Each category's share of the subject mark, in percent (weights need not add up to 100). */
export function shares(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => (total > 0 ? (w / total) * 100 : 0));
}
