import { useSyncExternalStore } from "react";

/** The academic year each person works in, picked once in the top bar and followed by every page.
 * Kept per school on this device; nothing stored means "the school's current year". */
const listeners = new Set<() => void>();
// Fallback for when storage is unavailable, so the switcher still works for this visit.
const memory = new Map<number, number | null>();
const storageKey = (schoolId: number) => `mon-ecole.working-year.${schoolId}`;

function read(schoolId: number | null): number | null {
  if (schoolId === null) return null;
  try {
    const value = Number(localStorage.getItem(storageKey(schoolId)));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function setWorkingYearId(schoolId: number, yearId: number | null): void {
  try {
    if (yearId === null) localStorage.removeItem(storageKey(schoolId));
    else localStorage.setItem(storageKey(schoolId), String(yearId));
  } catch {
    // Private mode or blocked storage: the choice simply lasts until the page reloads.
  }
  memory.set(schoolId, yearId);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWorkingYearId(schoolId: number | null): number | null {
  return useSyncExternalStore(subscribe, () => {
    if (schoolId === null) return null;
    return memory.has(schoolId) ? (memory.get(schoolId) ?? null) : read(schoolId);
  });
}
