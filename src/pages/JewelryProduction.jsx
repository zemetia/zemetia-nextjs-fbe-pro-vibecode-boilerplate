import React, { useState } from 'react';
import { Hammer, Sparkles, Layers, RefreshCw, Plus, CheckCircle2, Settings, Package, Sliders, Save } from 'lucide-react';
import Modal, { useModal } from '../components/ui/Modal';

export default function JewelryProduction() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('calculator'); // calculator, bom-settings, settlement

  // Dynamic BOM Presets State (Manual Setting, NOT hardcoded)
  const [bomFormulas, setBomFormulas] = useState([
    { code: '750', name: 'Karat 750 (18K Standard Ekspor)', fineGoldPct: 75.0, safetyMarginPct: 0.2, alloyAgPct: 15.0, alloyCuPct: 10.0, description: 'Standar Ekspor Dubai 18K Yellow Gold' },
    { code: '700', name: 'Karat 700 (17K Standard)', fineGoldPct: 70.0, safetyMarginPct: 0.2, alloyAgPct: 18.0, alloyCuPct: 12.0, description: 'Standar Perhiasan Lokal & Ekspor Asia' },
    { code: '375', name: 'Karat 375 (8K Light Gold)', fineGoldPct: 37.5, safetyMarginPct: 0.2, alloyAgPct: 35.0, alloyCuPct: 27.5, description: 'Karat Ekonomis Ekspor Europe/USA' }
  ]);

  // Calculator & SPK State
  const [orderForm, setOrderForm] = useState({
    buyerName: 'Dubai Gold & Jewelry DMCC',
    jewelryType: 'Cincin & Kalung Emas 18K',
    targetKarat: '750',
    grossWeight: 1000,
    lossTolerancePct: 1.5,
    masterAlloyType: 'Alloy Perak-Tembaga (Red/Yellow Gold)'
  });

  // Active Selected Formula
  const selectedFormula = bomFormulas.find(f => f.code === orderForm.targetKarat) || bomFormulas[0];

  // Calculate Materials based on Dynamic Formula Settings
  const effectiveFineGoldPct = selectedFormula.fineGoldPct + selectedFormula.safetyMarginPct;
  const fineGoldNeeded = orderForm.grossWeight * (effectiveFineGoldPct / 100) * (1 + orderForm.lossTolerancePct / 100);
  const masterAlloyNeeded = orderForm.grossWeight * ((100 - effectiveFineGoldPct) / 100);

  // BOM Formula Edit State
  const [editingFormula, setEditingFormula] = useState({
    code: '750',
    name: 'Karat 750 (18K Standard Ekspor)',
    fineGoldPct: 75.0,
    safetyMarginPct: 0.2,
    alloyAgPct: 15.0,
    alloyCuPct: 10.0,
    description: 'Standar Ekspor Dubai 18K'
  });

  // Settlement Form State (Hasil In-House Workshop)
  const [settlementForm, setSettlementForm] = useState({
    joNumber: 'JO-2026-001',
    jewelryOutputWeight: 985,
    scrapReturnWeight: 180,
    goldLossWeight: 15,
    laborFeeIDR: 15000000
  });

  const handleSaveFormula = (e) => {
    e.preventDefault();
    const updated = bomFormulas.map(f => f.code === editingFormula.code ? editingFormula : f);
    if (!bomFormulas.some(f => f.code === editingFormula.code)) {
      updated.push(editingFormula);
    }
    setBomFormulas(updated);
    showModal({ variant: 'success', title: '✅ Rumus BOM Diperbarui', message: `Formula BOM karat ${editingFormula.code} berhasil disimpan.` });
  };

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
      showModal({
        variant: 'success',
        title: '✅ SPK Produksi Terbit',
        message: `${fineGoldNeeded.toFixed(2)}g emas murni 999.9 dikeluarkan dari Vault Utama (1157) ke Vault Emas WIP (11502).`
      });
    }
  };

  const handleSettlementProduction = (e) => {
    e.preventDefault();
    showModal({
      variant: 'success',
      title: `✅ Settlement Produksi (${settlementForm.joNumber}) Tersimpan`,
      message: `${settlementForm.jewelryOutputWeight}g perhiasan jadi dipindahkan ke Vault Perhiasan Siap Ekspor (Akun 1160).`
    });
  };

  return (
    <div>
      {/* Header & Tab Navigation */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Hammer color="#8b5cf6" size={24} /> Produksi Perhiasan & Dynamic BOM Karat Setting
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kalkulator Raw Material Ekspor, Setting Formula BOM Karat Manual, & Settlement Hasil In-House Workshop
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
          {[
            { id: 'calculator', label: '🧮 Kalkulator Konversi & SPK WIP' },
            { id: 'bom-settings', label: '⚙️ Setting Formula BOM Karat (Manual)' },
            { id: 'settlement', label: '📦 Settlement Hasil In-House Workshop' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: activeTab === tab.id ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'rgba(15,23,42,0.6)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Calculator & SPK Issue */}
      {activeTab === 'calculator' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', color: '#a78bfa' }}>
            🧮 Kalkulator Konversi Raw Material Pesanan Ekspor
          </h3>

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
                <label className="form-label">Target Karat (Menggunakan Formula BOM)</label>
                <select
                  className="form-select"
                  value={orderForm.targetKarat}
                  onChange={e => setOrderForm({ ...orderForm, targetKarat: e.target.value })}
                >
                  {bomFormulas.map(f => (
                    <option key={f.code} value={f.code}>{f.name}</option>
                  ))}
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
                <label className="form-label">Toleransi Loss Lebur / Polishing (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={orderForm.lossTolerancePct}
                  onChange={e => setOrderForm({ ...orderForm, lossTolerancePct: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Real-time Dynamic BOM Output Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid rgba(139,92,246,0.4)' }}>
              <h4 style={{ color: '#a78bfa', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} /> Rincian Konversi Bahan Baku berdasarkan Setting Formula BOM {selectedFormula.code}:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <span className="stat-lbl">Emas Murni 999.9 (Fine Gold)</span>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.3rem' }}>
                    {fineGoldNeeded.toFixed(2)} Gram
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>Target: {selectedFormula.fineGoldPct}% + Safety Margin {selectedFormula.safetyMarginPct}%</small>
                </div>
                <div>
                  <span className="stat-lbl">Master Alloy Campuran (Perak/Tembaga)</span>
                  <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.3rem' }}>
                    {masterAlloyNeeded.toFixed(2)} Gram
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>Perak: {selectedFormula.alloyAgPct}% | Tembaga: {selectedFormula.alloyCuPct}%</small>
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
      )}

      {/* Tab 2: Manual Dynamic BOM Formula Settings */}
      {activeTab === 'bom-settings' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders color="#fbbf24" size={20} /> Form Setting Manual Formula BOM Karat (Dapat Disesuaikan)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            BOM di ERP PT TAN <strong>TIDAK DI-HARDCODE</strong>. Tim Engineer / R&D dapat menyesuaikan persentase kemurnian emas, safety margin, dan komposisi alloy secara manual.
          </p>

          <form onSubmit={handleSaveFormula} style={{ background: 'rgba(15,23,42,0.6)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Karat (misal 750, 700, 375)</label>
                <input
                  className="form-input"
                  value={editingFormula.code}
                  onChange={e => setEditingFormula({ ...editingFormula, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Formula Karat</label>
                <input
                  className="form-input"
                  value={editingFormula.name}
                  onChange={e => setEditingFormula({ ...editingFormula, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kadar Standar Emas Murni (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={editingFormula.fineGoldPct}
                  onChange={e => setEditingFormula({ ...editingFormula, fineGoldPct: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Safety Margin Tolerance (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={editingFormula.safetyMarginPct}
                  onChange={e => setEditingFormula({ ...editingFormula, safetyMarginPct: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Komposisi Perak Ag (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={editingFormula.alloyAgPct}
                  onChange={e => setEditingFormula({ ...editingFormula, alloyAgPct: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Komposisi Tembaga Cu (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={editingFormula.alloyCuPct}
                  onChange={e => setEditingFormula({ ...editingFormula, alloyCuPct: Number(e.target.value) })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '14px' }}>
              <Save size={16} /> Simpan Pengaturan Formula BOM Karat
            </button>
          </form>

          {/* Active Preset Formulas Table */}
          <h4 style={{ color: '#38bdf8', fontSize: '0.95rem', marginBottom: '12px' }}>📋 Daftar Preset Formula BOM Karat Aktif</h4>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Kode Karat</th>
                  <th>Nama Formula</th>
                  <th>Kadar Emas (%)</th>
                  <th>Safety Margin (%)</th>
                  <th>Effective Target (%)</th>
                  <th>Komposisi Alloy (Ag/Cu)</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bomFormulas.map(f => (
                  <tr key={f.code}>
                    <td><strong>{f.code}</strong></td>
                    <td>{f.name}</td>
                    <td style={{ color: '#fbbf24', fontWeight: 700 }}>{f.fineGoldPct}%</td>
                    <td>+{f.safetyMarginPct}%</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>{(f.fineGoldPct + f.safetyMarginPct).toFixed(1)}%</td>
                    <td>Perak: {f.alloyAgPct}% | Tembaga: {f.alloyCuPct}%</td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        onClick={() => setEditingFormula(f)}
                      >
                        Edit Formula
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Production Settlement */}
      {activeTab === 'settlement' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package color="#fbbf24" size={20} /> Form Settlement Laporan Hasil Produksi In-House Workshop
          </h3>

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
      )}

      <Modal {...modalProps} />
    </div>
  );
}
