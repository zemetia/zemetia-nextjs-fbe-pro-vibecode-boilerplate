'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronDown, PanelLeftClose, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks';
import { Logo } from '@/components/shared';
import { Typography } from '@/components/ui/Typography';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminUserMenu } from './AdminUserMenu';
import { NAV_SECTIONS, type NavItem } from './nav.config';

const CLOSED_SECTIONS_KEY = 'admin-sidebar:closed-sections';

export interface AdminSidebarProps {
  /** Icon rail — desktop only; the mobile drawer is always expanded. */
  collapsed?: boolean;
  /** Omitted in the drawer, where collapsing to a rail has no meaning. */
  onCollapse?: () => void;
  /** Replaces the collapse button with a close button (drawer only). */
  onClose?: () => void;
  /** Lets the drawer close itself once navigation happens. */
  onNavigate?: () => void;
}

/**
 * The sidebar surface. It floats as its own panel (rounded, bordered, lifted by
 * shadow) instead of bleeding to the viewport edge, so it reads as a sibling of
 * the page's Cards rather than as browser chrome — the light-first elevation
 * language in docs/blueprint/DESIGN_SYSTEM.md.
 *
 * The same panel is rendered twice by `AdminShell`: as the persistent column
 * from `md` up, and as the content of the mobile drawer below it. Width is the
 * caller's business, so the panel always fills the box it is given.
 */
export function AdminSidebar({
  collapsed = false,
  onCollapse,
  onClose,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [closedSections, setClosedSections] = useLocalStorage<string[]>(CLOSED_SECTIONS_KEY, []);

  // UI convenience only — hides nav entries the viewer can't reach. Never a
  // security boundary; each page enforces requirePermission() server-side.
  const permissions = new Set(session?.user.permissions ?? []);
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.has(item.permission)),
  })).filter((section) => section.items.length > 0);

  const toggleSection = (id: string) =>
    setClosedSections((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );

  return (
    <TooltipProvider delayDuration={150}>
      <div
        data-collapsed={collapsed}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md"
      >
        <span className="accent-bar h-0.5 w-full shrink-0" aria-hidden="true" />

        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-sidebar-border',
            collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onCollapse}
                  aria-label="Perluas sidebar"
                  className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <Logo size={28} priority />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Perluas sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Logo size={32} priority />
              <div className="min-w-0 flex-1">
                <Typography variant="small" className="block truncate font-bold tracking-tight">
                  TAN ERP
                </Typography>
                <Typography variant="muted" className="block truncate text-[11px]">
                  Panel Administrasi
                </Typography>
              </div>
              {(onClose ?? onCollapse) && (
                <button
                  type="button"
                  onClick={onClose ?? onCollapse}
                  aria-label={onClose ? 'Tutup navigasi' : 'Ciutkan sidebar'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  {onClose ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              )}
            </>
          )}
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {sections.map((section, index) => {
            const open = collapsed || !closedSections.includes(section.id);

            return (
              <div key={section.id} className={cn(index > 0 && 'mt-1')}>
                {collapsed ? (
                  index > 0 && <div className="mx-2 my-2 h-px bg-sidebar-border" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-wider text-foreground-subtle uppercase transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <span className="truncate">{section.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                        !open && '-rotate-90',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}

                {open && (
                  <ul className="mt-1 space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <SidebarLink
                          item={item}
                          collapsed={collapsed}
                          onNavigate={onNavigate}
                          active={
                            pathname === item.href ||
                            (pathname?.startsWith(`${item.href}/`) ?? false)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <AdminUserMenu compact={collapsed} />
        </div>
      </div>
    </TooltipProvider>
  );
}

AdminSidebar.displayName = 'AdminSidebar';

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center rounded-md text-sm transition-colors',
        collapsed ? 'h-9 w-9 justify-center' : 'gap-3 px-3 py-2',
        active
          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-xs'
          : 'font-medium text-foreground-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
      )}
    >
      {active && (
        <span
          className="accent-bar absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
          aria-hidden="true"
        />
      )}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          active ? 'text-primary' : 'text-foreground-subtle group-hover:text-primary',
        )}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
