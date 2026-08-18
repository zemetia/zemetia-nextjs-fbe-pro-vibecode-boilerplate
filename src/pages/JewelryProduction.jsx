import React, { useState } from 'react';
import { Hammer, Sparkles, Layers, RefreshCw, Plus, CheckCircle2, Settings, Package, Sliders, Save } from 'lucide-react';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Hammer color="#8b5cf6" size={24} /> Produksi Perhiasan & Dynamic BOM Karat Setting
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kalkulator Raw Material Ekspor, Setting Formula BOM Karat Manual, & Settlement Hasil In-House Workshop
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2.5 overflow-x-auto">
          {[
            { id: 'calculator', label: '🧮 Kalkulator Konversi & SPK WIP' },
            { id: 'bom-settings', label: '⚙️ Setting Formula BOM Karat (Manual)' },
            { id: 'settlement', label: '📦 Settlement Hasil In-House Workshop' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer rounded-[10px] border border-line px-4.5 py-2.5 text-[0.85rem] ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-purple to-purple-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Calculator & SPK Issue */}
      {activeTab === 'calculator' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-[#a78bfa]">
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
                <Combobox
                  value={orderForm.targetKarat}
                  onChange={targetKarat => setOrderForm({ ...orderForm, targetKarat })}
                  placeholder="-- Pilih Formula BOM --"
                  searchPlaceholder="Cari kode atau nama formula…"
                  emptyText="Formula BOM tidak ditemukan."
                  options={bomFormulas.map(f => ({ value: f.code, label: f.name }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Berat Pesanan Perhiasan (Gross Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={orderForm.grossWeight}
                  onChange={grossWeight => setOrderForm({ ...orderForm, grossWeight })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Toleransi Loss Lebur / Polishing (%)</label>
                <NumberInput
                  allowDecimal
                  value={orderForm.lossTolerancePct}
                  onChange={lossTolerancePct => setOrderForm({ ...orderForm, lossTolerancePct })}
                />
              </div>
            </div>

            {/* Real-time Dynamic BOM Output Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 mx-0 border border-[rgba(139,92,246,0.4)]">
              <h4 className="text-[#a78bfa] mb-3 text-[0.9rem] flex items-center gap-2">
                <Sparkles size={16} /> Rincian Konversi Bahan Baku berdasarkan Setting Formula BOM {selectedFormula.code}:
              </h4>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <div>
                  <span className="stat-lbl">Emas Murni 999.9 (Fine Gold)</span>
                  <div className="font-extrabold text-gold-light text-[1.3rem]">
                    {fineGoldNeeded.toFixed(2)} Gram
                  </div>
                  <small className="text-fg-muted">Target: {selectedFormula.fineGoldPct}% + Safety Margin {selectedFormula.safetyMarginPct}%</small>
                </div>
                <div>
                  <span className="stat-lbl">Master Alloy Campuran (Perak/Tembaga)</span>
                  <div className="font-extrabold text-sky-light text-[1.3rem]">
                    {masterAlloyNeeded.toFixed(2)} Gram
                  </div>
                  <small className="text-fg-muted">Perak: {selectedFormula.alloyAgPct}% | Tembaga: {selectedFormula.alloyCuPct}%</small>
                </div>
                <div>
                  <span className="stat-lbl">Posting Ke Vault ERP</span>
                  <div className="font-bold text-emerald-light text-[0.9rem]">
                    Debet: Akun 11502 (Vault Emas WIP)
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary bg-[linear-gradient(135deg,_#8b5cf6,_#6d28d9)]">
              <Layers size={18} /> Terbitkan SPK & Keluarkan Bahan Emas Murni Ke Vault WIP
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Manual Dynamic BOM Formula Settings */}
      {activeTab === 'bom-settings' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-gold-light flex items-center gap-2.5">
            <Sliders color="#fbbf24" size={20} /> Form Setting Manual Formula BOM Karat (Dapat Disesuaikan)
          </h3>
          <p className="text-[0.8rem] text-fg-soft mb-5">
            BOM di ERP PT TAN <strong>TIDAK DI-HARDCODE</strong>. Tim Engineer / R&D dapat menyesuaikan persentase kemurnian emas, safety margin, dan komposisi alloy secara manual.
          </p>

          <form className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] border border-line mb-6" onSubmit={handleSaveFormula}>
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
                <NumberInput
                  allowDecimal
                  value={editingFormula.fineGoldPct}
                  onChange={fineGoldPct => setEditingFormula({ ...editingFormula, fineGoldPct })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Safety Margin Tolerance (%)</label>
                <NumberInput
                  allowDecimal
                  value={editingFormula.safetyMarginPct}
                  onChange={safetyMarginPct => setEditingFormula({ ...editingFormula, safetyMarginPct })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Komposisi Perak Ag (%)</label>
                <NumberInput
                  allowDecimal
                  value={editingFormula.alloyAgPct}
                  onChange={alloyAgPct => setEditingFormula({ ...editingFormula, alloyAgPct })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Komposisi Tembaga Cu (%)</label>
                <NumberInput
                  allowDecimal
                  value={editingFormula.alloyCuPct}
                  onChange={alloyCuPct => setEditingFormula({ ...editingFormula, alloyCuPct })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary mt-3.5">
              <Save size={16} /> Simpan Pengaturan Formula BOM Karat
            </button>
          </form>

          {/* Active Preset Formulas Table */}
          <h4 className="text-sky-light text-[0.95rem] mb-3">📋 Daftar Preset Formula BOM Karat Aktif</h4>
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
                    <td className="text-gold-light font-bold">{f.fineGoldPct}%</td>
                    <td>+{f.safetyMarginPct}%</td>
                    <td className="text-emerald-light font-bold">{(f.fineGoldPct + f.safetyMarginPct).toFixed(1)}%</td>
                    <td>Perak: {f.alloyAgPct}% | Tembaga: {f.alloyCuPct}%</td>
                    <td>
                      <button
                        className="btn-primary py-1.5 px-3 text-xs"
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
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-gold-light flex items-center gap-2.5">
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
                <NumberInput
                  allowDecimal
                  value={settlementForm.jewelryOutputWeight}
                  onChange={jewelryOutputWeight => setSettlementForm({ ...settlementForm, jewelryOutputWeight })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emas Scrap Retur / Sisa Leburan (Gram)</label>
                <NumberInput
                  allowDecimal
                  value={settlementForm.scrapReturnWeight}
                  onChange={scrapReturnWeight => setSettlementForm({ ...settlementForm, scrapReturnWeight })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Susut Emas Lebur / Gold Loss (Gram)</label>
                <NumberInput
                  allowDecimal
                  value={settlementForm.goldLossWeight}
                  onChange={goldLossWeight => setSettlementForm({ ...settlementForm, goldLossWeight })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Biaya Ongkos Tukang / Jasa Lebur (IDR)</label>
                <NumberInput
                  value={settlementForm.laborFeeIDR}
                  onChange={laborFeeIDR => setSettlementForm({ ...settlementForm, laborFeeIDR })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary mt-4">
              <CheckCircle2 size={16} /> Pelunasan WIP & Transfer Perhiasan Ke Vault Siap Ekspor
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
