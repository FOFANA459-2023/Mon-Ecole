import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * List filters kept in the URL, so a filtered list can be bookmarked, shared, and survives "back".
 * Changing any filter other than `page` resets the page to 1.
 */
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(
    (Object.keys(defaults) as K[]).map((key) => [key, params.get(key) ?? defaults[key]]),
  ) as Record<K, string>;

  const set = useCallback(
    (changes: Partial<Record<K, string>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes) as [K, string | undefined][]) {
            if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
            else next.set(key, value);
          }
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [defaults, setParams],
  );

  return [values, set] as const;
}

export const toNumberOrNull = (value: string): number | null => (value ? Number(value) : null);
