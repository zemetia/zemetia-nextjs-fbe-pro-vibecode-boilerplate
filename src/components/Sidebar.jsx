import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, PlaneTakeoff, Flame, 
  FileText, CreditCard, Warehouse, BookOpen, Package, 
  Users, Truck, Hammer, ShieldCheck, ChevronDown, ChevronRight, BarChart3, Settings, Sparkles, ShoppingBag, PackageCheck
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage }) {
  // Collapsible category state
  const [openCategories, setOpenCategories] = useState({
    purchasing: true,
    sales: true,
    vault: true,
    accounting: true,
    system: true
  });

  const toggleCategory = (cat) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const menuGroups = [
    {
      id: 'purchasing',
      title: '📦 MODUL PEMBELIAN',
      items: [
        { id: 'import-trading', label: 'PO LM Import & Landed Cost', icon: PlaneTakeoff },
        { id: 'local-trading', label: 'PO LM Lokal IDR', icon: ShoppingCart },
        { id: 'scrap-melting', label: 'Beli Scrap & Lebur', icon: Flame },
        { id: 'goods-receipt', label: 'Penerimaan Barang (TTB / GRN)', icon: PackageCheck },
        { id: 'master-suppliers', label: 'Master Supplier Emas', icon: Truck },
      ]
    },
    {
      id: 'sales',
      title: '🏷️ MODUL PENJUALAN',
      items: [
        { id: 'export-so', label: 'Export Sales Order (Price Fixing)', icon: ShoppingBag },
        { id: 'export-invoicing', label: 'Faktur Ekspor USD (PPN 0%)', icon: FileText },
        { id: 'export-do', label: 'Surat Jalan Ekspor (Delivery Order)', icon: Truck },
        { id: 'master-customers', label: 'Master Buyer Ekspor', icon: Users },
      ]
    },
    {
      id: 'vault',
      title: '🏛️ GUDANG VAULT & OPERASIONAL',
      items: [
        { id: 'warehouse-mgmt', label: 'Posisi Vault & Kartu Stok', icon: Warehouse },
        { id: 'goods-receipt', label: 'Penerimaan Barang (TTB)', icon: PackageCheck },
        { id: 'jewelry-production', label: 'Produksi Perhiasan & Alloy', icon: Hammer },
        { id: 'master-finished-goods', label: 'Master Finished Goods (Perhiasan)', icon: Sparkles },
        { id: 'master-items', label: 'Master Emas & Bahan Baku', icon: Package },
      ]
    },
    {
      id: 'accounting',
      title: '💼 AKUNTANSI & KEUANGAN',
      items: [
        { id: 'accounting-reports', label: 'Jurnal Mutasi & Laporan Keuangan', icon: BarChart3 },
        { id: 'voucher-mgmt', label: 'Voucher Kas/Bank & Cek BG', icon: CreditCard },
        { id: 'master-cheques', label: 'Master Buku Cek & Limit Bank', icon: BookOpen },
        { id: 'coa-setting', label: 'Setting COA SAK EMKM', icon: BookOpen },
      ]
    },
    {
      id: 'system',
      title: '⚙️ SETTING & UTILITY',
      items: [
        { id: 'system-settings', label: 'Setting Logo, Backup & Restore', icon: Settings },
      ]
    }
  ];

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
        {/* Executive Dashboard */}
        <div
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActivePage('dashboard')}
          style={{ marginBottom: '12px', fontWeight: 700 }}
        >
          <LayoutDashboard size={18} />
          <span>Executive Dashboard</span>
        </div>

        {/* Grouped Categories */}
        {menuGroups.map(group => {
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
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <div
                        key={item.id}
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
