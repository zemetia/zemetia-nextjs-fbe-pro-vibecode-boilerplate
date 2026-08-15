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

  const pinnedItems = getMenuItems(PINNED_PAGE_IDS);

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">TAN</div>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>PT TAN ERP</h2>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Export & Trading System</p>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ padding: '12px 8px' }}>
        {/* Halaman tersemat (Executive Dashboard) */}
        {pinnedItems.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
              style={{ marginBottom: '12px', fontWeight: 700 }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </div>
          );
        })}

        {/* Grouped Categories */}
        {PAGE_GROUPS.map(group => {
          const isOpen = openCategories[group.id];
          return (
            <div key={group.id} style={{ marginBottom: '14px' }}>
              <div
                onClick={() => toggleCategory(group.id)}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#fbbf24',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  marginBottom: '4px'
                }}
              >
                <span>{group.title}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isOpen && (
                <div style={{ paddingLeft: '8px' }}>
                  {getMenuItems(group.items).map(item => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <div
                        key={`${group.id}-${item.id}`}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => setActivePage(item.id)}
                        style={{ padding: '8px 12px', fontSize: '0.82rem', margin: '2px 0' }}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span style={{ color: '#34d399', fontWeight: 600 }}>SAK EMKM Compliant</span>
        </div>
        <p>PPN 0% Export Dedicated</p>
      </div>
    </div>
  );
}
