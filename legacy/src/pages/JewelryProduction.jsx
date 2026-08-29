import React, { useState, useEffect } from 'react';
import {
  Hammer, Sparkles, Layers, RefreshCw, Plus, CheckCircle2,
  Settings, Package, Sliders, Save, Printer, Search, Filter,
  FileText, Scale, Clock, ArrowRight, Eye, AlertCircle
} from 'lucide-react';
import {
  getProductionSPK,
  saveProductionSPKList,
  updateProductionSPKStatus,
  getProductionSettlements,
  saveProductionSettlements,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber
} from '../services/storageService';
import { exportProductionSPKPdf } from '../services/pdfService';
import {
  Modal,
  useModal,
  Combobox,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Badge
} from '../components/ui';

export default function JewelryProduction() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('calculator'); // calculator, spk-register, settlement, settlement-history, bom-settings

  // Data Collections State
  const [spkList, setSpkList] = useState([]);
  const [settlementList, setSettlementList] = useState([]);

  // Search & Filter States
  const [searchSPK, setSearchSPK] = useState('');
  const [filterSPKStatus, setFilterSPKStatus] = useState('ALL'); // ALL, IN_WIP, COMPLETED
  const [searchSettlement, setSearchSettlement] = useState('');

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
    masterAlloyType: 'Alloy Perak-Tembaga (Red/Yellow Gold)',
    notes: 'Pengeluaran bahan baku emas murni ke Vault WIP (11502)'
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
    joNumber: `JO-${Date.now().toString().slice(-4)}`,
    spkNo: 'SPK-PROD-2026-001',
    buyerName: 'Dubai Gold & Jewelry DMCC',
    karat: '750',
    jewelryOutputWeight: 985,
    scrapReturnWeight: 180,
    goldLossWeight: 15,
    laborFeeIDR: 15000000,
    notes: 'Penyelesaian perhiasan jadi ekspor Dubai'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    setSpkList(getProductionSPK());
    setSettlementList(getProductionSettlements());
  };

  // KPI Computations
  const activeSPKCount = spkList.filter(s => s.status === 'IN_WIP').length;
  const completedSPKCount = spkList.filter(s => s.status === 'COMPLETED').length;
  const totalFineGoldWip = spkList
    .filter(s => s.status === 'IN_WIP')
    .reduce((sum, s) => sum + (Number(s.fineGoldNeeded) || 0), 0);
  const totalFinishedJewelry = settlementList
    .reduce((sum, s) => sum + (Number(s.jewelryOutputWeight) || 0), 0);

  // Print PDF SPK Handler
  const handlePrintSPK = async (spk) => {
    try {
      const res = await exportProductionSPKPdf(spk);
      if (res === false) {
        showModal({
          variant: 'warning',
          title: 'Pustaka PDF Belum Siap',
          message: 'Pustaka pembuat PDF belum selesai dimuat di browser. Silakan coba kembali.'
        });
      }
    } catch (err) {
      console.error('Error exporting SPK PDF:', err);
      showModal({
        variant: 'danger',
        title: 'Gagal Cetak PDF',
        message: err.message || 'Terjadi kesalahan saat memproses cetak dokumen SPK.'
      });
    }
  };

  // Switch to Settlement tab with pre-filled SPK data
  const handleSelectSPKForSettlement = (spk) => {
    const defaultOutput = Number((spk.grossWeight * 0.98).toFixed(2));
    const defaultScrap = Number((spk.grossWeight * 0.015).toFixed(2));
    const defaultLoss = Number((spk.grossWeight * 0.005).toFixed(2));

    setSettlementForm({
      joNumber: `JO-${spk.spkNo ? spk.spkNo.replace('SPK-PROD-', '') : Date.now().toString().slice(-4)}`,
      spkNo: spk.spkNo || spk.id,
      buyerName: spk.buyerName || '',
      karat: spk.targetKarat || '750',
      jewelryOutputWeight: defaultOutput,
      scrapReturnWeight: defaultScrap,
      goldLossWeight: defaultLoss,
      laborFeeIDR: 15000000,
      notes: `Penyelesaian SPK ${spk.spkNo} (${spk.jewelryType}) untuk ${spk.buyerName}`
    });
    setActiveTab('settlement');
  };

  // Formula Save Handler
  const handleSaveFormula = (e) => {
    e.preventDefault();
    const updated = bomFormulas.map(f => f.code === editingFormula.code ? editingFormula : f);
    if (!bomFormulas.some(f => f.code === editingFormula.code)) {
      updated.push(editingFormula);
    }
    setBomFormulas(updated);
    showModal({
      variant: 'success',
      title: '✅ Rumus BOM Diperbarui',
      message: `Formula BOM karat ${editingFormula.code} (${editingFormula.name}) berhasil disimpan.`
    });
  };

  // Issue SPK to WIP Handler
  const handleIssueToWIP = async (e) => {
    e.preventDefault();

    if (!orderForm.buyerName || !orderForm.grossWeight || orderForm.grossWeight <= 0) {
      showModal({
        variant: 'warning',
        title: 'Data Belum Lengkap',
        message: 'Mohon lengkapi Nama Buyer/Client dan Berat Pesanan Perhiasan (Gross Weight).'
      });
      return;
    }

    const seqNumber = await getNextReferenceNumber('spk');
    const spkId = `SPK-${Date.now().toString().slice(-6)}`;
    const spkRecord = {
      id: spkId,
      spkNo: seqNumber || `SPK-PROD-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      buyerName: orderForm.buyerName,
      jewelryType: orderForm.jewelryType,
      targetKarat: orderForm.targetKarat,
      grossWeight: Number(orderForm.grossWeight),
      lossTolerancePct: Number(orderForm.lossTolerancePct),
      fineGoldNeeded: Number(fineGoldNeeded.toFixed(2)),
      masterAlloyNeeded: Number(masterAlloyNeeded.toFixed(2)),
      notes: orderForm.notes || 'Pengeluaran bahan baku emas murni ke Vault WIP (11502)',
      status: 'IN_WIP',
      createdAt: new Date().toISOString()
    };

    const updatedList = [spkRecord, ...spkList];
    setSpkList(updatedList);
    await saveProductionSPKList(updatedList);

    // Auto-Post Jurnal Pengeluaran Bahan ke Vault WIP
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    const goldValueIDR = fineGoldNeeded * 1300000;

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: spkRecord.date,
      description: `Pengeluaran Bahan SPK Produksi ${orderForm.jewelryType} (${spkRecord.spkNo}) - ${orderForm.buyerName}`,
      lines: [
        { accountCode: '11502', accountName: 'Persediaan Emas WIP (Produksi)', debit: goldValueIDR, credit: 0 },
        { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 0, credit: goldValueIDR }
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    showModal({
      variant: 'success',
      title: `✅ SPK Produksi (${spkRecord.spkNo}) Terbit`,
      message: `• ${fineGoldNeeded.toFixed(2)}g emas murni 999.9 dikeluarkan dari Vault Utama (1157) ke Vault Emas WIP (11502).\n• Master Alloy Campuran: ${masterAlloyNeeded.toFixed(2)}g\n• Jurnal Debet 11502 vs Kredit 1157 telah berhasil diposting.`,
      confirmText: '🖨️ Cetak PDF SPK',
      cancelText: 'Tutup',
      onConfirm: () => handlePrintSPK(spkRecord)
    });
  };

  // Settlement Production Handler
  const handleSettlementProduction = async (e) => {
    e.preventDefault();
    const outputWeight = Number(settlementForm.jewelryOutputWeight || 0);
    const scrapWeight = Number(settlementForm.scrapReturnWeight || 0);
    const lossWeight = Number(settlementForm.goldLossWeight || 0);
    const laborFee = Number(settlementForm.laborFeeIDR || 0);
    const totalWipDeducted = outputWeight + scrapWeight + lossWeight;

    if (outputWeight <= 0) {
      showModal({
        variant: 'warning',
        title: 'Hasil Jadi Masih Kosong',
        message: 'Mohon masukkan berat hasil perhiasan jadi yang diperoleh dari workshop.'
      });
      return;
    }

    const settlementRecord = {
      id: settlementForm.joNumber || `JO-${Date.now().toString().slice(-4)}`,
      joNumber: settlementForm.joNumber || `JO-${Date.now().toString().slice(-4)}`,
      spkNo: settlementForm.spkNo || '-',
      buyerName: settlementForm.buyerName || orderForm.buyerName,
      date: new Date().toISOString().split('T')[0],
      jewelryOutputWeight: outputWeight,
      scrapReturnWeight: scrapWeight,
      goldLossWeight: lossWeight,
      totalWipDeducted: totalWipDeducted,
      laborFeeIDR: laborFee,
      karat: settlementForm.karat || orderForm.targetKarat || '750',
      notes: settlementForm.notes || 'Settlement hasil in-house workshop',
      status: 'COMPLETED',
      createdAt: new Date().toISOString()
    };

    const updatedSettlements = [settlementRecord, ...settlementList];
    setSettlementList(updatedSettlements);
    await saveProductionSettlements(updatedSettlements);

    // Update Status SPK Terkait Menjadi COMPLETED
    if (settlementForm.spkNo) {
      await updateProductionSPKStatus(settlementForm.spkNo, 'COMPLETED');
      const updatedSpk = spkList.map(s =>
        (s.spkNo === settlementForm.spkNo || s.id === settlementForm.spkNo)
          ? { ...s, status: 'COMPLETED' }
          : s
      );
      setSpkList(updatedSpk);
    }

    // Auto-post settlement journal SAK EMKM
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    const totalWipValue = totalWipDeducted * 1300000;
    const jewelryValue = (outputWeight * 1350000) + laborFee;
    const scrapValue = scrapWeight * 1200000;
    const lossValue = lossWeight * 1300000;

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: settlementRecord.date,
      description: `Settlement Produksi Workshop (${settlementForm.joNumber} - SPK: ${settlementForm.spkNo}): Hasil Perhiasan ${outputWeight}g (Vault 1160) | Scrap Retur ${scrapWeight}g (Vault 1152) | Susut Lebur ${lossWeight}g`,
      lines: [
        { accountCode: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor', debit: jewelryValue, credit: 0 },
        ...(scrapWeight > 0 ? [{ accountCode: '1152', accountName: 'Persediaan Emas Scrap & Leburan', debit: scrapValue, credit: 0 }] : []),
        ...(lossWeight > 0 ? [{ accountCode: '5141', accountName: 'Susut Produksi Normal (Yield Loss Lebur)', debit: lossValue, credit: 0 }] : []),
        { accountCode: '11502', accountName: 'Persediaan Emas WIP (Produksi)', debit: 0, credit: totalWipValue },
        ...(laborFee > 0 ? [{ accountCode: '2110', accountName: 'Hutang Biaya Ongkos Tukang (Labor)', debit: 0, credit: laborFee }] : [])
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    showModal({
      variant: 'success',
      title: `✅ Settlement Produksi (${settlementForm.joNumber}) Selesai`,
      message: `• ${outputWeight}g perhiasan jadi dipindahkan ke Vault Perhiasan Siap Ekspor (Akun 1160).\n• ${scrapWeight}g scrap retur masuk ke Vault Scrap (Akun 1152).\n• ${lossWeight}g susut dicatat ke Beban Susut Lebur (Akun 5120).\n• Saldo Vault WIP (11502) berkurang ${totalWipDeducted}g.\n• Status SPK ${settlementForm.spkNo} diperbarui menjadi SELESAI.`
    });
  };

  // Filtered SPK List
  const filteredSPKList = spkList.filter(spk => {
    const matchSearch =
      (spk.spkNo || '').toLowerCase().includes(searchSPK.toLowerCase()) ||
      (spk.buyerName || '').toLowerCase().includes(searchSPK.toLowerCase()) ||
      (spk.jewelryType || '').toLowerCase().includes(searchSPK.toLowerCase()) ||
      (spk.targetKarat || '').toLowerCase().includes(searchSPK.toLowerCase());

    if (filterSPKStatus === 'IN_WIP') return matchSearch && spk.status === 'IN_WIP';
    if (filterSPKStatus === 'COMPLETED') return matchSearch && spk.status === 'COMPLETED';
    return matchSearch;
  });

  // Filtered Settlement List
  const filteredSettlementList = settlementList.filter(st => {
    return (
      (st.joNumber || '').toLowerCase().includes(searchSettlement.toLowerCase()) ||
      (st.spkNo || '').toLowerCase().includes(searchSettlement.toLowerCase()) ||
      (st.buyerName || '').toLowerCase().includes(searchSettlement.toLowerCase()) ||
      (st.karat || '').toLowerCase().includes(searchSettlement.toLowerCase())
    );
  });

  // Active SPK Options for Settlement Dropdown
  const activeSPKOptions = spkList.map(s => ({
    value: s.spkNo || s.id,
    label: `${s.spkNo || s.id} — ${s.buyerName} (${s.jewelryType} - Karat ${s.targetKarat} - ${s.status === 'COMPLETED' ? 'Selesai' : 'Aktif WIP'})`
  }));

  // Real-time Settlement Reconciliation Calculation
  const totalSettlementAccounted =
    Number(settlementForm.jewelryOutputWeight || 0) +
    Number(settlementForm.scrapReturnWeight || 0) +
    Number(settlementForm.goldLossWeight || 0);

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary Cards */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Hammer color="#f97316" size={24} /> Produksi Perhiasan, SPK & Dynamic BOM Setting
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kalkulator Raw Material Ekspor, Register SPK Aktif, Cetak SPK PDF, Settlement Workshop & BOM Karat SAK EMKM
            </p>
          </div>
        </div>

        {/* 4 KPI Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-surface/50 border border-line flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-orange/10 border border-orange/20 text-orange">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-[0.75rem] text-fg-soft font-medium">Total SPK Terbit</span>
              <div className="text-xl font-bold text-fg font-mono">{spkList.length}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface/50 border border-line flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-sky/10 border border-sky/20 text-sky">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[0.75rem] text-fg-soft font-medium">SPK Aktif (IN WIP)</span>
              <div className="text-xl font-bold text-sky font-mono">{activeSPKCount}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface/50 border border-line flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-gold/10 border border-gold/20 text-gold">
              <Scale size={20} />
            </div>
            <div>
              <span className="text-[0.75rem] text-fg-soft font-medium">Emas Murni di Vault WIP</span>
              <div className="text-xl font-bold text-gold font-mono">{totalFineGoldWip.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface/50 border border-line flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-emerald/10 border border-emerald/20 text-emerald">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span className="text-[0.75rem] text-fg-soft font-medium">Hasil Perhiasan Jadi</span>
              <div className="text-xl font-bold text-emerald font-mono">{totalFinishedJewelry.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2.5 overflow-x-auto">
          {[
            { id: 'calculator', label: '🧮 Buat SPK & Hitung BOM' },
            { id: 'spk-register', label: `📋 Register SPK Aktif (${activeSPKCount})` },
            { id: 'settlement', label: '📦 Input Settlement Workshop' },
            { id: 'settlement-history', label: `📊 Riwayat Settlement (${settlementList.length})` },
            { id: 'bom-settings', label: '⚙️ Setting BOM Karat' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer rounded-[10px] border border-line px-4.5 py-2.5 text-[0.85rem] transition-all ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-orange to-orange-dark font-bold text-white shadow-md'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft hover:text-fg hover:bg-surface/80'
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading text-[1.1rem] text-orange-light flex items-center gap-2">
              <Sparkles size={18} /> Kalkulator Konversi Raw Material & Penerbitan SPK Produksi
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('spk-register')}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <FileText size={14} /> Lihat Register SPK
            </button>
          </div>

          <form onSubmit={handleIssueToWIP}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nama Client / Buyer Ekspor</label>
                <input
                  className="form-input"
                  value={orderForm.buyerName}
                  onChange={e => setOrderForm({ ...orderForm, buyerName: e.target.value })}
                  placeholder="Contoh: Dubai Gold & Jewelry DMCC"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Jenis Perhiasan Pesanan</label>
                <input
                  className="form-input"
                  value={orderForm.jewelryType}
                  onChange={e => setOrderForm({ ...orderForm, jewelryType: e.target.value })}
                  placeholder="Contoh: Cincin & Kalung Emas 18K"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Karat (Formula BOM Terdaftar)</label>
                <Combobox
                  value={orderForm.targetKarat}
                  onChange={targetKarat => setOrderForm({ ...orderForm, targetKarat })}
                  placeholder="-- Pilih Formula BOM --"
                  searchPlaceholder="Cari kode atau nama formula…"
                  emptyText="Formula BOM tidak ditemukan."
                  options={bomFormulas.map(f => ({ value: f.code, label: `${f.name} (Kadar ${f.fineGoldPct}%)` }))}
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
              <div className="form-group">
                <label className="form-label">Tipe Master Alloy Campuran</label>
                <input
                  className="form-input"
                  value={orderForm.masterAlloyType}
                  onChange={e => setOrderForm({ ...orderForm, masterAlloyType: e.target.value })}
                />
              </div>
            </div>

            {/* Real-time Dynamic BOM Output Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 border border-orange/40">
              <h4 className="text-orange-light mb-3 text-[0.9rem] flex items-center gap-2">
                <Sparkles size={16} /> Rincian Konversi Bahan Baku berdasarkan Setting Formula BOM {selectedFormula.code}:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Emas Murni 999.9 (Fine Gold)</span>
                  <div className="font-extrabold text-gold text-[1.3rem]">
                    {fineGoldNeeded.toFixed(2)} Gram
                  </div>
                  <small className="text-fg-muted">Target: {selectedFormula.fineGoldPct}% + Safety Margin {selectedFormula.safetyMarginPct}%</small>
                </div>
                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Master Alloy Campuran (Perak/Tembaga)</span>
                  <div className="font-extrabold text-sky text-[1.3rem]">
                    {masterAlloyNeeded.toFixed(2)} Gram
                  </div>
                  <small className="text-fg-muted">Perak: {selectedFormula.alloyAgPct}% | Tembaga: {selectedFormula.alloyCuPct}%</small>
                </div>
                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Posting Persediaan SAK EMKM</span>
                  <div className="font-bold text-emerald text-[0.85rem] mt-1">
                    • Debet: Akun 11502 (Vault Emas WIP)
                  </div>
                  <div className="font-bold text-danger text-[0.85rem]">
                    • Kredit: Akun 1157 (Vault Utama LM 999.9)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary bg-linear-135 from-orange to-orange-dark">
                <Layers size={18} /> Terbitkan SPK & Keluarkan Bahan Emas Murni Ke Vault WIP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: SPK Register (Active & History) */}
      {activeTab === 'spk-register' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
            <div>
              <h3 className="font-heading text-[1.1rem] text-gold-light flex items-center gap-2">
                <FileText size={18} /> Register Surat Perintah Kerja (SPK) Produksi Perhiasan
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Daftar SPK aktif yang sedang diproses di workshop dan riwayat SPK selesai
              </p>
            </div>
            <button
              onClick={() => setActiveTab('calculator')}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Terbitkan SPK Baru
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 text-fg-muted" size={16} />
              <input
                type="text"
                className="form-input pl-9 text-xs"
                placeholder="Cari nomor SPK, nama buyer, jenis perhiasan, atau karat…"
                value={searchSPK}
                onChange={e => setSearchSPK(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {[
                { id: 'ALL', label: 'Semua Status' },
                { id: 'IN_WIP', label: `⏳ Aktif WIP (${activeSPKCount})` },
                { id: 'COMPLETED', label: `✅ Selesai (${completedSPKCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterSPKStatus(f.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    filterSPKStatus === f.id
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-line bg-surface/50 text-fg-soft hover:text-fg'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* SPK Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. SPK</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Buyer / Client</TableHead>
                <TableHead>Jenis Perhiasan</TableHead>
                <TableHead>Target Karat</TableHead>
                <TableHead className="text-right">Gross Target (g)</TableHead>
                <TableHead className="text-right">Fine Gold 999.9 (g)</TableHead>
                <TableHead className="text-right">Alloy (g)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSPKList.length === 0 ? (
                <TableEmpty colSpan={10} message="Tidak ada dokumen SPK Produksi yang sesuai filter." />
              ) : (
                filteredSPKList.map(spk => (
                  <TableRow key={spk.id || spk.spkNo}>
                    <TableCell>
                      <strong className="font-mono text-gold">{spk.spkNo || spk.id}</strong>
                    </TableCell>
                    <TableCell className="text-xs text-fg-soft">{spk.date || '-'}</TableCell>
                    <TableCell className="font-medium">{spk.buyerName || '-'}</TableCell>
                    <TableCell className="text-xs">{spk.jewelryType || 'Perhiasan Emas'}</TableCell>
                    <TableCell>
                      <Badge variant="warning">Karat {spk.targetKarat || '750'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {Number(spk.grossWeight || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gold font-bold">
                      {Number(spk.fineGoldNeeded || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sky">
                      {Number(spk.masterAlloyNeeded || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {spk.status === 'COMPLETED' ? (
                        <Badge variant="success">✅ Selesai</Badge>
                      ) : (
                        <Badge variant="warning">⏳ IN WIP</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrintSPK(spk)}
                          className="btn-secondary py-1 px-2 text-xs flex items-center gap-1 hover:border-gold hover:text-gold"
                          title="Cetak Dokumen PDF SPK"
                        >
                          <Printer size={13} /> Cetak
                        </button>
                        {spk.status === 'IN_WIP' && (
                          <button
                            onClick={() => handleSelectSPKForSettlement(spk)}
                            className="btn-primary py-1 px-2 text-xs flex items-center gap-1 bg-linear-135 from-orange to-orange-dark"
                            title="Lakukan Settlement Hasil Workshop"
                          >
                            <CheckCircle2 size={13} /> Selesaikan
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 3: Production Settlement Form */}
      {activeTab === 'settlement' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading text-[1.1rem] text-gold-light flex items-center gap-2.5">
              <Package color="#fbbf24" size={20} /> Form Settlement Laporan Hasil Produksi In-House Workshop
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('settlement-history')}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <FileText size={14} /> Lihat Riwayat Settlement
            </button>
          </div>

          <form onSubmit={handleSettlementProduction}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Referensi SPK Aktif</label>
                <Combobox
                  value={settlementForm.spkNo}
                  onChange={spkNo => {
                    const selected = spkList.find(s => (s.spkNo === spkNo || s.id === spkNo));
                    if (selected) {
                      setSettlementForm({
                        ...settlementForm,
                        spkNo: selected.spkNo || selected.id,
                        buyerName: selected.buyerName,
                        karat: selected.targetKarat,
                        jewelryOutputWeight: Number((selected.grossWeight * 0.98).toFixed(2)),
                        scrapReturnWeight: Number((selected.grossWeight * 0.015).toFixed(2)),
                        goldLossWeight: Number((selected.grossWeight * 0.005).toFixed(2))
                      });
                    } else {
                      setSettlementForm({ ...settlementForm, spkNo });
                    }
                  }}
                  placeholder="-- Pilih SPK Aktif --"
                  searchPlaceholder="Cari nomor SPK aktif…"
                  emptyText="SPK tidak ditemukan."
                  options={activeSPKOptions}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Settlement / Job Order (JO)</label>
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

            {/* Reconciliation Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 border border-line">
              <h4 className="text-gold-light mb-3 text-[0.9rem] flex items-center gap-2">
                <Scale size={16} /> Rekonsiliasi Hasil Produksi Workshop (Kaidah Konservasi Massa Emas):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Perhiasan Jadi (Akun 1160)</span>
                  <div className="font-extrabold text-emerald text-[1.2rem]">
                    {Number(settlementForm.jewelryOutputWeight || 0).toFixed(2)} g
                  </div>
                  <small className="text-fg-muted">Masuk Vault Siap Ekspor</small>
                </div>

                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Scrap Retur (Akun 1152)</span>
                  <div className="font-extrabold text-sky text-[1.2rem]">
                    {Number(settlementForm.scrapReturnWeight || 0).toFixed(2)} g
                  </div>
                  <small className="text-fg-muted">Masuk Vault Scrap/Leburan</small>
                </div>

                <div className="p-3 bg-surface/40 rounded-lg border border-line">
                  <span className="stat-lbl">Susut Lebur (Akun 5120)</span>
                  <div className="font-extrabold text-danger text-[1.2rem]">
                    {Number(settlementForm.goldLossWeight || 0).toFixed(2)} g
                  </div>
                  <small className="text-fg-muted">Beban Susut Operasional</small>
                </div>

                <div className="p-3 bg-surface/40 rounded-lg border border-gold/30">
                  <span className="stat-lbl">Total Dipertanggungjawabkan</span>
                  <div className="font-extrabold text-gold text-[1.2rem]">
                    {totalSettlementAccounted.toFixed(2)} g
                  </div>
                  <small className="text-fg-muted">Dikeluarkan dari Vault WIP (11502)</small>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary mt-2">
              <CheckCircle2 size={16} /> Pelunasan WIP & Transfer Perhiasan Ke Vault Siap Ekspor
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Settlement History */}
      {activeTab === 'settlement-history' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
            <div>
              <h3 className="font-heading text-[1.1rem] text-emerald-light flex items-center gap-2">
                <FileText size={18} /> Riwayat Settlement Hasil Produksi Workshop
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Log histori pertanggungjawaban fisik perhiasan jadi, scrap retur, dan susut lebur
              </p>
            </div>
            <button
              onClick={() => setActiveTab('settlement')}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Input Settlement Baru
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 text-fg-muted" size={16} />
              <input
                type="text"
                className="form-input pl-9 text-xs"
                placeholder="Cari nomor JO, nomor SPK, buyer, atau kadar…"
                value={searchSettlement}
                onChange={e => setSearchSettlement(e.target.value)}
              />
            </div>
          </div>

          {/* Settlement Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. JO / Settlement</TableHead>
                <TableHead>Ref No. SPK</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Hasil Jadi (g)</TableHead>
                <TableHead className="text-right">Scrap Retur (g)</TableHead>
                <TableHead className="text-right">Susut Loss (g)</TableHead>
                <TableHead className="text-right">Total WIP (g)</TableHead>
                <TableHead className="text-right">Ongkos Tukang (IDR)</TableHead>
                <TableHead>Karat</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSettlementList.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada data settlement hasil produksi workshop." />
              ) : (
                filteredSettlementList.map(st => (
                  <TableRow key={st.id || st.joNumber}>
                    <TableCell>
                      <strong className="font-mono text-emerald">{st.joNumber || st.id}</strong>
                    </TableCell>
                    <TableCell className="font-mono text-gold text-xs">
                      {st.spkNo || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-fg-soft">{st.date || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-emerald font-bold">
                      {Number(st.jewelryOutputWeight || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sky">
                      {Number(st.scrapReturnWeight || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-danger">
                      {Number(st.goldLossWeight || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {(Number(st.jewelryOutputWeight || 0) + Number(st.scrapReturnWeight || 0) + Number(st.goldLossWeight || 0)).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-fg-soft">
                      Rp {Number(st.laborFeeIDR || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">Karat {st.karat || '750'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">✅ COMPLETED</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 5: Manual Dynamic BOM Formula Settings */}
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
          <h4 className="text-sky text-[0.95rem] mb-3">📋 Daftar Preset Formula BOM Karat Aktif</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode Karat</TableHead>
                <TableHead>Nama Formula</TableHead>
                <TableHead className="text-right">Kadar Emas (%)</TableHead>
                <TableHead className="text-right">Safety Margin (%)</TableHead>
                <TableHead className="text-right">Effective Target (%)</TableHead>
                <TableHead>Komposisi Alloy (Ag/Cu)</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomFormulas.length === 0 ? (
                <TableEmpty colSpan={7} message="Belum ada formula BOM (Bill of Material) alloy." />
              ) : (
                bomFormulas.map(f => (
                  <TableRow key={f.code}>
                    <TableCell><strong>{f.code}</strong></TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell className="text-right text-gold font-bold">{f.fineGoldPct}%</TableCell>
                    <TableCell className="text-right">+{f.safetyMarginPct}%</TableCell>
                    <TableCell className="text-right text-emerald font-bold">{(f.fineGoldPct + f.safetyMarginPct).toFixed(1)}%</TableCell>
                    <TableCell>Perak: {f.alloyAgPct}% | Tembaga: {f.alloyCuPct}%</TableCell>
                    <TableCell className="text-center">
                      <button
                        className="btn-primary py-1 px-3 text-xs"
                        onClick={() => setEditingFormula(f)}
                      >
                        Edit Formula
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
