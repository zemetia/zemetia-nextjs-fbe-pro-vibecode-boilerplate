import React, { useState, useEffect } from 'react';
import {
  Sparkles, Coins, Warehouse, ShieldCheck, FileText,
  Plus, CheckCircle2, X, TrendingUp, AlertTriangle,
  PlusCircle, RefreshCw, Search, Filter, Layers, ArrowRightLeft
} from 'lucide-react';
import {
  getWarehouses,
  calculateVaultStockPosition,
  getSilverTransactions,
  recordSilverAdditionToGold,
  recordSilverReceipt
} from '../services/storageService';
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
  TableEmpty
} from '../components/ui';

export default function SilverAlloyPage() {
  const { modalProps, showModal } = useModal();
  const [warehouses, setWarehouses] = useState([]);
  const [silverTransactions, setSilverTransactions] = useState([]);
  const [stockPosition, setStockPosition] = useState({
    vaults: [],
    movements: [],
    summary: {
      totalLMGrams: 0,
      lmMainGrams: 0,
      lmImportGrams: 0,
      wipGrams: 0,
      exportGrams: 0,
      scrapGrams: 0,
      silverGrams: 0,
      totalVaultGrams: 0,
      grandTotalValueIDR: 0
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVaultTargetFilter, setSelectedVaultTargetFilter] = useState('ALL');

  // Modal State: Penerimaan / Top Up Stok Perak
  const [showSilverReceiptModal, setShowSilverReceiptModal] = useState(false);
  const [silverReceiptForm, setSilverReceiptForm] = useState({
    date: new Date().toISOString().split('T')[0],
    supplierName: 'PT Antam Tbk / Divisi Logam Mulia',
    docNo: '',
    itemName: 'Granul Perak Murni 99.9% (Fine Silver Grain)',
    purity: 99.9,
    weightGrams: 1000,
    pricePerGram: 16500,
    sourceAccount: '1111-IDR',
    notes: 'Penerimaan persediaan stok perak murni untuk bahan paduan alloy',
    operatorName: 'Petugas Vault'
  });

  // Form State: Tambahkan Perak ke Emas Batangan
  const [silverAlloyForm, setSilverAlloyForm] = useState({
    date: new Date().toISOString().split('T')[0],
    targetVaultId: 'WH-VAULT-01',
    targetVaultName: 'Vault Utama PT TAN',
    targetAccount: '1157',
    goldBarRef: 'LM-ANTAM-1000G / Batang Seri A-8891',
    goldInitialWeightGram: 1000,
    goldPurityInitial: 99.99,
    silverWeightGram: 50,
    silverPurity: 99.9,
    silverPricePerGram: 16500,
    notes: 'Penambahan perak paduan alloy ke emas batangan',
    operatorName: 'Rian (Assay Master)'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const whList = getWarehouses();
    setWarehouses(whList);
    const position = calculateVaultStockPosition();
    setStockPosition(position);
    setSilverTransactions(getSilverTransactions());
  };

  const handleSilverTargetVaultChange = (vaultName) => {
    const found = warehouses.find(w => w.name === vaultName);
    if (found) {
      setSilverAlloyForm(prev => ({
        ...prev,
        targetVaultId: found.id,
        targetVaultName: found.name,
        targetAccount: found.account
      }));
    }
  };

  // Eksekusi Penambahan Perak ke Emas Batangan
  const handleExecuteSilverAddition = async (e) => {
    e.preventDefault();

    const silverQty = Number(silverAlloyForm.silverWeightGram || 0);
    const goldQty = Number(silverAlloyForm.goldInitialWeightGram || 0);
    const silverPrice = Number(silverAlloyForm.silverPricePerGram || 16500);

    if (silverQty <= 0) {
      showModal({
        variant: 'warning',
        title: 'Berat Perak Tidak Valid',
        message: 'Berat perak yang ditambahkan harus lebih besar dari 0 gram.'
      });
      return;
    }

    if (goldQty <= 0) {
      showModal({
        variant: 'warning',
        title: 'Berat Emas Awal Tidak Valid',
        message: 'Berat emas batangan awal harus lebih besar dari 0 gram.'
      });
      return;
    }

    // Saldo perak di brankas 1153
    const silverVaultData = stockPosition.vaults.find(v => v.account === '1153');
    const availableSilver = silverVaultData ? silverVaultData.balanceGrams : 0;
    if (availableSilver < silverQty) {
      showModal({
        variant: 'warning',
        title: 'Saldo Stok Perak Kurang',
        message: `Saldo stok perak di Vault Perak (Akun 1153) hanya tersisa ${availableSilver.toLocaleString()} gram. Penambahan sebesar ${silverQty.toLocaleString()} gram melebihi saldo yang ada.\n\nSilakan lakukan penerimaan / top-up stok perak terlebih dahulu.`
      });
      return;
    }

    const totalSilverVal = silverQty * silverPrice;
    const totalFinalWeight = goldQty + silverQty;
    const fineGold = goldQty * (Number(silverAlloyForm.goldPurityInitial || 99.99) / 100);
    const finalPurity = ((fineGold / totalFinalWeight) * 100).toFixed(2);

    const result = await recordSilverAdditionToGold({
      ...silverAlloyForm,
      silverWeightGram: silverQty,
      goldInitialWeightGram: goldQty,
      silverPricePerGram: silverPrice,
      totalSilverValueIDR: totalSilverVal
    });

    if (result.success) {
      showModal({
        variant: 'success',
        title: `✅ Penambahan Perak ke Emas (${result.transaction.id}) Berhasil`,
        message: `• Target Emas: ${silverAlloyForm.goldBarRef} (${silverAlloyForm.targetVaultName} - Akun ${silverAlloyForm.targetAccount})\n• Berat Emas Awal: ${goldQty.toLocaleString()} gram (Kadar ${silverAlloyForm.goldPurityInitial}%)\n• Perak Ditambahkan: +${silverQty.toLocaleString()} gram (Dipotong dari Vault Perak 1153)\n• Total Berat Baru: ${totalFinalWeight.toLocaleString()} gram (Estimasi Kadar Baru: ${finalPurity}%)\n\n• Jurnal Persediaan SAK EMKM Otomatis Diposting:\n  - Debet: Akun ${silverAlloyForm.targetAccount} (${silverAlloyForm.targetVaultName}) Rp ${totalSilverVal.toLocaleString()}\n  - Kredit: Akun 1153 (Silver & Logam Mulia Lain) Rp ${totalSilverVal.toLocaleString()}`
      });
      loadData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menambahkan Perak',
        message: result.message || 'Terjadi kesalahan saat memproses penambahan perak ke emas batangan.'
      });
    }
  };

  // Eksekusi Penerimaan Stok Perak Baru
  const handleExecuteSilverReceipt = async (e) => {
    e.preventDefault();

    const weight = Number(silverReceiptForm.weightGrams || 0);
    const price = Number(silverReceiptForm.pricePerGram || 16500);

    if (weight <= 0) {
      showModal({
        variant: 'warning',
        title: 'Jumlah Berat Tidak Valid',
        message: 'Berat perak yang diterima harus lebih besar dari 0 gram.'
      });
      return;
    }

    const totalVal = weight * price;
    const result = await recordSilverReceipt({
      ...silverReceiptForm,
      weightGrams: weight,
      pricePerGram: price,
      totalValueIDR: totalVal
    });

    if (result.success) {
      setShowSilverReceiptModal(false);
      showModal({
        variant: 'success',
        title: `✅ Penerimaan Stok Perak (${result.transaction.id}) Berhasil`,
        message: `• Barang: ${silverReceiptForm.itemName}\n• Berat Masuk: +${weight.toLocaleString()} gram ke Vault Perak (Akun 1153)\n• Supplier: ${silverReceiptForm.supplierName}\n• Total Nilai: Rp ${totalVal.toLocaleString()} (@Rp ${price.toLocaleString()}/g)\n\n• Jurnal Pembelian SAK EMKM Otomatis Diposting:\n  - Debet: Akun 1153 (Silver & Logam Mulia Lain) Rp ${totalVal.toLocaleString()}\n  - Kredit: Akun ${silverReceiptForm.sourceAccount} Rp ${totalVal.toLocaleString()}`
      });
      loadData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menyimpan Penerimaan Perak',
        message: 'Terjadi kesalahan saat menyimpan data penerimaan stok perak.'
      });
    }
  };

  // Kalkulasi Variabel Real-time
  const currentSilverVault = stockPosition.vaults.find(v => v.account === '1153');
  const availableSilverGrams = currentSilverVault ? Math.max(0, currentSilverVault.balanceGrams) : 0;
  const currentSilverValueIDR = currentSilverVault ? Math.max(0, currentSilverVault.totalValueIDR) : 0;

  const totalSilverUsedGrams = silverTransactions
    .filter(t => t.transactionType === 'ALLOY_ADDITION')
    .reduce((sum, t) => sum + Number(t.silverWeightGram || 0), 0);

  const totalAlloyedGoldGrams = silverTransactions
    .filter(t => t.transactionType === 'ALLOY_ADDITION')
    .reduce((sum, t) => sum + Number(t.totalFinalWeightGram || 0), 0);

  const inputGoldWeight = Number(silverAlloyForm.goldInitialWeightGram || 0);
  const inputSilverWeight = Number(silverAlloyForm.silverWeightGram || 0);
  const inputSilverPrice = Number(silverAlloyForm.silverPricePerGram || 16500);
  const inputGoldPurity = Number(silverAlloyForm.goldPurityInitial || 99.99);

  const previewTotalWeight = inputGoldWeight + inputSilverWeight;
  const previewFineGold = inputGoldWeight * (inputGoldPurity / 100);
  const previewNewPurity = previewTotalWeight > 0 ? ((previewFineGold / previewTotalWeight) * 100).toFixed(2) : '99.99';
  const previewJournalValue = inputSilverWeight * inputSilverPrice;

  // Filter Riwayat Transaksi
  const silverAdditionHistory = silverTransactions.filter(t => {
    if (t.transactionType !== 'ALLOY_ADDITION') return false;
    const matchVault = selectedVaultTargetFilter === 'ALL' || t.targetAccount === selectedVaultTargetFilter;
    const matchSearch = searchQuery === '' ||
      t.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.goldBarRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.targetVaultName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.operatorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVault && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner & Action Bar */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold/15 text-gold border border-gold/30">
                <Sparkles size={12} /> Modul Paduan Logam Mulia
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky/10 text-sky border border-sky/20">
                <ShieldCheck size={12} /> Auto-Jurnal SAK EMKM
              </span>
            </div>
            <h2 className="font-heading text-xl font-bold flex items-center gap-2.5 text-white">
              <Coins color="#38bdf8" size={24} /> Penambahan Perak ke Emas Batangan (Alloy & Campuran)
            </h2>
            <p className="text-xs text-fg-soft mt-1">
              Fasilitas penambahan bahan perak murni (Akun COA 1153) ke emas batangan untuk penyesuaian komposisi paduan, dilengkapi pemotongan stok otomatis dan auto-jurnal persediaan SAK EMKM.
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <button
              className="btn-primary bg-linear-135 from-sky to-sky-dark font-bold text-white text-xs py-2 px-3.5"
              onClick={() => setShowSilverReceiptModal(true)}
            >
              <PlusCircle size={15} /> + Terima / Beli Stok Perak
            </button>
            <button
              className="btn-primary bg-[rgba(255,255,255,0.08)] text-white text-xs py-2 px-3"
              onClick={loadData}
            >
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel stat-card border border-sky/30">
          <div>
            <span className="stat-lbl">Saldo Stok Perak Tersedia</span>
            <div className="stat-val text-sky-light">
              {availableSilverGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">
              Vault Perak 1153 (Rp {currentSilverValueIDR.toLocaleString()})
            </p>
          </div>
          <div className="p-3 bg-sky/10 rounded-xl text-sky">
            <Coins size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card border border-gold/30">
          <div>
            <span className="stat-lbl">Total Perak Terpakai Alloy</span>
            <div className="stat-val text-gold-light">
              {totalSilverUsedGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Akumulasi Perak Keluar</p>
          </div>
          <div className="p-3 bg-gold/10 rounded-xl text-gold">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card border border-emerald/30">
          <div>
            <span className="stat-lbl">Total Hasil Paduan Batangan</span>
            <div className="stat-val text-emerald-light">
              {totalAlloyedGoldGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Emas + Perak Dipadukan</p>
          </div>
          <div className="p-3 bg-emerald/10 rounded-xl text-emerald">
            <Layers size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card border border-line">
          <div>
            <span className="stat-lbl">Total Transaksi Alloy</span>
            <div className="stat-val text-white">
              {silverAdditionHistory.length} Transaksi
            </div>
            <p className="text-xs text-fg-soft">Tersambung ke COA SAK EMKM</p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl text-fg-soft">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Interactive 2-Column Working Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-7 glass-panel p-6 border border-gold/40">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-line">
            <Sparkles color="#f59e0b" size={20} />
            <div>
              <h3 className="font-heading text-gold-light text-base font-bold">
                Formulir Tambahkan Perak ke Emas Batangan
              </h3>
              <p className="text-xs text-fg-soft">
                Masukkan detail emas batangan dan gramatur perak yang akan dicampurkan.
              </p>
            </div>
          </div>

          <form onSubmit={handleExecuteSilverAddition} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Tanggal Transaksi</label>
                <input
                  type="date"
                  className="form-input"
                  value={silverAlloyForm.date}
                  onChange={e => setSilverAlloyForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gudang Vault Emas Tujuan</label>
                <Combobox
                  value={silverAlloyForm.targetVaultName}
                  onChange={handleSilverTargetVaultChange}
                  placeholder="-- Pilih Vault Tujuan --"
                  searchPlaceholder="Cari gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.filter(w => w.account !== '1153').map(w => ({
                    value: w.name,
                    label: `${w.name} (Akun ${w.account})`
                  }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Identitas / No. Seri Emas Batangan Tujuan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: LM-ANTAM-1000G / Batang Seri A-8891 atau Batch Leburan 01"
                value={silverAlloyForm.goldBarRef}
                onChange={e => setSilverAlloyForm(prev => ({ ...prev, goldBarRef: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Berat Emas Batangan Awal (Gram)</label>
                <NumberInput
                  allowDecimal
                  value={silverAlloyForm.goldInitialWeightGram}
                  onChange={val => setSilverAlloyForm(prev => ({ ...prev, goldInitialWeightGram: val }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kadar Emas Awal (%)</label>
                <NumberInput
                  allowDecimal
                  value={silverAlloyForm.goldPurityInitial}
                  onChange={val => setSilverAlloyForm(prev => ({ ...prev, goldPurityInitial: val }))}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-sky/30 bg-sky/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-sky-light flex items-center gap-1.5">
                  <Coins size={14} /> Bahan Perak yang Ditambahkan (Alloy)
                </span>
                <span className="text-xs text-fg-soft">
                  Stok Perak Tersedia: <strong className="text-sky-light">{availableSilverGrams.toLocaleString()} g</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-fg-soft block mb-1">Berat Perak Ditambahkan (Gram)</label>
                  <NumberInput
                    allowDecimal
                    value={silverAlloyForm.silverWeightGram}
                    onChange={val => setSilverAlloyForm(prev => ({ ...prev, silverWeightGram: val }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-fg-soft block mb-1">Harga Pokok Perak / Gram (Rp)</label>
                  <NumberInput
                    value={silverAlloyForm.silverPricePerGram}
                    onChange={val => setSilverAlloyForm(prev => ({ ...prev, silverPricePerGram: val }))}
                  />
                </div>
              </div>

              {inputSilverWeight > availableSilverGrams && (
                <div className="flex items-center gap-1.5 text-xs text-danger font-semibold bg-danger/10 p-2 rounded">
                  <AlertTriangle size={14} />
                  Berat perak ({inputSilverWeight}g) melebihi stok yang tersedia di brankas ({availableSilverGrams}g)!
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Catatan / Keterangan Pencampuran</label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={silverAlloyForm.notes}
                  onChange={e => setSilverAlloyForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Petugas / Assay Master</label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={silverAlloyForm.operatorName}
                  onChange={e => setSilverAlloyForm(prev => ({ ...prev, operatorName: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={inputSilverWeight <= 0 || inputSilverWeight > availableSilverGrams}
                className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white text-sm py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} /> ⚡ Eksekusi Penambahan Perak & Auto-Jurnal
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Simulator & Accounting Details */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Simulator Card */}
          <div className="glass-panel p-5 border border-gold/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l from-gold/10 to-transparent pointer-events-none" />
            <h4 className="font-heading text-sm font-bold text-gold-light mb-3 flex items-center gap-2">
              <TrendingUp size={16} /> Kalkulator Hasil Paduan Emas-Perak
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface/80 border border-line">
                <span className="text-xs text-fg-soft">Berat Emas Batangan Awal:</span>
                <strong className="text-sm text-gold-light">{inputGoldWeight.toLocaleString()} Gram</strong>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface/80 border border-line">
                <span className="text-xs text-fg-soft">Tambahan Perak Alloy:</span>
                <strong className="text-sm text-sky-light">+{inputSilverWeight.toLocaleString()} Gram</strong>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-gold/10 border border-gold/40">
                <div>
                  <span className="text-xs font-bold text-white block">Total Berat Paduan Baru:</span>
                  <small className="text-[0.7rem] text-fg-soft">Konservasi massa emas + perak</small>
                </div>
                <span className="text-lg font-extrabold text-gold-light">
                  {previewTotalWeight.toLocaleString()} Gram
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface/80 border border-line">
                <span className="text-xs text-fg-soft">Estimasi Kadar Paduan Baru:</span>
                <span className="text-sm font-bold text-emerald-light">
                  {previewNewPurity}% (Fine Gold: {previewFineGold.toFixed(2)}g)
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface/80 border border-line">
                <span className="text-xs text-fg-soft">Total Nilai Valuasi Perak:</span>
                <span className="text-sm font-bold text-white">
                  Rp {previewJournalValue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* SAK EMKM Journal Box */}
          <div className="glass-panel p-5 border border-sky/30 bg-surface/90">
            <h4 className="font-heading text-xs font-bold text-sky-light mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Pratinjau Auto-Jurnal SAK EMKM
            </h4>
            <div className="text-[0.75rem] space-y-1.5 text-fg-soft bg-canvas/90 p-3 rounded-lg border border-line font-mono">
              <div className="text-gold-light font-sans font-semibold pb-1 border-b border-line/60">
                Jurnal Mutasi Persediaan Antar-Akun:
              </div>
              <div className="text-emerald-light">
                [DEBET] {silverAlloyForm.targetAccount} - {silverAlloyForm.targetVaultName} : Rp {previewJournalValue.toLocaleString()}
              </div>
              <div className="text-sky-light pl-4">
                [KREDIT] 1153 - Silver & Logam Mulia Lain : Rp {previewJournalValue.toLocaleString()}
              </div>
              <div className="text-fg-muted pt-1 text-[0.7rem] font-sans">
                • Saldo fisik perak di Vault 1153 otomatis berkurang {inputSilverWeight}g
                <br />• Saldo fisik batangan & nilai tercatat masuk ke brankas {silverAlloyForm.targetVaultName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Register Riwayat Penambahan Perak */}
      <div className="glass-panel p-6 border border-line">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <div>
            <h3 className="font-heading text-base font-bold text-white flex items-center gap-2">
              <FileText color="#f59e0b" size={18} /> Riwayat Register Penambahan Perak ke Emas ({silverAdditionHistory.length} Transaksi)
            </h3>
            <p className="text-xs text-fg-soft">
              Semua mutasi penambahan perak otomatis tercatat dalam kartu stok brankas vault dan jurnal umum.
            </p>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-fg-soft" />
              <select
                className="form-select text-xs py-1.5 px-2.5 rounded-sm bg-bg-surface border-line text-white"
                value={selectedVaultTargetFilter}
                onChange={e => setSelectedVaultTargetFilter(e.target.value)}
              >
                <option value="ALL">Semua Vault Tujuan</option>
                <option value="1157">Vault Utama (Akun 1157)</option>
                <option value="11502">Vault WIP Produksi (Akun 11502)</option>
              </select>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-fg-soft" />
              <input
                type="text"
                placeholder="Cari transaksi, nomor seri, catatan..."
                className="form-input pl-9 text-xs py-1.5 rounded-sm w-[240px]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Transaksi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Emas Batangan / Vault Tujuan</TableHead>
              <TableHead className="text-right">Berat Emas Awal</TableHead>
              <TableHead className="text-right">Perak Ditambahkan</TableHead>
              <TableHead className="text-right">Total Berat Baru</TableHead>
              <TableHead className="text-right">Kadar Baru</TableHead>
              <TableHead className="text-right">Nilai Jurnal (Rp)</TableHead>
              <TableHead>Keterangan / Operator</TableHead>
              <TableHead className="text-center">Status Jurnal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {silverAdditionHistory.length === 0 ? (
              <TableEmpty colSpan={10} message="Belum ada catatan transaksi penambahan perak ke emas batangan." />
            ) : (
              silverAdditionHistory.map(item => (
                <TableRow key={item.id}>
                  <TableCell><strong>{item.id}</strong></TableCell>
                  <TableCell className="whitespace-nowrap">{item.date}</TableCell>
                  <TableCell>
                    <strong className="text-gold-light">{item.goldBarRef}</strong>
                    <div className="text-xs text-fg-soft">{item.targetVaultName} (Akun {item.targetAccount})</div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(item.goldInitialWeightGram || 0).toLocaleString()} g
                  </TableCell>
                  <TableCell className="text-right text-sky-light font-bold">
                    +{(item.silverWeightGram || 0).toLocaleString()} g
                  </TableCell>
                  <TableCell className="text-right font-extrabold text-gold-light text-base">
                    {(item.totalFinalWeightGram || 0).toLocaleString()} g
                  </TableCell>
                  <TableCell className="text-right text-emerald-light font-bold">
                    {item.finalEstimatedPurity}%
                  </TableCell>
                  <TableCell className="text-right font-semibold text-white">
                    Rp {(item.totalSilverValueIDR || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-white">{item.notes}</div>
                    <small className="text-fg-soft">Op: {item.operatorName}</small>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="badge badge-emerald text-xs">POSTED</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal: Penerimaan / Top Up Stok Perak */}
      {showSilverReceiptModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px] flex justify-center items-center z-[1000] p-4">
          <div className="glass-panel w-full max-w-[560px] p-6 relative border border-sky">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-sky-light text-[1.15rem] flex items-center gap-2">
                <Coins size={20} /> Form Penerimaan / Beli Stok Perak Murni (Vault 1153)
              </h3>
              <button onClick={() => setShowSilverReceiptModal(false)} className="cursor-pointer border-0 bg-none text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteSilverReceipt} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Tanggal Penerimaan</label>
                  <input
                    type="date"
                    className="form-input"
                    value={silverReceiptForm.date}
                    onChange={e => setSilverReceiptForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Supplier / Asal Pengadaan</label>
                  <input
                    type="text"
                    className="form-input"
                    value={silverReceiptForm.supplierName}
                    onChange={e => setSilverReceiptForm(prev => ({ ...prev, supplierName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Barang / Deskripsi Perak</label>
                <input
                  type="text"
                  className="form-input"
                  value={silverReceiptForm.itemName}
                  onChange={e => setSilverReceiptForm(prev => ({ ...prev, itemName: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="form-label">Berat Perak (Gram)</label>
                  <NumberInput
                    allowDecimal
                    value={silverReceiptForm.weightGrams}
                    onChange={val => setSilverReceiptForm(prev => ({ ...prev, weightGrams: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kadar Perak (%)</label>
                  <NumberInput
                    allowDecimal
                    value={silverReceiptForm.purity}
                    onChange={val => setSilverReceiptForm(prev => ({ ...prev, purity: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Beli / Gram (Rp)</label>
                  <NumberInput
                    value={silverReceiptForm.pricePerGram}
                    onChange={val => setSilverReceiptForm(prev => ({ ...prev, pricePerGram: val }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Sumber Pembayaran (Sisi Kredit Jurnal)</label>
                <select
                  className="form-select w-full"
                  value={silverReceiptForm.sourceAccount}
                  onChange={e => setSilverReceiptForm(prev => ({ ...prev, sourceAccount: e.target.value }))}
                >
                  <option value="1111-IDR">1111-IDR — Bank BCA IDR (Operasional)</option>
                  <option value="1110">1110 — Kas Utama</option>
                  <option value="2110">2110 — Hutang Usaha (Tempo)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Catatan / No. Referensi Pengadaan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Pembelian perak murni untuk stok paduan alloy"
                  value={silverReceiptForm.notes}
                  onChange={e => setSilverReceiptForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="bg-[rgba(15,23,42,0.8)] p-3.5 rounded-[10px] border border-sky/30 text-xs space-y-1">
                <div className="text-sky-light font-bold">ℹ️ Info Auto-Jurnal Persediaan SAK EMKM:</div>
                <div className="text-fg-soft">
                  • Debet: 1153 - Silver & Logam Mulia Lain : Rp {(Number(silverReceiptForm.weightGrams || 0) * Number(silverReceiptForm.pricePerGram || 16500)).toLocaleString()}
                </div>
                <div className="text-fg-soft">
                  • Kredit: {silverReceiptForm.sourceAccount} : Rp {(Number(silverReceiptForm.weightGrams || 0) * Number(silverReceiptForm.pricePerGram || 16500)).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  className="btn-primary bg-[rgba(255,255,255,0.1)]"
                  onClick={() => setShowSilverReceiptModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-linear-135 from-sky to-sky-dark font-bold text-white"
                >
                  <CheckCircle2 size={16} /> Simpan Penerimaan Perak & Auto-Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
