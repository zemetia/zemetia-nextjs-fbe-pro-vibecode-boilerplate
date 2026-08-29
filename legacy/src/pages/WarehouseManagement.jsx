import React, { useState, useEffect } from 'react';
import {
  Warehouse, Package, ArrowRightLeft, ShieldCheck, FileText,
  Plus, CheckCircle2, X, Hammer, Printer, Search, Filter,
  Layers, Sparkles, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Coins, PlusCircle
} from 'lucide-react';
import {
  getWarehouses,
  calculateVaultStockPosition,
  recordVaultTransfer,
  getMasterItems,
  getFinishedGoods,
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

export default function WarehouseManagement() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('movements'); // 'movements', 'silver-alloy', 'vaults', 'transfers'
  const [warehouses, setWarehouses] = useState([]);
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

  const [selectedVaultFilter, setSelectedVaultFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [masterItems, setMasterItems] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [silverTransactions, setSilverTransactions] = useState([]);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromVaultId: 'WH-VAULT-01',
    fromVaultName: 'Vault Utama PT TAN',
    fromAccount: '1157',
    toVaultId: 'WH-VAULT-04',
    toVaultName: 'Vault Emas WIP (Produksi Perhiasan)',
    toAccount: '11502',
    itemCode: 'GOLD-WIP-9999',
    itemName: 'Granul Emas Murni 999.9 (Bahan WIP)',
    safeBoxSlot: 'BRANKAS-01 / LACI-A1',
    quantityGrams: 100,
    transferNotes: 'Pengeluaran bahan baku emas murni ke Brankas WIP Produksi'
  });

  // Silver Receipt Modal State (Top Up / Beli Perak)
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

  // Silver Alloy Form State (Tambahkan Perak ke Emas)
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
    loadDynamicStockData();
  }, []);

  const loadDynamicStockData = () => {
    const whList = getWarehouses();
    setWarehouses(whList);
    const position = calculateVaultStockPosition();
    setStockPosition(position);
    setMasterItems(getMasterItems());
    setFinishedGoods(getFinishedGoods());
    setSilverTransactions(getSilverTransactions());
  };

  const handleFromVaultChange = (vaultName) => {
    const found = warehouses.find(w => w.name === vaultName);
    if (found) {
      setTransferForm(prev => ({
        ...prev,
        fromVaultId: found.id,
        fromVaultName: found.name,
        fromAccount: found.account
      }));
    }
  };

  const handleToVaultChange = (vaultName) => {
    const found = warehouses.find(w => w.name === vaultName);
    if (found) {
      setTransferForm(prev => ({
        ...prev,
        toVaultId: found.id,
        toVaultName: found.name,
        toAccount: found.account
      }));
    }
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

  const handleItemChange = (code) => {
    const allItems = [
      { code: 'GOLD-WIP-9999', name: 'Granul Emas Murni 999.9 (Bahan WIP)' },
      { code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)' },
      { code: 'LM-VALCAMBI-1KG', name: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)' },
      { code: 'SILVER-GRAIN-999', name: 'Granul Perak Murni 99.9% (Fine Silver Grain)' },
      { code: 'SCRAP-MIX-750', name: 'Scrap Perhiasan Emas Karat 750 / Potongan' },
      { code: 'JEWELRY-750', name: 'Perhiasan Emas 750 (18K) Siap Ekspor' },
      ...masterItems.map(i => ({ code: i.code || i.id, name: i.name })),
      ...finishedGoods.map(fg => ({ code: fg.sku || fg.id, name: fg.name }))
    ];
    const found = allItems.find(i => i.code === code);
    setTransferForm(prev => ({
      ...prev,
      itemCode: code,
      itemName: found ? found.name : code
    }));
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();

    if (transferForm.fromAccount === transferForm.toAccount) {
      showModal({
        variant: 'warning',
        title: 'Gudang Asal & Tujuan Sama',
        message: 'Gudang vault asal dan tujuan transfer tidak boleh sama.'
      });
      return;
    }

    if (!transferForm.quantityGrams || Number(transferForm.quantityGrams) <= 0) {
      showModal({
        variant: 'warning',
        title: 'Jumlah Tidak Valid',
        message: 'Jumlah berat transfer harus lebih besar dari 0 gram.'
      });
      return;
    }

    // Check available balance in source vault
    const sourceVaultData = stockPosition.vaults.find(v => v.account === transferForm.fromAccount);
    const availableQty = sourceVaultData ? sourceVaultData.balanceGrams : 0;
    if (availableQty < Number(transferForm.quantityGrams)) {
      showModal({
        variant: 'warning',
        title: 'Saldo Stok Vault Kurang',
        message: `Saldo brankas ${transferForm.fromVaultName} hanya ${availableQty.toLocaleString()} gram. Transfer sebesar ${Number(transferForm.quantityGrams).toLocaleString()} gram melebihi saldo yang ada.`
      });
      return;
    }

    const estimatedVal = Number(transferForm.quantityGrams) * 1300000;

    const result = await recordVaultTransfer({
      ...transferForm,
      estimatedValueIDR: estimatedVal
    });

    if (result.success) {
      setShowTransferModal(false);
      showModal({
        variant: 'success',
        title: `✅ Transfer Emas Antar-Vault (${result.transfer.id}) Berhasil`,
        message: `• Pemindahan: ${transferForm.quantityGrams} gram ${transferForm.itemName}\n• Dari: ${transferForm.fromVaultName} (Akun ${transferForm.fromAccount})\n• Ke: ${transferForm.toVaultName} (Akun ${transferForm.toAccount})\n• Jurnal EMKM Otomatis Diposting:\n  - Debet: Akun ${transferForm.toAccount} Rp ${estimatedVal.toLocaleString()}\n  - Kredit: Akun ${transferForm.fromAccount} Rp ${estimatedVal.toLocaleString()}`
      });
      loadDynamicStockData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menyimpan Transfer',
        message: 'Terjadi kesalahan saat memproses transfer antar vault.'
      });
    }
  };

  // Handler: Tambahkan Perak ke Emas Batangan
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
      loadDynamicStockData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menambahkan Perak',
        message: result.message || 'Terjadi kesalahan saat memproses penambahan perak ke emas batangan.'
      });
    }
  };

  // Handler: Penerimaan Stok Perak Baru
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
      loadDynamicStockData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menyimpan Penerimaan Perak',
        message: 'Terjadi kesalahan saat menyimpan data penerimaan stok perak.'
      });
    }
  };

  const handlePrintStockReport = () => {
    showModal({
      variant: 'info',
      title: '🖨️ Cetak Laporan Posisi Fisik Brankas Vault PT TAN',
      message: `Posisi Brankas Real-Time PT TAN:\n\n• Total Stok Logam Mulia (1157 + 1158): ${stockPosition.summary.totalLMGrams.toLocaleString()} Gram\n• Total Emas WIP Produksi (11502): ${stockPosition.summary.wipGrams.toLocaleString()} Gram\n• Total Stok Perak & Alloy (1153): ${(stockPosition.summary.silverGrams || 0).toLocaleString()} Gram\n• Total Perhiasan Siap Ekspor (1160): ${stockPosition.summary.exportGrams.toLocaleString()} Gram\n• Total Emas Scrap (1152): ${stockPosition.summary.scrapGrams.toLocaleString()} Gram\n\nGrand Total Logam Fisik: ${stockPosition.summary.totalVaultGrams.toLocaleString()} Gram\nEstimasi Total Nilai Persediaan: Rp ${stockPosition.summary.grandTotalValueIDR.toLocaleString()}\n\nBerkas laporan siap dicetak atau diekspor ke PDF.`
    });
  };

  // Filter movements
  const filteredMovements = stockPosition.movements.filter(m => {
    const matchVault = selectedVaultFilter === 'ALL' || m.warehouseAccount === selectedVaultFilter;
    const matchSearch = searchQuery === '' ||
      m.docNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.refNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.serialNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.docType?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVault && matchSearch;
  });

  const availableItemOptions = [
    { value: 'GOLD-WIP-9999', label: 'Granul Emas Murni 999.9 (Bahan WIP)' },
    { value: 'LM-ANTAM-1000G', label: 'Emas Batangan Antam 1kg (999.9)' },
    { value: 'LM-VALCAMBI-1KG', label: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)' },
    { value: 'SCRAP-MIX-750', label: 'Scrap Perhiasan Emas Karat 750 / Potongan' },
    { value: 'JEWELRY-750', label: 'Perhiasan Emas 750 (18K) Siap Ekspor' },
    ...masterItems.map(i => ({ value: i.code || i.id, label: `${i.code || i.id} - ${i.name}` })),
    ...finishedGoods.map(fg => ({ value: fg.sku || fg.id, label: `${fg.sku || fg.id} - ${fg.name}` }))
  ];

  // Calculated variables for Live Alloy Calculator
  const currentSilverVault = stockPosition.vaults.find(v => v.account === '1153');
  const availableSilverGrams = currentSilverVault ? Math.max(0, currentSilverVault.balanceGrams) : 0;
  const currentSilverValueIDR = currentSilverVault ? Math.max(0, currentSilverVault.totalValueIDR) : 0;

  const inputGoldWeight = Number(silverAlloyForm.goldInitialWeightGram || 0);
  const inputSilverWeight = Number(silverAlloyForm.silverWeightGram || 0);
  const inputSilverPrice = Number(silverAlloyForm.silverPricePerGram || 16500);
  const inputGoldPurity = Number(silverAlloyForm.goldPurityInitial || 99.99);

  const previewTotalWeight = inputGoldWeight + inputSilverWeight;
  const previewFineGold = inputGoldWeight * (inputGoldPurity / 100);
  const previewNewPurity = previewTotalWeight > 0 ? ((previewFineGold / previewTotalWeight) * 100).toFixed(2) : '99.99';
  const previewJournalValue = inputSilverWeight * inputSilverPrice;

  // Filter silver addition records
  const silverAdditionHistory = silverTransactions.filter(t => t.transactionType === 'ALLOY_ADDITION');

  return (
    <div>
      {/* Header Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Warehouse color="#f59e0b" size={24} /> Modul Gudang & Kartu Stok Brankas Vault Real-Time
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Integrasi Real-Time TTB Penerimaan Emas, Pembelian Lokal, SPK WIP Produksi, Surat Jalan DO Ekspor, Penambahan Perak Alloy & Mutasi Antar-Brankas
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <button className="btn-primary" onClick={handlePrintStockReport}>
              <Printer size={16} /> Cetak Posisi Vault PDF
            </button>
            <button
              className="btn-primary bg-linear-135 from-sky to-sky-dark font-bold text-white"
              onClick={() => setShowSilverReceiptModal(true)}
            >
              <Coins size={16} /> + Terima Stok Perak
            </button>
            <button
              className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white"
              onClick={() => setActiveTab('silver-alloy')}
            >
              <Sparkles size={16} /> Tambahkan Perak ke Emas
            </button>
            <button
              className="btn-primary bg-linear-135 from-orange to-orange-dark font-bold text-white"
              onClick={() => setShowTransferModal(true)}
            >
              <ArrowRightLeft size={16} /> Transfer Antar-Vault
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'movements', label: '📜 Kartu Stok Real-Time (Mutasi In/Out)' },
            { id: 'silver-alloy', label: '✨ Tambahkan Perak ke Emas Batangan' },
            { id: 'vaults', label: '🏛️ Posisi & Rincian per Brankas Vault' },
            { id: 'transfers', label: '🔄 Riwayat Mutasi Internal Antar-Vault' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-[9px] text-[0.8rem] ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-gold to-gold-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4 mb-6">
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Stok Vault LM (999.9)</span>
            <div className="stat-val bg-linear-135 from-[#fef08a] via-gold to-gold-dark bg-clip-text text-transparent">
              {stockPosition.summary.totalLMGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">
              Lokal (1157): {stockPosition.summary.lmMainGrams}g | Impor (1158): {stockPosition.summary.lmImportGrams}g
            </p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.1)] rounded-[12px] text-gold">
            <Warehouse size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Stok Perak & Alloy (1153)</span>
            <div className="stat-val text-sky-light">
              {availableSilverGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">
              Persediaan Perak Murni (Rp {currentSilverValueIDR.toLocaleString()})
            </p>
          </div>
          <div className="p-3 bg-[rgba(56,189,248,0.15)] rounded-[12px] text-sky">
            <Coins size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Vault Emas WIP Produksi</span>
            <div className="stat-val text-gold-light">
              {stockPosition.summary.wipGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Dalam Proses Karat 750/700 (Akun 11502)</p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.15)] rounded-[12px] text-gold-light">
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Vault Perhiasan Siap Ekspor</span>
            <div className="stat-val text-emerald-light">
              {stockPosition.summary.exportGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Finished Goods Karat 750 (Akun 1160)</p>
          </div>
          <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-[12px] text-emerald">
            <Package size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Estimasi Nilai Seluruh Vault</span>
            <div className="stat-val text-sky-light text-[1.15rem]">
              Rp {stockPosition.summary.grandTotalValueIDR.toLocaleString()}
            </div>
            <p className="text-xs text-fg-soft">
              Total Fisik: {stockPosition.summary.totalVaultGrams.toLocaleString()} Gram Logam Mulia
            </p>
          </div>
          <div className="p-3 bg-[rgba(56,189,248,0.1)] rounded-[12px] text-sky">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* TAB 1: KARTU STOK MUTASI REAL-TIME */}
      {activeTab === 'movements' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
            <div>
              <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
                <FileText color="#38bdf8" size={20} /> Kartu Stok Bar & Mutasi Fisik Emas Real-Time ({filteredMovements.length} Mutasi)
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Tersambung langsung ke TTB Impor/Lokal, SPK Workshop, Penambahan Perak Alloy, Pengiriman DO Ekspor, dan Mutasi Antar-Brankas
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-fg-soft" />
                <select
                  className="form-select text-xs py-1.5 px-2.5 rounded-sm bg-bg-surface border-line text-white"
                  value={selectedVaultFilter}
                  onChange={e => setSelectedVaultFilter(e.target.value)}
                >
                  <option value="ALL">Semua Brankas Vault</option>
                  <option value="1157">Vault Utama Emas (Akun 1157)</option>
                  <option value="1153">Vault Perak & Alloy (Akun 1153)</option>
                  <option value="1158">Vault Impor (Akun 1158)</option>
                  <option value="11502">Vault WIP Produksi (Akun 11502)</option>
                  <option value="1160">Vault Siap Ekspor (Akun 1160)</option>
                  <option value="1152">Vault Scrap & Leburan (Akun 1152)</option>
                </select>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-fg-soft" />
                <input
                  type="text"
                  placeholder="Cari no. dokumen, serial, barang..."
                  className="form-input pl-9 text-xs py-1.5 rounded-sm w-[220px]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis Dokumen</TableHead>
                <TableHead>No. Referensi / Dokumen</TableHead>
                <TableHead>Gudang Vault</TableHead>
                <TableHead>Nama Logam / Produk</TableHead>
                <TableHead className="text-right">Masuk (+)</TableHead>
                <TableHead className="text-right">Keluar (-)</TableHead>
                <TableHead className="text-right">Saldo Berjalan</TableHead>
                <TableHead>Serial Bar / Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableEmpty colSpan={9} message="Belum ada catatan mutasi stok untuk filter yang dipilih." />
              ) : (
                filteredMovements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{m.date}</TableCell>
                    <TableCell>
                      <span className={`badge text-xs ${
                        m.docType.includes('TTB') || m.docType.includes('LOKAL') ? 'badge-emerald' :
                        m.docType.includes('PERAK') || m.docType.includes('ALLOY') ? 'badge-sky' :
                        m.docType.includes('WIP') ? 'badge-gold' :
                        m.docType.includes('EKSPOR') ? 'badge-emerald' : 'badge-orange'
                      }`}>
                        {m.docType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <strong>{m.docNo}</strong>
                      {m.refNo && m.refNo !== '-' && <div className="text-[0.7rem] text-fg-muted">Ref: {m.refNo}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gold-light font-medium">{m.warehouseName}</span>
                    </TableCell>
                    <TableCell><strong>{m.itemName}</strong></TableCell>
                    <TableCell className="text-right text-emerald-light font-bold">
                      {m.inQty > 0 ? `+${m.inQty.toLocaleString()} g` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-danger font-bold">
                      {m.outQty > 0 ? `-${m.outQty.toLocaleString()} g` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-extrabold text-gold-light text-base">
                      {m.balanceQty.toLocaleString()} g
                    </TableCell>
                    <TableCell>
                      <small className="text-fg-soft">{m.serialNo}</small>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB 2: TAMBAHKAN PERAK KE EMAS BATANGAN */}
      {activeTab === 'silver-alloy' && (
        <div className="space-y-6">
          {/* Status Bar Stok Perak */}
          <div className="glass-panel p-5 bg-gradient-to-r from-surface/95 via-surface/70 to-surface/90 border border-sky/30">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-sky/15 rounded-xl text-sky">
                  <Coins size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Vault Persediaan Perak & Alloy (Akun COA 1153)
                    </h3>
                    <span className="badge badge-sky text-xs">Stok Aktif</span>
                  </div>
                  <p className="text-xs text-fg-soft mt-0.5">
                    Perak digunakan sebagai bahan campuran (alloy) emas batangan dan formula kadar produksi. Setiap penambahan perak otomatis memotong saldo brankas ini dan menjurnal SAK EMKM.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-fg-soft">Saldo Stok Perak Tersedia:</div>
                  <div className="text-xl font-extrabold text-sky-light">
                    {availableSilverGrams.toLocaleString()} Gram
                  </div>
                  <div className="text-xs text-emerald-light font-medium">
                    Nilai: Rp {currentSilverValueIDR.toLocaleString()}
                  </div>
                </div>
                <button
                  className="btn-primary bg-linear-135 from-sky to-sky-dark text-white font-bold text-xs py-2 px-3"
                  onClick={() => setShowSilverReceiptModal(true)}
                >
                  <PlusCircle size={14} /> + Terima Stok Perak
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Form: Tambahkan Perak ke Emas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Input */}
            <div className="lg:col-span-7 glass-panel p-6 border border-gold/30">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <Sparkles color="#f59e0b" size={20} />
                <div>
                  <h3 className="font-heading text-gold-light text-base font-bold">
                    Formulir Penambahan Perak ke Emas Batangan (Alloy)
                  </h3>
                  <p className="text-xs text-fg-soft">
                    Pilih batangan emas tujuan, masukkan gramatur perak yang dicampurkan, dan sistem akan memotong stok perak serta membuat auto-jurnal debet/kredit COA.
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
                    placeholder="Contoh: LM-ANTAM-1000G / Batang Seri A-8891 atau Batch Lebur 01"
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
                      Berat perak ({inputSilverWeight}g) melebihi stok yang tersedia ({availableSilverGrams}g)!
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
                    <Sparkles size={16} /> ⚡ Proses Penambahan Perak & Auto-Jurnal
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Live Simulation & SAK EMKM Accounting Preview */}
            <div className="lg:col-span-5 space-y-4">
              {/* Simulation Result Card */}
              <div className="glass-panel p-5 border border-gold/40 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-gold/10 to-transparent pointer-events-none" />
                <h4 className="font-heading text-sm font-bold text-gold-light mb-3 flex items-center gap-2">
                  <TrendingUp size={16} /> Hasil Simulasi Komposisi Emas & Perak
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
                    <span className="text-xs text-fg-soft">Nilai Valuasi Perak:</span>
                    <span className="text-sm font-bold text-white">
                      Rp {previewJournalValue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SAK EMKM Accounting Journal Preview */}
              <div className="glass-panel p-5 border border-sky/30 bg-surface/90">
                <h4 className="font-heading text-xs font-bold text-sky-light mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Pratinjau Auto-Jurnal SAK EMKM Terintegrasi
                </h4>
                <div className="text-[0.75rem] space-y-1.5 text-fg-soft bg-canvas/90 p-3 rounded-lg border border-line font-mono">
                  <div className="text-gold-light font-sans font-semibold pb-1 border-b border-line/60">
                    Jurnal Persediaan Logam Mulia:
                  </div>
                  <div className="text-emerald-light">
                    [D] {silverAlloyForm.targetAccount} - {silverAlloyForm.targetVaultName} : Rp {previewJournalValue.toLocaleString()}
                  </div>
                  <div className="text-sky-light pl-4">
                    [K] 1153 - Silver & Logam Mulia Lain : Rp {previewJournalValue.toLocaleString()}
                  </div>
                  <div className="text-fg-muted pt-1 text-[0.7rem] font-sans">
                    • Saldo perak di Vault 1153 otomatis berkurang {inputSilverWeight}g
                    <br />• Berat & nilai tercatat masuk ke brankas {silverAlloyForm.targetVaultName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Riwayat Transaksi Penambahan Perak */}
          <div className="glass-panel p-6 border border-line">
            <h3 className="font-heading text-base font-bold text-white mb-4 flex items-center gap-2">
              <FileText color="#f59e0b" size={18} /> Riwayat Penambahan Perak ke Emas Batangan ({silverAdditionHistory.length} Transaksi)
            </h3>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {silverAdditionHistory.length === 0 ? (
                  <TableEmpty colSpan={9} message="Belum ada catatan penambahan perak ke emas batangan." />
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB 3: RINCIAN PER BRANKAS VAULT */}
      {activeTab === 'vaults' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2.5">
            <Warehouse color="#f59e0b" size={20} /> Posisi Fisik & Akun COA per Brankas Vault PT TAN
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
            {stockPosition.vaults.map(w => (
              <div
                key={w.id || w.account}
                className={`rounded-[12px] border p-5 ${
                  w.account === '1153' ? 'border-sky/50 bg-sky/[0.05]' :
                  w.account === '11502' ? 'border-gold-light bg-gold/[0.08]' :
                  w.account === '1160' ? 'border-emerald/40 bg-emerald/[0.04]' :
                  'border-line bg-[rgba(15,23,42,0.6)]'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <strong className="text-[1.05rem] text-white">{w.name}</strong>
                  <span className={`badge ${w.account === '1153' ? 'badge-sky' : 'badge-emerald'}`}>
                    {w.status || 'Active'}
                  </span>
                </div>

                <div className="bg-[rgba(15,23,42,0.8)] p-3.5 rounded-[10px] mb-3 border border-line/50">
                  <div className="text-xs text-fg-soft">
                    {w.account === '1153' ? 'Saldo Fisik Perak:' : 'Saldo Fisik Emas:'}
                  </div>
                  <div className={`text-[1.4rem] font-extrabold ${w.account === '1153' ? 'text-sky-light' : 'text-gold-light'}`}>
                    {Math.max(0, w.balanceGrams).toLocaleString()} Gram
                  </div>
                  <div className="text-xs text-emerald-light font-medium mt-0.5">
                    Nilai Aset: Rp {Math.max(0, w.totalValueIDR).toLocaleString()}
                  </div>
                </div>

                <div className="text-[0.8rem] space-y-1 text-fg-soft mb-3">
                  <p>📍 <strong>Lokasi:</strong> {w.location}</p>
                  <p>👤 <strong>Penanggung Jawab:</strong> {w.manager}</p>
                  <p>📥 <strong>Total Masuk:</strong> +{w.totalInGrams.toLocaleString()} g</p>
                  <p>📤 <strong>Total Keluar:</strong> -{w.totalOutGrams.toLocaleString()} g</p>
                </div>

                <div className="flex justify-between items-center border-t border-line/50 pt-2.5">
                  <span className="badge badge-gold text-[0.7rem]">Akun COA: {w.account}</span>
                  {w.account === '1153' ? (
                    <button
                      className="btn-primary py-1 px-2.5 text-xs bg-linear-135 from-sky to-sky-dark text-white"
                      onClick={() => setShowSilverReceiptModal(true)}
                    >
                      + Terima Perak
                    </button>
                  ) : (
                    <button
                      className="btn-primary py-1 px-2.5 text-xs"
                      onClick={() => {
                        setTransferForm(prev => ({
                          ...prev,
                          fromVaultId: w.id,
                          fromVaultName: w.name,
                          fromAccount: w.account
                        }));
                        setShowTransferModal(true);
                      }}
                    >
                      Transfer Keluar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RIWAYAT MUTASI INTERNAL ANTAR-VAULT */}
      {activeTab === 'transfers' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div>
              <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
                <ArrowRightLeft color="#f97316" size={20} /> Riwayat Transfer Emas Internal Antar-Vault
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Semua pemindahan fisik antar-brankas otomatis menjurnal mutasi debet/kredit akun persediaan SAK EMKM
              </p>
            </div>

            <button
              className="btn-primary bg-linear-135 from-orange to-orange-dark text-white font-bold"
              onClick={() => setShowTransferModal(true)}
            >
              <Plus size={16} /> Buat Transfer Baru
            </button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Transfer</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Gudang Asal (Kredit)</TableHead>
                <TableHead>Gudang Tujuan (Debet)</TableHead>
                <TableHead>Barang Emas</TableHead>
                <TableHead className="text-right">Berat Gram</TableHead>
                <TableHead className="text-right">Estimasi Nilai Jurnal</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.filter(m => m.docType.includes('TRANSFER')).length === 0 ? (
                <TableEmpty colSpan={8} message="Belum ada riwayat transfer internal antar-vault." />
              ) : (
                filteredMovements.filter(m => m.docType.includes('TRANSFER') && m.inQty > 0).map(m => (
                  <TableRow key={m.id}>
                    <TableCell><strong>{m.docNo}</strong></TableCell>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>
                      <span className="badge badge-rose text-xs">
                        {m.refNo?.replace('Diterima dari ', '') || 'Vault Asal'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="badge badge-emerald text-xs">
                        {m.warehouseName}
                      </span>
                    </TableCell>
                    <TableCell><strong>{m.itemName}</strong></TableCell>
                    <TableCell className="text-right font-extrabold text-gold-light text-base">
                      {m.inQty.toLocaleString()} g
                    </TableCell>
                    <TableCell className="text-right text-sky-light font-bold">
                      Rp {m.valueIDR.toLocaleString()}
                    </TableCell>
                    <TableCell><small className="text-fg-soft">{m.serialNo}</small></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* MODAL: TRANSFER ANTAR-VAULT */}
      {showTransferModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px] flex justify-center items-center z-[1000] p-4">
          <div className="glass-panel w-full max-w-[560px] p-6 relative border border-gold">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-gold-light text-[1.15rem] flex items-center gap-2">
                <ArrowRightLeft size={20} /> Form Transfer Emas Antar-Brankas Vault
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="cursor-pointer border-0 bg-none text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Asal (Pengirim / Sisi Kredit Jurnal)</label>
                <Combobox
                  value={transferForm.fromVaultName}
                  onChange={handleFromVaultChange}
                  placeholder="-- Pilih Gudang Asal --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({
                    value: w.name,
                    label: `${w.name} (Akun ${w.account})`
                  }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Tujuan (Penerima / Sisi Debet Jurnal)</label>
                <Combobox
                  value={transferForm.toVaultName}
                  onChange={handleToVaultChange}
                  placeholder="-- Pilih Gudang Tujuan --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({
                    value: w.name,
                    label: `${w.name} (Akun ${w.account})`
                  }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Pilih Jenis Barang Emas</label>
                <Combobox
                  value={transferForm.itemCode}
                  onChange={handleItemChange}
                  placeholder="-- Pilih Barang Emas --"
                  searchPlaceholder="Cari kode atau nama barang…"
                  emptyText="Barang tidak ditemukan."
                  options={availableItemOptions}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Jumlah Berat Emas (Gram)</label>
                <NumberInput
                  allowDecimal
                  value={transferForm.quantityGrams}
                  onChange={quantityGrams => setTransferForm(prev => ({ ...prev, quantityGrams }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label text-gold-light font-bold">Lokasi Slot / Laci Brankas Tujuan (Opsional)</label>
                <input
                  className="form-input border border-gold text-gold-light font-bold"
                  placeholder="Misal: BRANKAS-04 / LACI-B2"
                  value={transferForm.safeBoxSlot || ''}
                  onChange={e => setTransferForm(prev => ({ ...prev, safeBoxSlot: e.target.value }))}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Catatan Keterangan Transfer</label>
                <input
                  className="form-input"
                  value={transferForm.transferNotes}
                  onChange={e => setTransferForm(prev => ({ ...prev, transferNotes: e.target.value }))}
                />
              </div>

              <div className="bg-[rgba(15,23,42,0.8)] p-3.5 rounded-[10px] mb-5 border border-line text-xs space-y-1">
                <div className="text-gold-light font-bold">ℹ️ Info Auto-Jurnal Persediaan SAK EMKM:</div>
                <div className="text-fg-soft">
                  • Debet: {transferForm.toVaultName} (Akun {transferForm.toAccount})
                </div>
                <div className="text-fg-soft">
                  • Kredit: {transferForm.fromVaultName} (Akun {transferForm.fromAccount})
                </div>
                <div className="text-emerald-light font-bold">
                  • Estimasi Nilai Jurnal: Rp {(Number(transferForm.quantityGrams || 0) * 1300000).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  className="btn-primary bg-[rgba(255,255,255,0.1)]"
                  onClick={() => setShowTransferModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white"
                >
                  <CheckCircle2 size={16} /> Proses Transfer & Auto-Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PENERIMAAN / TOP UP STOK PERAK */}
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

