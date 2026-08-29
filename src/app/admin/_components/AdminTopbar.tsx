'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { Logo } from '@/components/shared';
import { Typography } from '@/components/ui/Typography';
import { AdminUserMenu } from './AdminUserMenu';
import { NAV_SECTIONS } from './nav.config';

/**
 * Mobile-only header. The sidebar is a drawer below `md`, so the shell still
 * needs a permanent place for the nav trigger, the current location, and the
 * account menu. From `md` up the sidebar carries all three and this is hidden.
 */
export interface AdminTopbarProps {
  onOpenNav: () => void;
}

export function AdminTopbar({ onOpenNav }: AdminTopbarProps) {
  const title = useCurrentNavLabel();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar/90 px-3 backdrop-blur-sm md:hidden print:hidden">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Buka navigasi"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <Logo size={26} priority />

      <Typography variant="small" className="min-w-0 flex-1 truncate font-semibold">
        {title}
      </Typography>

      <AdminUserMenu compact side="bottom" />
    </header>
  );
}

AdminTopbar.displayName = 'AdminTopbar';

/**
 * Longest matching nav href wins, so `/admin/inventory/lots` reads "Lot Emas"
 * rather than the shorter "Posisi Emas" entry it also prefixes.
 */
function useCurrentNavLabel(): string {
  const pathname = usePathname() ?? '';

  const match = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.label ?? 'TAN ERP';
}
