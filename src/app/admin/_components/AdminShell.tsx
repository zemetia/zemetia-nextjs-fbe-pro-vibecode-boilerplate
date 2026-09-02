'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

/**
 * The admin app shell PT TAN ERP.
 * Sidebar fixed w-[260px] di sebelah kiri dan area konten di kanan dengan ml-[260px].
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRoute, setDrawerRoute] = useState(pathname);

  if (pathname !== drawerRoute) {
    setDrawerRoute(pathname);
    setDrawerOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-canvas text-fg">
      {/* Desktop Sidebar — Fixed 260px di kiri */}
      <div className="fixed left-0 top-0 z-[100] hidden h-screen w-[260px] flex-col overflow-hidden border-r border-line bg-ink md:flex print:hidden">
        <AdminSidebar />
      </div>

      {/* Mobile Drawer */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-[120] w-[260px] duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigasi admin</DialogPrimitive.Title>
            <AdminSidebar
              onClose={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:ml-[260px] md:px-8 print:m-0 print:p-0">
        <AdminTopbar onOpenNav={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

AdminShell.displayName = 'AdminShell';
