'use client';

import { useSyncExternalStore } from 'react';

const NEVER_CHANGES = () => () => {};

/**
 * False on the server and during hydration, true afterwards.
 *
 * Use it to gate anything read from a client-only store (localStorage, cookie
 * persisted state) so the first client render still matches the server HTML.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}
