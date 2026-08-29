/**
 * Theme resolution shared by the server shell and the client store.
 *
 * The preference is persisted by `useAppStore` through the cookie storage
 * adapter, so the server can read it and stamp the right class on <html>
 * before first paint — no flash of the wrong theme.
 */

export type Theme = 'light' | 'dark' | 'system';

/** Concrete theme actually painted — `system` always resolves to one of these. */
export type ResolvedTheme = 'light' | 'dark';

/** Cookie written by `createCookieStorage({ prefix: 'zst' })` for store `app`. */
export const THEME_COOKIE = 'zst_app';

export const DEFAULT_THEME: Theme = 'light';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Pull the theme preference out of the raw persisted cookie value.
 * Falls back to {@link DEFAULT_THEME} for missing or malformed cookies.
 */
export function parseThemeCookie(raw: string | undefined): Theme {
  if (!raw) return DEFAULT_THEME;

  try {
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { state?: { theme?: unknown } } | null)?.state;
    return isTheme(state?.theme) ? state.theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Resolve a preference to the theme to paint.
 *
 * On the server there is no OS signal, so `system` resolves to
 * {@link DEFAULT_THEME}; the client corrects it on mount if they disagree.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;

  if (typeof window === 'undefined') {
    return DEFAULT_THEME === 'system' ? 'light' : DEFAULT_THEME;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Sync the `dark` class on <html> to a resolved theme. Client only. */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}
