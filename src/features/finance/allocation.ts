import { currencyDecimals } from "@/lib/format";

/** An amount in the currency's smallest unit (GNF: francs, LRD: cents), so sums never drift. */
export function toMinor(amount: number | string, currency: string): number {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 10 ** currencyDecimals(currency)) : 0;
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency);
}

/**
 * Share a payment over unpaid lines in the order given (oldest due first), as the server does by default.
 * Returns the amount paid on each line id; lines left out get nothing.
 */
export function allocateOldestFirst(
  amount: number,
  lines: { id: number; balance: string }[],
  currency: string,
): Map<number, number> {
  let left = toMinor(amount, currency);
  const result = new Map<number, number>();
  for (const line of lines) {
    if (left <= 0) break;
    const paid = Math.min(toMinor(line.balance, currency), left);
    if (paid > 0) {
      result.set(line.id, fromMinor(paid, currency));
      left -= paid;
    }
  }
  return result;
}

/** The sum of the amounts, added in the smallest unit. */
export function total(amounts: Iterable<number>, currency: string): number {
  let minor = 0;
  for (const amount of amounts) minor += toMinor(amount, currency);
  return fromMinor(minor, currency);
}
