import React, { useState } from 'react';
import { Flame, Scale, Activity, Plus } from 'lucide-react';
import NumberInput from '../components/ui/NumberInput';

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
      <div className="glass-panel p-6 mb-6">
        <h2 className="font-heading text-[1.2rem] mb-4 flex items-center gap-2.5">
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
            <NumberInput
              allowDecimal
              value={scrapItem.grossWeight}
              onChange={w => setScrapItem({ ...scrapItem, grossWeight: w, estimatedFineGold: w * (scrapItem.xrfPurity / 100) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kadar XRF Spectrometer (%)</label>
            <NumberInput
              allowDecimal
              value={scrapItem.xrfPurity}
              onChange={p => setScrapItem({ ...scrapItem, xrfPurity: p, estimatedFineGold: scrapItem.grossWeight * (p / 100) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Harga Beli Fine Gold / Gram (IDR)</label>
            <NumberInput
              value={scrapItem.pricePerFineGram}
              onChange={pricePerFineGram => setScrapItem({ ...scrapItem, pricePerFineGram })}
            />
          </div>
        </div>

        <div className="bg-[rgba(15,23,42,0.6)] p-4 rounded-[10px] my-4 mx-0 border border-[rgba(239,68,68,0.2)]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <div>
              <span className="stat-lbl">Estimasi Emas Murni (Fine Wt)</span>
              <div className="font-bold text-gold-light text-[1.1rem]">{scrapItem.estimatedFineGold.toFixed(2)} Gram</div>
            </div>
            <div>
              <span className="stat-lbl">Total Pembelian Scrap</span>
              <div className="font-extrabold text-emerald-light text-[1.1rem]">Rp {estimatedTotal.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <button className="btn-primary bg-[linear-gradient(135deg,_#ef4444,_#b91c1c)]">
          <Plus size={18} /> Buat Nota Pembelian Scrap & Masuk SPK Lebur
        </button>
      </div>
    </div>
  );
}
