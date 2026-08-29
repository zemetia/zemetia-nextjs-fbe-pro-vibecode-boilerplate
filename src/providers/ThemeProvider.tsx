'use client';

import { useEffect } from 'react';

import { applyTheme, resolveTheme } from '@/lib/theme';
import { useAppStore } from '@/stores/app.store';

/**
 * Keeps the `dark` class on <html> in sync with the persisted preference.
 *
 * The server already stamped the class from the cookie, so this only has work
 * to do when the user switches themes, or when the preference is `system` and
 * the OS disagrees with the server's guess.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    applyTheme(resolveTheme(theme));

    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(resolveTheme('system'));

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return children;
}

ThemeProvider.displayName = 'ThemeProvider';
