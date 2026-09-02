import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  PackageCheck,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Warehouse,
  ShoppingCart,
  ArrowLeft,
  RotateCcw,
  Clock,
  Sparkles,
  Inbox,
  Truck,
  MoreHorizontal
} from 'lucide-react';
import {
  getAllPurchaseOrdersForReceipt,
  getPurchaseOrders,
  savePurchaseOrders,
  getLocalPurchases,
  saveLocalPurchases,
  recordPOReceipt,
  generateNextTTBNumber,
  resolveGoodsReceiptPO,
  getGoodsReceipts,
  saveGoodsReceipts,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber,
  getGoodsReceiptPrefill,
  clearGoodsReceiptPrefill
} from '../services/storageService';
import { exportTTBPdf } from '../services/pdfService';
import { GoodsReceiptDTO } from '../dto';
import {
  Modal,
  useModal,
  toast,
  Combobox,
  NumberInput,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  CertificatesInput,
  autoCalculateCertificates,
  splitBarWeights
} from '../components/ui';

export default function GoodsReceiptPage() {
  const { modalProps, showModal } = useModal();
  // Petugas yang menerima barang di brankas — dicatat dari sesi login, bukan diketik.
  const { data: session, status: sessionStatus } = useSession();
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePOPrefill, setActivePOPrefill] = useState(null);
  const [receiptUnit, setReceiptUnit] = useState('GRAM'); // 'GRAM' or 'TROY_OUNCE'

  const getCleanFormState = (nextGRN = 'TTB-2026-001') => ({
    grnNumber: nextGRN,
    date: new Date().toISOString().split('T')[0],
    selectedPOId: '',
    poNumber: '',
    supplierDoNumber: '',
    pibNo: '',
    sppbNo: '',
    mawbNo: '',
    barSerialNumbers: '',
    certificates: [],
    assayCertificateNo: '',
    receivedWeightGram: 0,
    notes: ''
  });

  const [form, setForm] = useState(getCleanFormState());

  useEffect(() => {
    loadInitialData();
    checkIncomingPOPrefill();
  }, []);

  const loadInitialData = async () => {
    const pos = getAllPurchaseOrdersForReceipt() || [];
    setPurchaseOrders(pos);
    const grns = getGoodsReceipts() || [];
    setReceipts(grns);
  };

  const checkIncomingPOPrefill = async () => {
    const prefill = getGoodsReceiptPrefill();
    if (prefill && prefill.poNumber) {
      const nextNum = await generateNextTTBNumber();
      setActivePOPrefill(prefill);
      setActiveView('create');

      const isImport = prefill.isImport || (prefill.poNumber && prefill.poNumber.includes('IMP'));
      const initialUnit = (prefill.unitMode === 'oz' || (isImport && prefill.unitMode === 'oz')) ? 'TROY_OUNCE' : 'GRAM';
      setReceiptUnit(initialUnit);

      const weight = Number(prefill.receivedWeightGram || 1000);

      // KONTROL ALGORITMA OTOMATIS: Jika prefill sudah ada sertifikat / nomor seri bar
      const rawCerts = (Array.isArray(prefill.certificates) && prefill.certificates.length > 0)
        ? prefill.certificates
        : (prefill.barSerialNumbers || prefill.barCertificateNo || '');

      const targetWeightInUnit = initialUnit === 'TROY_OUNCE'
        ? (prefill.unitMode === 'oz' && prefill.quantityUnits ? Number(prefill.quantityUnits) : Math.round((weight / 31.1034768) * 10000) / 10000)
        : weight;

      const calculatedCerts = autoCalculateCertificates(rawCerts, targetWeightInUnit, initialUnit);
      const totalBarWeight = calculatedCerts.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
      const effectiveWeightGram = calculatedCerts.length > 0
        ? (initialUnit === 'TROY_OUNCE' ? Math.round(totalBarWeight * 31.1034768 * 100) / 100 : totalBarWeight)
        : weight;
      const barSerialStr = calculatedCerts.length > 0
        ? calculatedCerts.map(c => c.serialNumber).join(', ')
        : (prefill.barSerialNumbers || '');

      setForm({
        ...getCleanFormState(nextNum),
        grnNumber: nextNum,
        selectedPOId: prefill.poNumber,
        poNumber: prefill.poNumber,
        supplierDoNumber: prefill.supplierDoNumber || '',
        pibNo: prefill.pibNo || '',
        sppbNo: prefill.sppbNo || '',
        mawbNo: prefill.mawbNo || '',
        barSerialNumbers: barSerialStr,
        certificates: calculatedCerts,
        receivedWeightGram: effectiveWeightGram,
        notes: `Penerimaan Fisik Emas (DO/TTB) dari PO: ${prefill.poNumber}`
      });
      clearGoodsReceiptPrefill();
      if (calculatedCerts.length > 0) {
        toast.success(`Form TTB terisi otomatis dari PO ${prefill.poNumber}: ${calculatedCerts.length} batang dihitung dengan algoritma (${effectiveWeightGram} g)`);
      } else {
        toast.success(`Form Tanda Terima Barang (TTB) terisi otomatis dari PO: ${prefill.poNumber}`);
      }
    }
  };

  // Helper untuk mengisi form dari objek PO yang dipilih - langsung hitung dengan algoritma jika ada sertifikat
  const applyPOToForm = (foundPO, grnNum = null) => {
    if (!foundPO) return;
    const isImport = foundPO.type === 'IMPORT' || foundPO.type === 'import' || foundPO.currency === 'USD' || (foundPO.poNumber && foundPO.poNumber.includes('IMP'));
    const weight = Number(foundPO.weightGrams || (foundPO.unitMode === 'oz' && foundPO.quantityUnits ? Math.round(foundPO.quantityUnits * 31.1034768 * 100) / 100 : foundPO.quantityUnits) || (foundPO.items && foundPO.items[0]?.quantity) || 1000);

    const initialUnit = (foundPO.unitMode === 'oz' || (isImport && foundPO.unitMode === 'oz')) ? 'TROY_OUNCE' : 'GRAM';
    setReceiptUnit(initialUnit);

    // KONTROL ALGORITMA OTOMATIS: Jika PO sudah ada sertifikat / nomor seri bar
    const rawCerts = (Array.isArray(foundPO.certificates) && foundPO.certificates.length > 0)
      ? foundPO.certificates
      : (foundPO.barSerialNumbers || foundPO.barCertificateNo || '');

    const targetWeightInUnit = initialUnit === 'TROY_OUNCE'
      ? (foundPO.unitMode === 'oz' && foundPO.quantityUnits ? Number(foundPO.quantityUnits) : Math.round((weight / 31.1034768) * 10000) / 10000)
      : weight;

    const calculatedCerts = autoCalculateCertificates(rawCerts, targetWeightInUnit, initialUnit);
    const totalBarWeight = calculatedCerts.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
    const effectiveWeightGram = calculatedCerts.length > 0
      ? (initialUnit === 'TROY_OUNCE' ? Math.round(totalBarWeight * 31.1034768 * 100) / 100 : totalBarWeight)
      : weight;
    const barSerialStr = calculatedCerts.length > 0
      ? calculatedCerts.map(c => c.serialNumber).join(', ')
      : (Array.isArray(foundPO.barSerialNumbers) ? foundPO.barSerialNumbers.join(', ') : (foundPO.barSerialNumbers || ''));

    setForm(prev => ({
      ...prev,
      grnNumber: grnNum || prev.grnNumber,
      selectedPOId: foundPO.poNumber || foundPO.id,
      poNumber: foundPO.poNumber || foundPO.id,
      supplierDoNumber: foundPO.supplierDoNumber || prev.supplierDoNumber || '',
      pibNo: foundPO.pibNo || '',
      sppbNo: foundPO.sppbNo || '',
      mawbNo: foundPO.mawbNo || '',
      barSerialNumbers: barSerialStr,
      certificates: calculatedCerts,
      receivedWeightGram: effectiveWeightGram,
      notes: `Penerimaan fisik emas di brankas vault dari [${foundPO.typeLabel || 'PO'}] ${foundPO.poNumber || foundPO.id}`
    }));

    return { calculatedCerts, effectiveWeightGram };
  };

  // Buka mode Create dengan nomor TTB otomatis baru
  const handleOpenCreate = async (preselectedPO = null) => {
    const nextNum = await generateNextTTBNumber();
    if (preselectedPO) {
      const res = applyPOToForm(preselectedPO, nextNum);
      if (res && res.calculatedCerts && res.calculatedCerts.length > 0) {
        toast.info(`Form TTB disiapkan untuk PO ${preselectedPO.poNumber} (${res.calculatedCerts.length} batang dihitung otomatis)`);
      } else {
        toast.info(`Form TTB disiapkan untuk PO ${preselectedPO.poNumber}`);
      }
    } else {
      setForm(getCleanFormState(nextNum));
    }
    setActiveView('create');
  };

  // Handler Pull From Purchase Order (PO) - SINGLE SOURCE OF TRUTH
  const handlePOSelect = (poId) => {
    if (!poId) {
      setForm(prev => ({
        ...prev,
        selectedPOId: '',
        poNumber: '',
        supplierDoNumber: '',
        pibNo: '',
        sppbNo: '',
        mawbNo: '',
        certificates: [],
        barSerialNumbers: '',
        notes: ''
      }));
      return;
    }

    const foundPO = purchaseOrders.find(p => (p.id === poId || p.poNumber === poId));
    if (foundPO) {
      const res = applyPOToForm(foundPO);
      if (res && res.calculatedCerts && res.calculatedCerts.length > 0) {
        toast.success(`Data ditarik otomatis dari [${foundPO.typeLabel || 'PO'}] ${foundPO.poNumber} (${res.calculatedCerts.length} batang dihitung dengan algoritma: ${res.effectiveWeightGram} g)`);
      } else {
        toast.success(`Data ditarik otomatis dari [${foundPO.typeLabel || 'PO'}] ${foundPO.poNumber}`);
      }
    }
  };

  // Simpan Dokumen TTB & Auto Jurnal
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.poNumber || !form.poNumber.trim()) {
      toast.warning('Pilih dokumen Purchase Order (PO) acuan terlebih dahulu — TTB tidak dapat dibuat tanpa PO.');
      return;
    }

    const validation = GoodsReceiptDTO.validateForm(form);
    if (!validation.success) {
      toast.warning(validation.errorMessages[0] || 'Validasi data TTB gagal. Mohon periksa kembali input Anda.');
      return;
    }

    // TTB tidak boleh anonim: penerimaan fisik emas harus bisa ditelusuri ke satu petugas.
    if (sessionStatus === 'loading') {
      toast.warning('Sesi login belum siap. Tunggu sesaat sebelum menyimpan TTB.');
      return;
    }
    const receivingUser = {
      id: session?.user?.id || '',
      name: session?.user?.name || session?.user?.email || ''
    };
    if (!receivingUser.id) {
      toast.warning('Sesi login tidak terbaca, sehingga petugas penerima tidak bisa dicatat. Masuk ulang lalu simpan kembali TTB ini.');
      return;
    }

    const effectivePONumber = form.poNumber.trim();
    const effectiveDONumber = form.supplierDoNumber && form.supplierDoNumber.trim() ? form.supplierDoNumber.trim() : 'SJ-DIRECT';

    // Supplier, brankas tujuan, deskripsi barang, harga satuan, dan valuasi tidak disimpan
    // di TTB — semuanya diturunkan dari PO acuan.
    const derived = resolveGoodsReceiptPO(
      { poNumber: effectivePONumber, receivedWeightGram: form.receivedWeightGram },
      purchaseOrders
    );

    if (!derived.po) {
      toast.warning(`Dokumen PO ${effectivePONumber} tidak ditemukan. TTB dibatalkan agar data valuasi tidak menggantung.`);
      return;
    }

    const newGRN = {
      id: form.grnNumber,
      grnNumber: form.grnNumber,
      poNumber: effectivePONumber,
      supplierDoNumber: effectiveDONumber,
      date: form.date,
      pibNo: form.pibNo || '',
      sppbNo: form.sppbNo || '',
      mawbNo: form.mawbNo || '',
      barSerialNumbers: form.barSerialNumbers || '',
      certificates: form.certificates || [],
      assayCertificateNo: form.assayCertificateNo || '',
      receivedWeightGram: Number(form.receivedWeightGram || 0),
      receivedByUserId: receivingUser.id,
      receivedByName: receivingUser.name,
      notes: form.notes || '',
      status: 'RECEIVED & VERIFIED',
      createdAt: new Date().toISOString()
    };

    // 1. Simpan Goods Receipt
    const list = getGoodsReceipts();
    list.unshift(newGRN);
    await saveGoodsReceipts(list);

    // 2. Auto Posting Jurnal SAK EMKM & Mutasi Vault
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');

    const linkedPO = derived.po;
    const totalGoodsVal = derived.totalValueIDR;
    const journalLines = [];

    const advanceAccountCode = derived.isImport ? '1135' : '1121-1';
    const advanceAccountName = derived.isImport ? 'Uang Muka Impor / Pembelian Valas (Akun 1135)' : 'Uang Muka Pembelian Emas Lokal (Akun 1121-1)';

    const downPaymentPaid = Number(linkedPO.paidAmountIDR || 0);
    const settleDownPayment = Math.min(downPaymentPaid, totalGoodsVal);
    const remainingPayable = Math.max(0, totalGoodsVal - settleDownPayment);

    // Debet: Persediaan Emas di Vault (100% dari fisik yang diterima)
    journalLines.push({
      accountCode: derived.targetVault,
      accountName: derived.targetVaultName,
      debit: totalGoodsVal,
      credit: 0
    });

    // Kredit 1: Eliminasi Uang Muka yang sudah dibayar sebelum TTB
    if (settleDownPayment > 0) {
      journalLines.push({
        accountCode: advanceAccountCode,
        accountName: advanceAccountName,
        debit: 0,
        credit: settleDownPayment
      });
    }

    // Kredit 2: Pengakuan Sisa Hutang Perusahaan ke Akun 2111 (Trade Payables)
    if (remainingPayable > 0) {
      journalLines.push({
        accountCode: '2111',
        accountName: 'Hutang Usaha Supplier (Akun 2111)',
        debit: 0,
        credit: remainingPayable
      });
    }

    const summaryJournalText = `
• Auto-Jurnal SAK EMKM Rekonsiliasi TTB:
   - Debet  [${derived.targetVault}] ${derived.targetVaultName}: Rp ${totalGoodsVal.toLocaleString('id-ID')}` +
      (settleDownPayment > 0 ? `
   - Kredit [${advanceAccountCode}] ${advanceAccountName}: Rp ${settleDownPayment.toLocaleString('id-ID')} (Eliminasi Uang Muka)` : '') +
      (remainingPayable > 0 ? `
   - Kredit [2111] Hutang Usaha Perusahaan: Rp ${remainingPayable.toLocaleString('id-ID')} (Sisa Hutang Siap Dilunasi)` : '');

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: form.date,
      description: `Penerimaan Emas Fisik (${newGRN.grnNumber}) Ref: ${newGRN.poNumber} | SJ: ${newGRN.supplierDoNumber}${newGRN.pibNo ? ` | PIB: ${newGRN.pibNo}` : ''} - ${derived.supplierName} [TTB Rekonsiliasi Emas & Hutang]`,
      lines: journalLines,
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    // 3. Update status PO acuan (baik Impor maupun Lokal)
    await recordPOReceipt(effectivePONumber, newGRN.grnNumber);

    showModal({
      variant: 'success',
      title: `✅ Penerimaan Barang (${newGRN.grnNumber}) Berhasil Disimpan`,
      message: `• No. TTB        : ${newGRN.grnNumber}
• Ref Dokumen    : ${newGRN.poNumber} (SJ: ${newGRN.supplierDoNumber})
• Pemasok        : ${derived.supplierName}
• Diterima Oleh  : ${newGRN.receivedByName || newGRN.receivedByUserId}
• Penambahan Stok: +${newGRN.receivedWeightGram} Gram ke ${derived.targetVaultName}${summaryJournalText}`
    });

    await loadInitialData();
    setActiveView('list');
  };

  // Antrean PO yang menunggu penerimaan fisik (Pending TTB)
  const pendingPOs = purchaseOrders.filter(po => po.status !== 'received' && po.status !== 'arrived_vault');

  // Setiap TTB dilengkapi atribut turunan dari PO acuannya (supplier, brankas,
  // deskripsi barang, harga satuan, valuasi) — tidak ada lagi salinan di dokumen TTB.
  const resolvedReceipts = receipts.map(r => ({ ...r, ...resolveGoodsReceiptPO(r, purchaseOrders) }));

  // Atribut turunan untuk form TTB yang sedang diisi
  const formDerived = resolveGoodsReceiptPO(
    { poNumber: form.poNumber, receivedWeightGram: form.receivedWeightGram },
    purchaseOrders
  );

  // KPI Calculations
  const totalTTBCount = receipts.length;
  const totalWeightGrams = receipts.reduce((sum, r) => sum + Number(r.receivedWeightGram || 0), 0);
  const totalValuationIDR = resolvedReceipts.reduce((sum, r) => sum + Number(r.totalValueIDR || 0), 0);

  const filteredReceipts = resolvedReceipts.filter(r =>
    r.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.supplierDoNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <PackageCheck className="text-emerald-400" size={26} /> Tanda Terima Barang Vault (Goods Receipt Note - TTB)
            </h2>
            <p className="text-[0.8rem] text-fg-soft mt-1">
              Modul Penerimaan Fisik Emas Dengan Referensi No. PO PT TAN, Nomor Surat Jalan, dan Verifikasi Timbangan Brankas
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className={`btn-primary flex items-center gap-1.5 cursor-pointer ${
                activeView === 'list'
                  ? 'bg-linear-135 from-emerald to-emerald-dark text-white'
                  : 'bg-surface hover:bg-surface-raised text-fg-soft'
              }`}
              onClick={() => setActiveView('list')}
            >
              <PackageCheck size={18} /> Register Penerimaan TTB
            </button>
            <button
              className={`btn-primary flex items-center gap-1.5 cursor-pointer ${
                activeView === 'create'
                  ? 'bg-linear-135 from-gold to-gold-dark text-slate-950 font-bold'
                  : 'bg-surface hover:bg-surface-raised text-gold-light'
              }`}
              onClick={() => handleOpenCreate()}
            >
              <Plus size={18} /> Buat TTB Baru
            </button>
          </div>
        </div>

        {/* Top KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-line">
          <div className="p-3 bg-surface/50 rounded border border-line">
            <span className="stat-lbl text-xs">Total Dokumen TTB</span>
            <div className="text-xl font-bold text-fg mt-0.5">{totalTTBCount} Dokumen</div>
          </div>
          <div className="p-3 bg-surface/50 rounded border border-line">
            <span className="stat-lbl text-xs">Total Fisik Diterima</span>
            <div className="text-xl font-bold text-sky-light mt-0.5">{totalWeightGrams.toLocaleString('id-ID')} Gram</div>
          </div>
          <div className="p-3 bg-surface/50 rounded border border-line">
            <span className="stat-lbl text-xs">Total Valuasi Fisik IDR</span>
            <div className="text-xl font-bold text-emerald-light mt-0.5">Rp {totalValuationIDR.toLocaleString('id-ID')}</div>
          </div>
          <div className="p-3 bg-surface/50 rounded border border-line">
            <span className="stat-lbl text-xs">Antrean PO Menunggu TTB</span>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{pendingPOs.length} Pesanan</div>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE PENERIMAAN BARANG */}
      {activeView === 'list' && (
        <div className="space-y-6">
          {/* Antrean PO Menunggu TTB (Quick Action Queue) */}
          {pendingPOs.length > 0 && (
            <div className="glass-panel p-5 border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="text-amber-400" size={20} />
                  <h4 className="font-heading text-base text-amber-300 m-0">
                    Antrean PO Menunggu Penerimaan Fisik di Vault ({pendingPOs.length} PO Siap Diproses)
                  </h4>
                </div>
                <span className="text-xs text-fg-soft">
                  Klik "📥 Terima di Vault" untuk mengisi form TTB secara otomatis
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingPOs.map(po => {
                  const isImport = po.type === 'IMPORT' || po.currency === 'USD';
                  return (
                    <div
                      key={po.id || po.poNumber}
                      className="p-3.5 bg-surface/80 rounded-md border border-line hover:border-amber-400/50 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="badge badge-gold text-xs font-mono font-bold">
                            {po.poNumber}
                          </span>
                          <span className={`badge text-[11px] ${isImport ? 'badge-sky' : 'badge-emerald'}`}>
                            {po.typeLabel || (isImport ? 'PO Impor' : 'PO Lokal')}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-fg truncate" title={po.supplierName}>
                          {po.supplierName}
                        </div>

                        <div className="text-xs text-fg-soft mt-1">
                          {po.itemDescription || 'Emas Batangan'} • <strong className="text-sky-light">{po.weightGrams} g</strong>
                        </div>

                        <div className="text-[11px] text-fg-muted mt-1">
                          Tujuan: <span className="text-emerald-400">{po.targetVaultName}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary mt-3 py-1.5 px-3 text-xs w-full flex items-center justify-center gap-1.5 cursor-pointer bg-linear-135 from-amber-500 to-amber-600 text-slate-950 font-bold"
                        onClick={() => handleOpenCreate(po)}
                      >
                        <Inbox size={15} /> Terima di Vault (Buat TTB)
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabel Register TTB */}
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
              <h3 className="font-heading text-[1.1rem]">
                📋 Daftar Tanda Terima Barang (TTB / Goods Receipt Note) ({filteredReceipts.length})
              </h3>

              <div className="relative w-75">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
                <input
                  className="form-input pl-9.5 w-full"
                  placeholder="Cari TTB, PO, SJ, atau Supplier..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. TTB (GRN)</TableHead>
                  <TableHead>Ref No. PO PT TAN</TableHead>
                  <TableHead>Surat Jalan & Dokumen</TableHead>
                  <TableHead>Tanggal Terima</TableHead>
                  <TableHead>Diterima Oleh</TableHead>
                  <TableHead>Supplier Emas</TableHead>
                  <TableHead>Vault Tujuan</TableHead>
                  <TableHead>Deskripsi Emas</TableHead>
                  <TableHead className="text-right">Berat Diterima</TableHead>
                  <TableHead className="text-right">Total Valuasi IDR</TableHead>
                  <TableHead>Status Verifikasi</TableHead>
                  <TableHead className="w-16 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableEmpty colSpan={12} message="Belum ada catatan penerimaan barang (TTB/GRN)." />
                ) : (
                  filteredReceipts.map(r => (
                    <TableRow key={r.id || r.grnNumber}>
                      <TableCell><strong className="text-gold-light font-mono">{r.grnNumber}</strong></TableCell>
                      <TableCell>
                        <span className="badge badge-gold text-xs">{r.poNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div><small className="text-sky-light font-semibold block">{r.supplierDoNumber || 'SJ-DIRECT'}</small></div>
                        {(r.pibNo || r.sppbNo || r.mawbNo) && (
                          <div className="text-[0.7rem] text-fg-muted mt-0.5">
                            {r.pibNo && <div>PIB: <span className="text-sky-light">{r.pibNo}</span></div>}
                            {r.sppbNo && <div>SPPB: <span className="text-emerald-light">{r.sppbNo}</span></div>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        {r.receivedByName || r.receivedByUserId
                          ? <span className="text-fg font-semibold">{r.receivedByName || r.receivedByUserId}</span>
                          : <span className="text-fg-muted">Belum tercatat</span>}
                      </TableCell>
                      <TableCell><strong>{r.supplierName || '—'}</strong></TableCell>
                      <TableCell>
                        {r.targetVaultName
                          ? <span className="badge badge-emerald">{r.targetVaultName}</span>
                          : <span className="badge border border-line text-fg-soft">PO acuan tidak ditemukan</span>}
                      </TableCell>
                      <TableCell>{r.itemDescription || '—'}</TableCell>
                      <TableCell className="text-right font-extrabold text-sky-light">{r.receivedWeightGram} g</TableCell>
                      <TableCell className="text-right font-bold text-emerald-light">Rp {(r.totalValueIDR || 0).toLocaleString('id-ID')}</TableCell>
                      <TableCell><span className="badge badge-emerald"><ShieldCheck className="inline mr-1" size={12} />{r.status || 'VERIFIED'}</span></TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                              aria-label={`Aksi untuk ${r.grnNumber}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 z-[1100]">
                            <DropdownMenuItem
                              onClick={async () => {
                                await exportTTBPdf(r);
                                toast.success(`Dokumen Tanda Terima Barang (${r.grnNumber}) siap dicetak.`);
                              }}
                              className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                            >
                              <Printer className="h-4 w-4" />
                              <span>Cetak TTB (Tanda Terima Barang)</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM CREATE GOODS RECEIPT */}
      {activeView === 'create' && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-surface hover:bg-surface-raised text-fg-soft hover:text-white cursor-pointer"
                onClick={() => setActiveView('list')}
              >
                <ArrowLeft size={16} /> Kembali ke Register
              </button>
              <h3 className="font-heading text-[1.2rem] text-gold-light m-0 flex items-center gap-2">
                <PackageCheck size={22} className="text-gold" /> Formulir Tanda Terima Barang (TTB) Brankas Vault
              </h3>
            </div>

            <button
              type="button"
              className="text-xs px-3 py-1.5 bg-surface hover:bg-surface-raised text-fg-soft hover:text-white rounded border border-line cursor-pointer flex items-center gap-1.5"
              onClick={() => handleOpenCreate()}
            >
              <RotateCcw size={14} /> Reset Form / TTB Baru
            </button>
          </div>

          {/* Banner Prefill DO / TTB */}
          {activePOPrefill && (
            <div className="glass-panel p-4 mb-5 border border-gold/50 bg-gold/10 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <strong className="text-sm text-gold-light block">
                    Form Tanda Terima Barang (TTB) Terisi Otomatis dari PO: {activePOPrefill.poNumber}
                  </strong>
                  <p className="text-xs text-fg-soft m-0 mt-0.5">
                    Pemasok: <span className="text-white font-bold">{activePOPrefill.supplierName}</span> | Berat Fisik: <span className="text-white font-bold">{Number(activePOPrefill.receivedWeightGram || 0).toLocaleString('id-ID')} Gram</span> | Brankas Tujuan: <span className="text-white font-bold">{activePOPrefill.targetVaultName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs px-2.5 py-1 bg-surface hover:bg-surface/80 text-fg-soft hover:text-fg rounded border border-line cursor-pointer flex items-center gap-1"
                onClick={() => setActivePOPrefill(null)}
              >
                ✕ Tutup Info
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM PURCHASE ORDER (PO) DROPDOWN (SINGLE SOURCE OF TRUTH) */}
              <div className="form-group col-span-2 bg-[rgba(52,211,153,0.08)] p-3.5 rounded-md border border-emerald-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="form-label text-emerald-light font-bold flex items-center gap-2 mb-0 text-sm">
                    <ShoppingCart size={18} /> Tarik Otomatis Dari Purchase Order PT TAN (PO Impor & PO Lokal):
                  </label>
                  {form.selectedPOId ? (
                    <span className="badge badge-emerald flex items-center gap-1 w-fit text-xs font-semibold">
                      <ShieldCheck size={14} /> Terhubung ke {form.poNumber} (SSOT)
                    </span>
                  ) : (
                    <span className="badge border border-line text-fg-soft text-xs w-fit">
                      Belum Memilih PO (Wajib)
                    </span>
                  )}
                </div>
                <Combobox
                  className="bg-ink text-white font-semibold"
                  value={form.selectedPOId}
                  onChange={handlePOSelect}
                  placeholder="-- (Pilih Purchase Order PO Impor / Lokal Untuk Auto-Fill) --"
                  searchPlaceholder="Cari nomor PO, supplier, atau barang…"
                  emptyText="Nomor PO tidak ditemukan."
                  options={[
                    { value: '', label: '-- (Pilih Purchase Order PO Impor / Lokal) --' },
                    ...purchaseOrders.map(po => ({
                      value: po.poNumber || po.id,
                      label: `[${po.typeLabel || 'PO'}] ${po.poNumber} — ${po.supplierName} (${po.itemDescription || 'Emas Batangan'} - ${po.weightGrams}g) ${po.status === 'received' || po.status === 'arrived_vault' ? '✅ [SUDAH DITERIMA]' : '⏳ [MENUNGGU TTB]'}`
                    }))
                  ]}
                />
                {form.selectedPOId && (
                  <div className="mt-2 pt-1 text-xs text-fg-soft">
                    Supplier <strong className="text-fg">{formDerived.supplierName || '—'}</strong> • Barang <strong className="text-fg">{formDerived.itemDescription || '—'}</strong> • Brankas <strong className="text-emerald-light">{formDerived.targetVaultName || '—'}</strong> • Harga Satuan <strong className="text-gold-light">Rp {formDerived.unitPriceIDRPerGram.toLocaleString('id-ID')}/g</strong> — seluruhnya mengikuti dokumen PO.
                  </div>
                )}
              </div>

              {/* NOMOR TTB */}
              <div className="form-group">
                <label className="form-label font-bold text-fg">No. Tanda Terima Barang (TTB / GRN) *</label>
                <input
                  className="form-input font-mono font-bold text-gold-light"
                  value={form.grnNumber}
                  onChange={e => setForm({ ...form, grnNumber: e.target.value })}
                  placeholder="Contoh: TTB-2026-001"
                  required
                />
              </div>

              {/* INPUT NOMOR SURAT JALAN SUPPLIER */}
              <div className="form-group">
                <label className="form-label text-sky-light font-bold">No. Surat Jalan Supplier (Supplier Delivery Note)</label>
                <input
                  className="form-input border border-sky-light/40 text-sky-light font-semibold"
                  placeholder="Contoh: SJ-SUP-998811 (atau SJ-DIRECT)"
                  value={form.supplierDoNumber}
                  onChange={e => setForm({ ...form, supplierDoNumber: e.target.value })}
                />
              </div>

              {/* TANGGAL TERIMA DI VAULT */}
              <div className="form-group">
                <label className="form-label font-bold text-fg">Tanggal Terima Di Vault *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              {/* PETUGAS PENERIMA — DARI SESI LOGIN, TIDAK DIKETIK */}
              <div className="form-group">
                <label className="form-label font-bold text-fg flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-light" /> Petugas Penerima Barang
                </label>
                <input
                  className="form-input bg-surface-raised text-fg-soft cursor-not-allowed"
                  value={session?.user?.name || session?.user?.email || (sessionStatus === 'loading' ? 'Memuat sesi login…' : 'Sesi login tidak terbaca')}
                  readOnly
                  disabled
                />
                <small className="text-[11px] text-fg-muted">Diambil dari sesi login dan disimpan di TTB sebagai penanggung jawab penerimaan fisik.</small>
              </div>

              {/* AKUN KREDIT LAWAN JURNAL */}
              <div className="form-group">
                <label className="form-label font-bold text-sky-light">Akun Kredit Lawan Jurnal (SAK EMKM) *</label>
                {formDerived.po ? (
                  <div className="p-3 bg-canvas/60 border border-sky-500/30 rounded-md text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-gold-light font-bold">
                      <span>⚡ Auto-Rekonsiliasi SAK EMKM Terkoneksi PO: {form.poNumber}</span>
                    </div>
                    {(() => {
                      const dpPaid = Number(formDerived.po.paidAmountIDR || 0);
                      const totalVal = formDerived.totalValueIDR;
                      const settle = Math.min(dpPaid, totalVal);
                      const remPayable = Math.max(0, totalVal - settle);
                      const umAccount = formDerived.isImport ? '1135 (Uang Muka Impor)' : '1121-1 (Uang Muka Emas Lokal)';
                      return (
                        <div className="text-fg-soft space-y-1">
                          <div>• Eliminasi Uang Muka: <strong className="text-emerald-light">Rp {settle.toLocaleString()}</strong> (Kredit Akun {umAccount})</div>
                          <div>• Pengakuan Sisa Hutang: <strong className="text-sky-light">Rp {remPayable.toLocaleString()}</strong> (Kredit Akun 2111 Hutang Usaha)</div>
                          <div className="text-[11px] text-fg-muted italic">Sistem otomatis mengeliminasi saldo uang muka dan membukukan sisa harga barang ke Hutang Usaha (Akun 2111).</div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-3 bg-canvas/60 border border-line rounded-md text-xs text-fg-soft">
                    Pilih dokumen PO acuan terlebih dahulu — akun kredit lawan jurnal ditentukan dari uang muka yang tercatat di PO tersebut.
                  </div>
                )}
              </div>

              {/* DOKUMEN IMPOR & KEPABEANAN (KONDISIONAL BERDASARKAN VAULT IMPOR) */}
              <div className={`form-group col-span-2 p-4 rounded-md border ${
                formDerived.isImport
                  ? 'bg-sky-500/10 border-sky-500/40'
                  : 'bg-surface/50 border-line'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label text-sky-light font-bold flex items-center gap-1.5 text-sm mb-0">
                    <FileText size={18} /> Dokumen Impor & Kepabeanan {formDerived.isImport ? '(Wajib Untuk Emas Impor / Bea Cukai)' : '(Opsional jika pengadaan lokal)'}
                  </label>
                  {formDerived.isImport && (
                    <span className="badge badge-sky text-[11px]">Customs Clearance</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="form-label text-xs text-sky-light">1. No. PIB (Pemberitahuan Impor)</label>
                    <input
                      type="text"
                      className="form-input text-sky-light font-semibold text-xs"
                      placeholder="Contoh: 001234/PIB/KPU-TP/2026"
                      value={form.pibNo || ''}
                      onChange={e => setForm({ ...form, pibNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs text-emerald-light">2. No. SPPB (Persetujuan Pengeluaran)</label>
                    <input
                      type="text"
                      className="form-input text-emerald-light font-semibold text-xs"
                      placeholder="Contoh: SPPB-009876/KPU.01/2026"
                      value={form.sppbNo || ''}
                      onChange={e => setForm({ ...form, sppbNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs text-gold-light">3. No. MAWB (Master Air Waybill)</label>
                    <input
                      type="text"
                      className="form-input text-gold-light font-semibold text-xs"
                      placeholder="Contoh: SQ-618-99881122"
                      value={form.mawbNo || ''}
                      onChange={e => setForm({ ...form, mawbNo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* NO SERTIFIKAT ASSAY & NOMOR SERI BAR */}
              <div className="form-group">
                <label className="form-label text-xs">No. Sertifikat Assay Kemurnian</label>
                <input
                  className="form-input"
                  placeholder="Contoh: ASSAY-VAL-88912"
                  value={form.assayCertificateNo}
                  onChange={e => setForm({ ...form, assayCertificateNo: e.target.value })}
                />
              </div>

              {/* NOMOR SERTIFIKAT & PEMETAAN KEPING BATANGAN KE BERAT (COMPONENT DARI TAN-ERP DENGAN VERSI GRAM & OZ) */}
              <div className="md:col-span-2">
                <CertificatesInput
                  label="Nomor Sertifikat & Pemetaan Keping Batangan ke Berat"
                  value={form.certificates && form.certificates.length > 0 ? form.certificates : form.barSerialNumbers}
                  weightUnit={receiptUnit}
                  allowUnitToggle={true}
                  onUnitChange={(newUnit) => {
                    setReceiptUnit(newUnit);
                  }}
                  targetWeight={
                    receiptUnit === 'TROY_OUNCE'
                      ? Math.round((Number(form.receivedWeightGram || 0) / 31.1034768) * 10000) / 10000
                      : Number(form.receivedWeightGram || 0)
                  }
                  onChange={(certs, serials, strVal, activeUnit) => {
                    const totalBarWeight = certs.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
                    const convertedGrams = activeUnit === 'TROY_OUNCE'
                      ? Math.round(totalBarWeight * 31.1034768 * 100) / 100
                      : Math.round(totalBarWeight * 100) / 100;

                    const finalWeight = totalBarWeight > 0 ? convertedGrams : form.receivedWeightGram;

                    setForm(prev => ({
                      ...prev,
                      certificates: certs,
                      barSerialNumbers: strVal,
                      receivedWeightGram: finalWeight
                    }));
                  }}
                />
              </div>

              {/* BERAT FISIK EMAS DITERIMA */}
              <div className="form-group">
                <label className="form-label text-emerald-light font-bold">Berat Fisik Emas Diterima (Gram) *</label>
                <NumberInput
                  allowDecimal
                  className="border border-emerald-light/50 text-emerald-light font-bold"
                  value={form.receivedWeightGram}
                  onChange={receivedWeightGram => {
                    const weight = Number(receivedWeightGram || 0);
                    setForm(prev => {
                      let updatedCerts = prev.certificates;
                      if (Array.isArray(prev.certificates) && prev.certificates.length > 0 && weight > 0) {
                        const targetInUnit = receiptUnit === 'TROY_OUNCE'
                          ? Math.round((weight / 31.1034768) * 10000) / 10000
                          : weight;
                        updatedCerts = autoCalculateCertificates(prev.certificates, targetInUnit, receiptUnit);
                      }
                      return {
                        ...prev,
                        certificates: updatedCerts,
                        receivedWeightGram: weight
                      };
                    });
                  }}
                />
              </div>

              {/* CATATAN */}
              <div className="form-group col-span-2">
                <label className="form-label text-xs">Catatan Penerimaan & Hasil Verifikasi Fisik</label>
                <textarea
                  className="form-input text-xs"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contoh: Kondisi fisik emas dan segel Certificate Assay utuh 100%."
                />
              </div>
            </div>

            {/* Calculations & Journal Preview Card */}
            <div className="bg-surface/80 p-4 rounded-md my-5 border border-emerald-500/40">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="stat-lbl text-xs">Total Valuasi Persediaan Fisik (IDR)</span>
                  <div className="font-extrabold text-emerald-light text-xl mt-0.5">
                    Rp {formDerived.totalValueIDR.toLocaleString('id-ID')}
                  </div>
                  <span className="text-xs text-fg-soft">
                    {form.receivedWeightGram} g @ Rp {formDerived.unitPriceIDRPerGram.toLocaleString('id-ID')}/g (harga satuan dari PO)
                  </span>
                </div>
                <div>
                  <span className="stat-lbl text-xs">Pratinjau Auto-Jurnal SAK EMKM</span>
                  {formDerived.po ? (
                    (() => {
                      const totalVal = formDerived.totalValueIDR;
                      const settle = Math.min(Number(formDerived.po.paidAmountIDR || 0), totalVal);
                      const remPayable = Math.max(0, totalVal - settle);
                      const umCode = formDerived.isImport ? '1135' : '1121-1';
                      const umName = formDerived.isImport ? 'Uang Muka Impor / Valas' : 'Uang Muka Pembelian Emas Lokal';
                      return (
                        <div className="text-xs text-fg space-y-1 mt-1 font-mono">
                          <div className="text-sky-light">
                            <strong>DEBET:</strong> Akun {formDerived.targetVault} ({formDerived.targetVaultName}) = Rp {totalVal.toLocaleString('id-ID')}
                          </div>
                          {settle > 0 && (
                            <div className="text-emerald-light">
                              <strong>KREDIT:</strong> Akun {umCode} ({umName}) = Rp {settle.toLocaleString('id-ID')}
                            </div>
                          )}
                          {remPayable > 0 && (
                            <div className="text-emerald-light">
                              <strong>KREDIT:</strong> Akun 2111 (Hutang Usaha) = Rp {remPayable.toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-xs text-fg-soft mt-1">Pilih PO acuan untuk melihat pratinjau jurnal.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary bg-linear-135 from-emerald to-emerald-dark text-white font-bold py-2.5 px-6 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} /> Simpan Tanda Terima Barang (TTB) & Tambah Stok Vault
              </button>
              <button
                type="button"
                className="btn-primary bg-surface hover:bg-surface-raised text-fg-soft py-2.5 px-4 cursor-pointer"
                onClick={() => setActiveView('list')}
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
