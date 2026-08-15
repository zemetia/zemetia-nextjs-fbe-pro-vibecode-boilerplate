import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { PAGE_GROUPS, PINNED_PAGE_IDS, getMenuItems } from '../../config/pages';

export default function Sidebar({ activePage, setActivePage }) {
  // Collapsible category state
  const [openCategories, setOpenCategories] = useState(
    () => Object.fromEntries(PAGE_GROUPS.map(g => [g.id, true]))
  );

  const toggleCategory = (cat) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderNavItem = (item, key, className) => {
    const Icon = item.icon;
    return (
      <div
        key={key}
        className={`nav-item ${className} ${activePage === item.id ? 'active' : ''}`}
        onClick={() => setActivePage(item.id)}
      >
        <Icon size={className === 'nav-item-pinned' ? 18 : 16} />
        <span>{item.label}</span>
      </div>
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo/logo-tan.png" alt="Logo PT TAN" className="logo-icon" />
        <div>
          <h2 className="sidebar-brand-title">PT TAN ERP</h2>
          <p className="sidebar-brand-subtitle">Export &amp; Trading System</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Halaman tersemat (Executive Dashboard) */}
        {getMenuItems(PINNED_PAGE_IDS).map(item =>
          renderNavItem(item, item.id, 'nav-item-pinned')
        )}

        {/* Grouped Categories */}
        {PAGE_GROUPS.map(group => {
          const isOpen = openCategories[group.id];
          return (
            <div key={group.id} className="sidebar-group">
              <div className="sidebar-group-header" onClick={() => toggleCategory(group.id)}>
                <span>{group.title}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isOpen && (
                <div className="sidebar-group-items">
                  {getMenuItems(group.items).map(item =>
                    renderNavItem(item, `${group.id}-${item.id}`, 'nav-item-sub')
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-badge">
          <ShieldCheck size={14} color="#10b981" />
          <span>SAK EMKM Compliant</span>
        </div>
        <p>PPN 0% Export Dedicated</p>
      </div>
    </div>
  );
}
