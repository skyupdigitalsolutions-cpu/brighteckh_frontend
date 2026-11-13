import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs` (default 250 ms).
 * Use it for search-as-you-type so each keystroke doesn't fire a request:
 *   const q = useDebouncedValue(search); useJobsList({ search: q });
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
