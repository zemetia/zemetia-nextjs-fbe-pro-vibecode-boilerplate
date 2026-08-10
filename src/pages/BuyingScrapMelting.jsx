import React, { useState } from 'react';
import { Flame, Scale, Activity, Plus } from 'lucide-react';

export default function BuyingScrapMelting() {
  const [scrapItem, setScrapItem] = useState({
    supplierName: 'Toko Emas Mitra Sejahtera',
    grossWeight: 500,
    xrfPurity: 75.5, // 75.5% Kadar
    estimatedFineGold: 377.5, // 500 * 0.755
    pricePerFineGram: 1200000
  });

  const estimatedTotal = scrapItem.estimatedFineGold * scrapItem.pricePerFineGram;

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Flame color="#ef4444" size={22} /> Pembelian Pecahan Perhiasan (Scrap) & SPK Lebur
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Toko / Supplier Scrap</label>
            <input
              className="form-input"
              value={scrapItem.supplierName}
              onChange={e => setScrapItem({ ...scrapItem, supplierName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Berat Kotor Scrap (Gram)</label>
            <input
              type="number"
              className="form-input"
              value={scrapItem.grossWeight}
              onChange={e => {
                const w = Number(e.target.value);
                setScrapItem({ ...scrapItem, grossWeight: w, estimatedFineGold: w * (scrapItem.xrfPurity / 100) });
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kadar XRF Spectrometer (%)</label>
            <input
              type="number"
              className="form-input"
              value={scrapItem.xrfPurity}
              onChange={e => {
                const p = Number(e.target.value);
                setScrapItem({ ...scrapItem, xrfPurity: p, estimatedFineGold: scrapItem.grossWeight * (p / 100) });
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Harga Beli Fine Gold / Gram (IDR)</label>
            <input
              type="number"
              className="form-input"
              value={scrapItem.pricePerFineGram}
              onChange={e => setScrapItem({ ...scrapItem, pricePerFineGram: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <span className="stat-lbl">Estimasi Emas Murni (Fine Wt)</span>
              <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '1.1rem' }}>{scrapItem.estimatedFineGold.toFixed(2)} Gram</div>
            </div>
            <div>
              <span className="stat-lbl">Total Pembelian Scrap</span>
              <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.1rem' }}>Rp {estimatedTotal.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
          <Plus size={18} /> Buat Nota Pembelian Scrap & Masuk SPK Lebur
        </button>
      </div>
    </div>
  );
}
