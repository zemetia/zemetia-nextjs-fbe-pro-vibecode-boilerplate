'use client';

import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useIsHydrated } from '@/hooks';
import { resolveTheme } from '@/lib/theme';
import { useAppStore } from '@/stores/app.store';
import { Switch } from '@/components/ui/switch';

/**
 * Light/dark toggle. Writes to `useAppStore`, which persists the choice to a
 * cookie so the server can stamp the right class on <html> before first paint.
 *
 * Designed to sit inside a dropdown menu — it stops click/keyboard events from
 * bubbling so flipping the switch doesn't dismiss the menu.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  // The persisted preference only exists on the client. Until hydration the
  // server-rendered default is what's on screen, so show that instead.
  const isDark = useIsHydrated() && resolveTheme(theme) === 'dark';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {isDark ? (
        <Moon className="h-4 w-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
      )}
      <label htmlFor="theme-switch" className="flex-1 cursor-pointer">
        Mode gelap
      </label>
      <Switch
        id="theme-switch"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label="Mode gelap"
      />
    </div>
  );
}

ThemeSwitch.displayName = 'ThemeSwitch';
