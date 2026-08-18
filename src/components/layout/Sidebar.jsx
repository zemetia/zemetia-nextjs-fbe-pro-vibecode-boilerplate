import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { PAGE_GROUPS, PINNED_PAGE_IDS, getMenuItems } from '../../config/pages';
import { cn } from '../../utils/cn';

// Kelas dasar satu item menu. Varian `pinned` dan `sub` menimpa padding dan
// ukuran font lewat cn() — twMerge yang memutuskan pemenangnya, bukan urutan
// kemunculan utility di file CSS hasil build.
const NAV_ITEM =
  'flex cursor-pointer items-center gap-3.5 rounded-sm px-4 py-3 text-[0.9rem] font-medium ' +
  'text-fg-soft transition-all duration-200 hover:bg-white/5 hover:text-fg';

const NAV_ITEM_ACTIVE =
  'border-l-[3px] border-gold bg-linear-90 from-gold/20 to-gold/5 font-semibold text-gold-light';

export default function Sidebar({ activePage, setActivePage }) {
  // Collapsible category state
  const [openCategories, setOpenCategories] = useState(
    () => Object.fromEntries(PAGE_GROUPS.map(g => [g.id, true]))
  );

  const toggleCategory = (cat) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderNavItem = (item, key, pinned) => {
    const Icon = item.icon;
    return (
      <div
        key={key}
        className={cn(
          NAV_ITEM,
          pinned ? 'mb-3 font-bold' : 'my-0.5 px-3 py-2 text-[0.82rem]',
          activePage === item.id && NAV_ITEM_ACTIVE
        )}
        onClick={() => setActivePage(item.id)}
      >
        <Icon size={pinned ? 18 : 16} />
        <span>{item.label}</span>
      </div>
    );
  };

  return (
    <div className="fixed left-0 top-0 z-[100] flex h-screen w-[260px] flex-col overflow-hidden border-r border-line bg-ink">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-6 py-5">
        <img
          src="/logo/logo-tan.png"
          alt="Logo PT TAN"
          className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-[0_4px_12px_var(--color-gold-glow)]"
        />
        <div>
          <h2 className="font-heading text-base font-bold">PT TAN ERP</h2>
          <p className="text-[0.7rem] text-fg-muted">Export &amp; Trading System</p>
        </div>
      </div>

      <nav className="scrollbar-gold flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2 py-3">
        {/* Halaman tersemat (Executive Dashboard) */}
        {getMenuItems(PINNED_PAGE_IDS).map(item =>
          renderNavItem(item, item.id, true)
        )}

        {/* Grouped Categories */}
        {PAGE_GROUPS.map(group => {
          const isOpen = openCategories[group.id];
          return (
            <div key={group.id} className="mb-3.5">
              <div
                className="mb-1 flex cursor-pointer select-none items-center justify-between rounded-[6px] bg-white/[0.03] px-2.5 py-1.5 text-[0.72rem] font-extrabold tracking-[0.5px] text-gold-light"
                onClick={() => toggleCategory(group.id)}
              >
                <span>{group.title}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isOpen && (
                <div className="pl-2">
                  {getMenuItems(group.items).map(item =>
                    renderNavItem(item, `${group.id}-${item.id}`, false)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-4 text-xs text-fg-muted">
        <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-light">
          <ShieldCheck size={14} color="#10b981" />
          <span>SAK EMKM Compliant</span>
        </div>
        <p>PPN 0% Export Dedicated</p>
      </div>
    </div>
  );
}
