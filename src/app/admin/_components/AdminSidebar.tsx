'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, ShieldCheck, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks';
import { AdminUserMenu } from './AdminUserMenu';
import { NAV_SECTIONS, PINNED_NAV_ITEMS } from './nav.config';

const CLOSED_SECTIONS_KEY = 'admin-sidebar:closed-sections';

const NAV_ITEM =
  'flex cursor-pointer items-center gap-3.5 rounded-sm px-4 py-3 text-[0.9rem] font-medium ' +
  'text-fg-soft transition-all duration-200 hover:bg-white/5 hover:text-fg';

const NAV_ITEM_ACTIVE =
  'border-l-[3px] border-gold bg-linear-90 from-gold/20 to-gold/5 font-semibold text-gold-light';

export interface AdminSidebarProps {
  collapsed?: boolean;
  onCollapse?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function AdminSidebar({
  onClose,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [closedSections, setClosedSections] = useLocalStorage<string[]>(CLOSED_SECTIONS_KEY, []);

  const toggleSection = (id: string) =>
    setClosedSections((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );

  return (
    <aside className="flex h-full w-[260px] flex-col overflow-hidden border-r border-line bg-ink">
      {/* Header Sidebar dengan Brand Logo Emas PT TAN */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/logo/logo-tan.png"
            alt="Logo PT TAN"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-[0_4px_12px_var(--color-gold-glow)]"
          />
          <div>
            <h2 className="font-heading text-base font-bold text-fg">PT TAN ERP</h2>
            <p className="text-[0.7rem] text-fg-muted">Export &amp; Trading System</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup navigasi"
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-soft hover:bg-white/5 hover:text-fg md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigasi Menu */}
      <nav className="scrollbar-gold flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2 py-3">
        {/* Pinned: Executive Dashboard */}
        {PINNED_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname === '/admin';
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                NAV_ITEM,
                'mb-3 font-bold',
                active && NAV_ITEM_ACTIVE,
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* 5 Grup Kategori Berurutan Sesuai Operasional Riil */}
        {NAV_SECTIONS.map((group) => {
          const isOpen = !closedSections.includes(group.id);
          return (
            <div key={group.id} className="mb-3.5">
              <div
                className="mb-1 flex cursor-pointer select-none items-center justify-between rounded-[6px] bg-white/[0.03] px-2.5 py-1.5 text-[0.72rem] font-extrabold tracking-[0.5px] text-gold-light"
                onClick={() => toggleSection(group.id)}
              >
                <span>{group.label}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isOpen && (
                <div className="pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href ||
                      (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          NAV_ITEM,
                          'my-0.5 px-3 py-2 text-[0.82rem]',
                          active && NAV_ITEM_ACTIVE,
                        )}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Sidebar: Compliance & User Menu */}
      <div className="shrink-0 border-t border-line p-3 text-xs text-fg-muted">
        <div className="mb-2 flex items-center gap-2 px-1 font-semibold text-emerald-light">
          <ShieldCheck size={14} color="#10b981" />
          <span>SAK EMKM Compliant</span>
        </div>
        <p className="mb-2 px-1 text-[11px]">PPN 0% Export Dedicated</p>
        <AdminUserMenu side="top" />
      </div>
    </aside>
  );
}

AdminSidebar.displayName = 'AdminSidebar';
