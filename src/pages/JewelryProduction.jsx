import React, { useState } from 'react';
import { Hammer, Sparkles, Layers, RefreshCw, Plus, CheckCircle2, ArrowRight, Package } from 'lucide-react';

export default function JewelryProduction() {
  // Calculator & SPK State
  const [orderForm, setOrderForm] = useState({
    buyerName: 'Dubai Gold & Jewelry DMCC',
    jewelryType: 'Cincin & Kalung Emas 18K',
    targetKarat: '750',
    grossWeight: 1000,
    lossTolerancePct: 1.5,
    masterAlloyType: 'Alloy Perak-Tembaga (Red/Yellow Gold)'
  });

  // Calculate Materials
  const purityFraction = orderForm.targetKarat === '750' ? 0.75 : orderForm.targetKarat === '700' ? 0.70 : 0.375;
  const fineGoldNeeded = orderForm.grossWeight * purityFraction * (1 + orderForm.lossTolerancePct / 100);
  const masterAlloyNeeded = orderForm.grossWeight * (1 - purityFraction);

  // Settlement Form State (Hasil In-House Workshop)
  const [settlementForm, setSettlementForm] = useState({
    joNumber: 'JO-2026-001',
    jewelryOutputWeight: 985, // Gram perhiasan jadi
    scrapReturnWeight: 180, // Gram scrap leburan sisa
    goldLossWeight: 15, // Gram susut lebur (Loss)
    laborFeeIDR: 15000000 // Ongkos tukang
  });

  const handleIssueToWIP = (e) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && window.Storage) {
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        description: `Pengeluaran Bahan SPK Produksi ${orderForm.jewelryType} - ${orderForm.buyerName}`,
        lines: [
          { accountCode: '11502', accountName: 'Persediaan Emas WIP (Produksi)', debit: fineGoldNeeded * 1250000, credit: 0 },
          { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 0, credit: fineGoldNeeded * 1250000 }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);
      alert(`✅ SPK Produksi Terbit! ${fineGoldNeeded.toFixed(2)}g Emas Murni 999.9 Berhasil Dikeluarkan dari Vault Utama ke Vault Emas WIP (Akun 11502)!`);
    }
  };

  const handleSettlementProduction = (e) => {
    e.preventDefault();
    alert(`✅ Settlement Produksi (${settlementForm.joNumber}) Berhasil Disimpan! ${settlementForm.jewelryOutputWeight}g Perhiasan Jadi Dipindahkan ke Vault Perhiasan Siap Ekspor (Akun 1160)!`);
  };

  return (
    <div>
      {/* 1. Raw Material Converter & Issue to WIP */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Hammer color="#8b5cf6" size={22} /> Konversi Pesanan Client Ekspor & Pengeluaran Bahan ke Vault WIP
        </h2>

        <form onSubmit={handleIssueToWIP}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nama Client / Buyer Ekspor</label>
              <input
                className="form-input"
                value={orderForm.buyerName}
                onChange={e => setOrderForm({ ...orderForm, buyerName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jenis Perhiasan Pesanan</label>
              <input
                className="form-input"
                value={orderForm.jewelryType}
                onChange={e => setOrderForm({ ...orderForm, jewelryType: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Kadar / Karat</label>
              <select
                className="form-select"
                value={orderForm.targetKarat}
                onChange={e => setOrderForm({ ...orderForm, targetKarat: e.target.value })}
              >
                <option value="750">Karat 750 (18K - 75% Fine Gold)</option>
                <option value="700">Karat 700 (17K - 70% Fine Gold)</option>
                <option value="375">Karat 375 (8K - 37.5% Fine Gold)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Berat Pesanan Perhiasan (Gross Weight Gram)</label>
              <input
                type="number"
                className="form-input"
                value={orderForm.grossWeight}
                onChange={e => setOrderForm({ ...orderForm, grossWeight: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Toleransi Loss Lebur (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={orderForm.lossTolerancePct}
                onChange={e => setOrderForm({ ...orderForm, lossTolerancePct: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jenis Master Alloy Campuran</label>
              <input
                className="form-input"
                value={orderForm.masterAlloyType}
                onChange={e => setOrderForm({ ...orderForm, masterAlloyType: e.target.value })}
              />
            </div>
          </div>

          {/* Real-time Material Conversion Output Card */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid rgba(139,92,246,0.4)' }}>
            <h4 style={{ color: '#a78bfa', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} /> Rincian Konversi Kebutuhan Bahan Baku Emas Murni & Master Alloy:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <span className="stat-lbl">Emas Murni 999.9 (Fine Gold) Dibutuhkan</span>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.3rem' }}>
                  {fineGoldNeeded.toFixed(2)} Gram
                </div>
                <small style={{ color: 'var(--text-muted)' }}>(Termasuk toleransi loss {orderForm.lossTolerancePct}%)</small>
              </div>
              <div>
                <span className="stat-lbl">Master Alloy Campuran (Perak/Tembaga)</span>
                <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.3rem' }}>
                  {masterAlloyNeeded.toFixed(2)} Gram
                </div>
              </div>
              <div>
                <span className="stat-lbl">Posting Ke Vault ERP</span>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem' }}>
                  Debet: Akun 11502 (Vault Emas WIP)
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <Layers size={18} /> Terbitkan SPK & Keluarkan Bahan Emas Murni Ke Vault WIP
          </button>
        </form>
      </div>

      {/* 2. Production Settlement (Laporan Hasil In-House Workshop) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package color="#fbbf24" size={20} /> Form Settlement Laporan Hasil Produksi In-House Workshop
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Input rekap fisik hasil produksi dari aplikasi in-house untuk melunasi saldo Vault WIP dan memindahkan perhiasan ke Vault Siap Ekspor (Akun 1160).
        </p>

        <form onSubmit={handleSettlementProduction}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">No. SPK / Job Order</label>
              <input
                className="form-input"
                value={settlementForm.joNumber}
                onChange={e => setSettlementForm({ ...settlementForm, joNumber: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hasil Perhiasan Jadi (Gram)</label>
              <input
                type="number"
                className="form-input"
                value={settlementForm.jewelryOutputWeight}
                onChange={e => setSettlementForm({ ...settlementForm, jewelryOutputWeight: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Emas Scrap Retur / Sisa Leburan (Gram)</label>
              <input
                type="number"
                className="form-input"
                value={settlementForm.scrapReturnWeight}
                onChange={e => setSettlementForm({ ...settlementForm, scrapReturnWeight: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Susut Emas Lebur / Gold Loss (Gram)</label>
              <input
                type="number"
                className="form-input"
                value={settlementForm.goldLossWeight}
                onChange={e => setSettlementForm({ ...settlementForm, goldLossWeight: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Biaya Ongkos Tukang / Jasa Lebur (IDR)</label>
              <input
                type="number"
                className="form-input"
                value={settlementForm.laborFeeIDR}
                onChange={e => setSettlementForm({ ...settlementForm, laborFeeIDR: Number(e.target.value) })}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '16px' }}>
            <CheckCircle2 size={16} /> Pelunasan WIP & Transfer Perhiasan Ke Vault Siap Ekspor
          </button>
        </form>
      </div>
    </div>
  );
}
