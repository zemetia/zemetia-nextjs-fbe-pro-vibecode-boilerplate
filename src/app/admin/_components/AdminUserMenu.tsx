'use client';

import { signOut, useSession } from 'next-auth/react';
import { ChevronsUpDown, LogOut } from 'lucide-react';

import { cn } from '@/lib/cn';
import { ThemeSwitch } from '@/components/shared';
import { Typography } from '@/components/ui/Typography';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AdminUserMenuProps {
  /** Avatar only — the rail and the mobile topbar have no room for the name. */
  compact?: boolean;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * The signed-in user's menu. Shared by the sidebar footer and the mobile
 * topbar so the account actions never drift apart between the two shells.
 */
export function AdminUserMenu({ compact = false, side = 'top', className }: AdminUserMenuProps) {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const displayName = user.name ?? user.email ?? '';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu pengguna"
          className={cn(
            'flex items-center rounded-md text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            compact ? 'justify-center p-1' : 'w-full gap-2.5 p-2',
            className,
          )}
        >
          <span className="bevel flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-active text-xs font-semibold text-primary-foreground shadow-xs">
            {initials}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <Typography variant="small" className="block truncate">
                  {displayName}
                </Typography>
                <Typography variant="muted" className="block truncate text-[11px]">
                  {user.roleName}
                </Typography>
              </span>
              <ChevronsUpDown
                className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="z-[130] w-56">
        <DropdownMenuLabel className="truncate font-normal text-foreground-muted">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeSwitch />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => signOut({ callbackUrl: '/sign-in' })}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

AdminUserMenu.displayName = 'AdminUserMenu';
