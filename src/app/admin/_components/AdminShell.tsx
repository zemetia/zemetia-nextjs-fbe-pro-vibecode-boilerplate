'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '@/lib/cn';
import { useIsHydrated, useLocalStorage } from '@/hooks';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

const RAIL_KEY = 'admin-sidebar:rail';

/**
 * The admin app shell — see docs/blueprint/LAYOUT/01-principles-shell.md.
 *
 * One sidebar surface, two placements: a persistent floating column from `md`
 * up (collapsible to an icon rail) and an off-canvas drawer below it, where a
 * 16rem column would leave nothing for the page. The drawer is a Radix Dialog
 * rather than a hand-rolled panel so it keeps focus trapping, Escape, and
 * scroll locking.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [rail, setRail] = useLocalStorage(RAIL_KEY, false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRoute, setDrawerRoute] = useState(pathname);

  // Navigating dismisses the drawer. Derived during render rather than in an
  // effect — `react-hooks/set-state-in-effect` forbids the effect version, and
  // the same adjust-during-render pattern is used by ConfirmDialog.
  if (pathname !== drawerRoute) {
    setDrawerRoute(pathname);
    setDrawerOpen(false);
  }

  // Persisted preferences only apply after hydration — the server renders the
  // default (expanded) shell, so reading localStorage during SSR would desync.
  const collapsed = useIsHydrated() && rail;

  return (
    <div className="bg-app flex min-h-svh">
      {/* Sidebar, topbar, dan padding halaman tidak ikut ke kertas — halaman
          cetak (mis. nota pembelian) memakai seluruh lebar `@page`, dan navigasi
          yang tercetak cuma memakan satu kolom penuh tanpa memberi apa pun. */}
      <div className="sticky top-0 hidden h-svh shrink-0 p-3 pr-0 md:block print:hidden">
        <div
          className={cn(
            'h-full transition-[width] duration-200',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <AdminSidebar collapsed={collapsed} onCollapse={() => setRail(!rail)} />
        </div>
      </div>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-70 max-w-[85vw] p-2 duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigasi admin</DialogPrimitive.Title>
            <AdminSidebar
              onClose={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onOpenNav={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

AdminShell.displayName = 'AdminShell';
