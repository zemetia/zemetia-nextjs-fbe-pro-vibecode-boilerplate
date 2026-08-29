'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delay` ms. Use for search inputs so a query key
 * changes once the user pauses typing, not once per keystroke — the API is rate
 * limited per IP and every keystroke would otherwise burn a request.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
