import React from 'react';
import { Package, PlaneTakeoff, Flame, Hammer, TrendingUp, ShieldCheck } from 'lucide-react';

export default function Dashboard({ setActivePage }) {
  return (
    <div>
      <div className="dashboard-grid">
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Persediaan Vault LM</span>
            <div className="stat-val gold-gradient-text">2.500 g</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Valcambi & Antam 999.9</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', borderRadius: '12px', color: '#f59e0b' }}>
            <Package size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">PO Impor USD Active</span>
            <div className="stat-val">$150.000</div>
            <p style={{ fontSize: '0.75rem', color: '#34d399' }}>Landed Cost: Rp 1.222.500/g</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '12px', color: '#3b82f6' }}>
            <PlaneTakeoff size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">WIP Perhiasan Ekspor</span>
            <div className="stat-val">1.300 g</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Karat 750 (18K) & 700 (17K)</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(139,92,246,0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Fasilitas Pajak</span>
            <div className="stat-val" style={{ color: '#34d399' }}>PPN 0%</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ekspor Khusus (PEB / AWB)</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', color: '#10b981' }}>
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px' }}>
          ⚡ Akses Cepat Modul Utama PT TAN
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <button className="btn-primary" onClick={() => setActivePage('import-trading')}>
            <PlaneTakeoff size={18} /> PO LM Import & Landed Cost
          </button>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={() => setActivePage('scrap-melting')}>
            <Flame size={18} /> Beli Scrap & Lebur (Melting)
          </button>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }} onClick={() => setActivePage('jewelry-production')}>
            <Hammer size={18} /> Alloy Karat & Produksi WIP
          </button>
        </div>
      </div>
    </div>
  );
}
