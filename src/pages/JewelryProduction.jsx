import React, { useState } from 'react';
import { Hammer, Sparkles, Layers, RefreshCw } from 'lucide-react';

export default function JewelryProduction() {
  const [karatCalc, setKaratCalc] = useState({
    targetKarat: '750', // 750 (18K)
    totalBatchWeight: 1000, // 1000 gram alloyed gold batch
    targetPurityPct: 75.2 // 75.2% (Safety margin 750)
  });

  const fineGoldRequired = karatCalc.totalBatchWeight * (karatCalc.targetPurityPct / 100);
  const masterAlloyRequired = karatCalc.totalBatchWeight - fineGoldRequired;

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Hammer color="#8b5cf6" size={22} /> Alloy Karat Calculator & Produksi Perhiasan WIP
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Target Kadar / Karat</label>
            <select
              className="form-select"
              value={karatCalc.targetKarat}
              onChange={e => {
                const k = e.target.value;
                const p = k === '750' ? 75.2 : k === '700' ? 70.2 : 37.7;
                setKaratCalc({ ...karatCalc, targetKarat: k, targetPurityPct: p });
              }}
            >
              <option value="750">Karat 750 (18K - 75.2% Target)</option>
              <option value="700">Karat 700 (17K - 70.2% Target)</option>
              <option value="375">Karat 375 (8K - 37.7% Target)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Total Berat Batch Emas Alloy (Gram)</label>
            <input
              type="number"
              className="form-input"
              value={karatCalc.totalBatchWeight}
              onChange={e => setKaratCalc({ ...karatCalc, totalBatchWeight: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(139,92,246,0.3)' }}>
          <h4 style={{ color: '#a78bfa', marginBottom: '12px', fontSize: '0.9rem' }}>🧮 Hasil Perhitungan Formula Campuran Lebur:</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <span className="stat-lbl">Fine Gold 999.9 Dibutuhkan</span>
              <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.2rem' }}>{fineGoldRequired.toFixed(2)} Gram</div>
            </div>
            <div>
              <span className="stat-lbl">Master Alloy (Perak/Tembaga)</span>
              <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.2rem' }}>{masterAlloyRequired.toFixed(2)} Gram</div>
            </div>
          </div>
        </div>

        <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
          <Layers size={18} /> Relevansi Pengeluaran Bahan Ke WIP Produksi
        </button>
      </div>
    </div>
  );
}
