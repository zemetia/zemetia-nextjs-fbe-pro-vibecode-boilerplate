import React from 'react';
import { Package, PlaneTakeoff, Flame, Hammer, TrendingUp, ShieldCheck } from 'lucide-react';

export default function Dashboard({ setActivePage }) {
  return (
    <div>
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Persediaan Vault LM</span>
            <div className="stat-val bg-linear-135 from-[#fef08a] via-gold to-gold-dark bg-clip-text text-transparent">2.500 g</div>
            <p className="text-xs text-fg-soft">Valcambi & Antam 999.9</p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.1)] rounded-[12px] text-gold">
            <Package size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">PO Impor USD Active</span>
            <div className="stat-val">$150.000</div>
            <p className="text-xs text-emerald-light">Landed Cost: Rp 1.222.500/g</p>
          </div>
          <div className="p-3 bg-[rgba(59,130,246,0.1)] rounded-[12px] text-blue">
            <PlaneTakeoff size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">WIP Perhiasan Ekspor</span>
            <div className="stat-val">1.300 g</div>
            <p className="text-xs text-fg-soft">Karat 750 (18K) & 700 (17K)</p>
          </div>
          <div className="p-3 bg-[rgba(139,92,246,0.1)] rounded-[12px] text-purple">
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Fasilitas Pajak</span>
            <div className="stat-val text-emerald-light">PPN 0%</div>
            <p className="text-xs text-fg-soft">Ekspor Khusus (PEB / AWB)</p>
          </div>
          <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-[12px] text-emerald">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 mb-6">
        <h2 className="font-heading text-[1.2rem] mb-4">
          ⚡ Akses Cepat Modul Utama PT TAN
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <button className="btn-primary" onClick={() => setActivePage('import-trading')}>
            <PlaneTakeoff size={18} /> PO LM Import & Landed Cost
          </button>
          <button className="btn-primary bg-[linear-gradient(135deg,_#10b981,_#059669)]" onClick={() => setActivePage('scrap-melting')}>
            <Flame size={18} /> Beli Scrap & Lebur (Melting)
          </button>
          <button className="btn-primary bg-[linear-gradient(135deg,_#8b5cf6,_#6d28d9)]" onClick={() => setActivePage('jewelry-production')}>
            <Hammer size={18} /> Alloy Karat & Produksi WIP
          </button>
        </div>
      </div>
    </div>
  );
}
