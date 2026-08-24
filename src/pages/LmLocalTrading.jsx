import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Printer,
  CheckCircle,
  Package,
  DollarSign,
  Wallet,
  ShieldCheck,
  FileText,
  Layers,
  CheckSquare,
  UserCheck,
  Truck,
  MapPin,
  Send,
  Share2,
  Box,
  ArrowRightLeft,
  History,
  AlertCircle,
  X
} from 'lucide-react';
import {
  getMasterItems,
  getLocalPurchases,
  saveLocalPurchases,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber,
  getPRConversionPrefill,
  clearPRConversionPrefill,
  markPRAsConverted
} from '../services/storageService';
import {
  exportCourierAuthorizationPdf,
  exportPurchaseOrderPdf
} from '../services/pdfService';
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
  Combobox,
  NumberInput,
  Modal,
  useModal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function LmLocalTrading() {
  const { modalProps, showModal } = useModal();
  const [purchases, setPurchases] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' (Direct Tunai Pegadaian) or 'credit' (Tempo PO)
  const [selectedPOHistory, setSelectedPOHistory] = useState(null); // State for Payment History Modal
  const [activePRPrefill, setActivePRPrefill] = useState(null); // State for incoming PR prefill

  const [formData, setFormData] = useState({
    receiptNo: 'KW-PEG-2026-001',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    orderDate: new Date().toISOString().split('T')[0],
    itemCode: 'LM-PEGADAIAN-1KG',
    itemName: 'Emas Batangan Pegadaian 1kg (999.9)',
    paymentSourceAccount: '1111', // '1110' Kas Utama, '1110-1' Kas Kecil, '1111' Bank BCA/Mandiri
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111)',
    quantityGrams: 3000,
    unitPriceIDR: 1350000, // Rp 1.350.000 / g
    barCertificateNo: 'CERT-PEG-998812, CERT-PEG-998813, CERT-PEG-998814',
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)', // Nama Kurir
    courierDocNo: 'SK-KURIR-2026-0801', // No. Surat Kuasa / Tugas
    pickupLocation: 'Pegadaian Jakarta Pusat (Kwitansi Lunas)',
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN', // Nama Pemilik
    ownerApproved: true,
    notes: 'Pembelian 3 Batang Emas 1kg Tunai Direct di Pegadaian Jakarta via Kurir Bpk Budi (Transit 1159 ➔ Vault 1157)'
  });

  useEffect(() => {
    loadInitialData();
    checkIncomingPRPrefill();
  }, []);

  const checkIncomingPRPrefill = () => {
    const prefill = getPRConversionPrefill();
    if (prefill && prefill.category === 'GOLD_LOCAL') {
      setActivePRPrefill(prefill);
      setFormData(prev => ({
        ...prev,
        receiptNo: prefill.receiptNo || prev.receiptNo,
        supplierName: prefill.supplierName || prev.supplierName,
        itemCode: prefill.itemCode || prev.itemCode,
        itemName: prefill.itemName || prev.itemName,
        quantityGrams: prefill.quantityGrams || prev.quantityGrams,
        unitPriceIDR: prefill.unitPriceIDR || prev.unitPriceIDR,
        notes: prefill.notes || prev.notes
      }));
      clearPRConversionPrefill();
    }
  };

  const loadInitialData = () => {
    // 1. Load Master Barang Katalog
    const items = getMasterItems() || [];
    const defaultMasterItems = [
      { id: 'LM-PEGADAIAN-1KG', code: 'LM-PEGADAIAN-1KG', name: 'Emas Batangan Pegadaian 1kg (999.9)', category: 'Emas Murni', unit: 'gram', purity: 99.99, inventoryAccount: '1157' },
      { id: 'LM-ANTAM-1000G', code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)', category: 'Emas Murni', unit: 'gram', purity: 99.99, inventoryAccount: '1157' },
      { id: 'LM-ANTAM-100G', code: 'LM-ANTAM-100G', name: 'Emas Batangan Antam 100g (999.9)', category: 'Emas Murni', unit: 'gram', purity: 99.99, inventoryAccount: '1157' },
      { id: 'GOLD-GRANULE-9999', code: 'GOLD-GRANULE-9999', name: 'Granul Emas Murni 999.9', category: 'Emas Murni', unit: 'gram', purity: 99.99, inventoryAccount: '1157' },
      { id: 'GOLD-SCRAP-LEBUR', code: 'GOLD-SCRAP-LEBUR', name: 'Emas Rongsok / Scrap Leburan (Hasil Uji)', category: 'Scrap', unit: 'gram', purity: 95.00, inventoryAccount: '1152' }
    ];

    // Merge custom master items with defaults without duplicates
    const combined = [...defaultMasterItems];
    items.forEach(it => {
      if (!combined.some(c => c.code === it.code || c.id === it.id)) {
        combined.push(it);
      }
    });
    setMasterItemsList(combined);

    // 2. Load History Transaksi Pembelian
    setPurchases(getLocalPurchases());
  };

  const totalAmount = formData.quantityGrams * formData.unitPriceIDR;

  // Helper untuk menghitung jumlah seri bar dari input teks
  const getDetectedBarCount = (text) => {
    if (!text) return 0;
    const items = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    return items.length;
  };

  const detectedBarCount = getDetectedBarCount(formData.barCertificateNo);

  // Handler Pilihan Barang Master
  const handleItemSelect = (selectedCode) => {
    const foundItem = masterItemsList.find(i => i.code === selectedCode || i.id === selectedCode);
    if (foundItem) {
      setFormData({
        ...formData,
        itemCode: foundItem.code || selectedCode,
        itemName: foundItem.name || selectedCode
      });
    }
  };

  // TAHAP 1: SIMPAN PEMBELIAN TUNAI DIRECT (JURNAL KAS KELUAR ➔ TRANSIT KURIR AKUN 1159)
  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.quantityGrams || !formData.unitPriceIDR || !formData.receiptNo || !formData.courierName) {
      showModal({
        variant: 'warning',
        title: 'Data Belum Lengkap',
        message: 'Mohon lengkapi No Nota Kuitansi, Nama Kurir Pengambil, Jumlah Gram, dan Harga Satuan.'
      });
      return;
    }

    if (!formData.ownerApproved) {
      showModal({
        variant: 'warning',
        title: 'Persetujuan Pemilik Diperlukan',
        message: 'Transaksi pembelian tunai wajib mendapatkan Persetujuan & TTD dari Pemilik / Direktur Utama.'
      });
      return;
    }

    const isCash = paymentMode === 'cash';
    const creditAccount = isCash ? formData.paymentSourceAccount : '2111';
    const creditAccountName = isCash
      ? formData.paymentSourceAccountName
      : 'Hutang Usaha Supplier Lokal (Akun 2111)';

    // Tahap 1: Pembayaran Tunai Direct mencatat ke Akun Transit 1159 (Emas Dalam Perjalanan Kurir)
    const debitAccountStage1 = isCash ? '1159' : '1157';
    const debitAccountNameStage1 = isCash
      ? 'Persediaan Emas Dalam Perjalanan Kurir (Transit Akun 1159)'
      : 'Persediaan Emas Murni 999.9 (Vault Utama Akun 1157)';

    const newPurchase = {
      id: Date.now(),
      paymentMode,
      receiptNo: formData.receiptNo,
      poNumber: isCash ? `CASH-BUY-${formData.receiptNo}` : `PO-LOKAL-${Date.now().toString().slice(-6)}`,
      ttbNumber: `TTB-LOKAL-${Date.now().toString().slice(-6)}`,
      supplierName: formData.supplierName,
      orderDate: formData.orderDate,
      itemCode: formData.itemCode,
      itemName: formData.itemName,
      quantityGrams: Number(formData.quantityGrams),
      unitPriceIDR: Number(formData.unitPriceIDR),
      totalAmount: totalAmount,
      journalAccountDebitStage1: debitAccountStage1,
      journalAccountCreditStage1: creditAccount,
      paymentSourceAccountName: creditAccountName,
      barCertificateNo: formData.barCertificateNo,
      barCountDetected: detectedBarCount,
      courierName: formData.courierName,
      courierDocNo: formData.courierDocNo,
      pickupLocation: formData.pickupLocation,
      ownerApprovedBy: formData.ownerApprovedBy,
      ownerApproved: true,
      warehouseName: 'Vault Utama PT TAN (Akun 1157)',
      status: isCash ? 'IN TRANSIT (DIAMBIL KURIR DI PEGADAIAN JAKARTA)' : 'RECEIVED (CREDIT TEMPO)',
      isVaultReceived: false,

      // Tracking Pembayaran
      paidAmountIDR: isCash ? totalAmount : 0,
      remainingBalanceIDR: isCash ? 0 : totalAmount,
      paymentStatus: isCash ? 'PAID' : 'UNPAID',
      paymentHistory: isCash ? [{
        id: Date.now(),
        voucherNo: `CASH-${formData.receiptNo}`,
        voucherType: 'CASH',
        date: formData.orderDate,
        bank: creditAccountName,
        amount: totalAmount,
        notes: `Pembayaran Tunai Langsung Pengambilan Emas Pegadaian (${formData.receiptNo})`
      }] : [],

      createdAt: new Date().toISOString()
    };

    // 1. Save Purchase Record
    const list = getLocalPurchases();
    list.unshift(newPurchase);
    await saveLocalPurchases(list);

    // 2. Auto-Post Journal Entry TAHAP 1 (Debet 1159 Transit Emas Kurir vs Kredit Kas/Bank 1111/1110)
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: formData.orderDate,
      description: isCash
        ? `[TAHAP 1] Pembayaran Tunai Direct & Ambil Emas Pegadaian (${newPurchase.receiptNo}) - Barang: ${newPurchase.itemName} (${newPurchase.quantityGrams}g) | Debet: Akun 1159 (Transit Kurir ${newPurchase.courierName}) | Kredit: ${creditAccountName}`
        : `Pembelian LM Kredit PO (${newPurchase.poNumber}) - ${formData.supplierName} [Debet 1157 vs Kredit 2111]`,
      lines: [
        { accountCode: debitAccountStage1, accountName: debitAccountNameStage1, debit: totalAmount, credit: 0 },
        { accountCode: creditAccount, accountName: creditAccountName, debit: 0, credit: totalAmount }
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    // 3. Mark PR as converted if this purchase came from a PR prefill
    let prNote = '';
    if (activePRPrefill) {
      await markPRAsConverted(activePRPrefill.sourcePRId || activePRPrefill.sourcePRNumber, {
        poNumber: newPurchase.poNumber || newPurchase.receiptNo,
        poType: 'GOLD_LOCAL',
        supplier: formData.supplierName
      });
      prNote = `\n• Ref PR: ${activePRPrefill.sourcePRNumber} (Status PR otomatis ter-update: CONVERTED TO PO)`;
      setActivePRPrefill(null);
    }

    showModal({
      variant: 'success',
      title: isCash
        ? `✅ Tahap 1 Tersimpan — Pembayaran Tunai Rp ${totalAmount.toLocaleString()}`
        : '✅ Pembelian Kredit Tempo Tersimpan',
      message: isCash
        ? `• Jurnal Tahap 1: Debet Akun 1159 (Emas Dalam Perjalanan Kurir) vs Kredit ${creditAccountName}\n• Kurir (${newPurchase.courierName}) ditugaskan ambil emas di Pegadaian Jakarta.\n• Catatan: Persediaan Vault Utama (1157) BELUM DIDEBET sampai kurir tiba membawa fisik emas ke kantor PT TAN!${prNote}`
        : `Nomor PO: ${newPurchase.poNumber}\nStatus Pembayaran: 🔴 UNPAID (Siap dibayar via BBK di Voucher Kasir)${prNote}`
    });
    loadInitialData();
  };

  // TAHAP 2: KONFIRMASI EMAS TIBA DI BRANKAS VAULT (POSTING JURNAL DEBET 1157 VAULT VS KREDIT 1159 TRANSIT)
  const handleConfirmVaultArrival = (purchase) => {
    if (purchase.isVaultReceived) {
      showModal({
        variant: 'info',
        title: 'Sudah Dikonfirmasi',
        message: 'Emas ini sudah dikonfirmasi masuk ke Vault Utama.'
      });
      return;
    }

    showModal({
      variant: 'confirm',
      title: '📦 Konfirmasi Tiba Di Brankas Vault PT TAN',
      message: `• No. Nota: ${purchase.receiptNo}\n• Barang: ${purchase.itemName} (${purchase.quantityGrams}g)\n• Kurir: ${purchase.courierName}\n\nPosting Jurnal Tahap 2:\nDebet: Akun 1157 (Vault Utama PT TAN) Rp ${purchase.totalAmount.toLocaleString()}\nKredit: Akun 1159 (Transit Emas Kurir) Rp ${purchase.totalAmount.toLocaleString()}\n\nApakah Anda yakin fisik emas sudah ditimbang & diterima lengkap?`,
      confirmLabel: 'Ya, Posting Jurnal Tahap 2',
      onConfirm: () => postVaultArrival(purchase)
    });
  };

  const postVaultArrival = async (purchase) => {
    // 1. Update Purchase Record Status
    const list = getLocalPurchases();
    const updatedList = list.map(item => {
      if (item.id === purchase.id || item.receiptNo === purchase.receiptNo) {
        return {
          ...item,
          status: 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)',
          isVaultReceived: true,
          vaultReceivedAt: new Date().toISOString()
        };
      }
      return item;
    });
    await saveLocalPurchases(updatedList);

    // 2. Auto-Post Journal Entry TAHAP 2 (Debet 1157 Vault Utama vs Kredit 1159 Transit Emas Kurir)
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: new Date().toISOString().split('T')[0],
      description: `[TAHAP 2] Serah Terima Fisik Emas Ke Vault Utama (${purchase.receiptNo}) - Barang: ${purchase.itemName} (${purchase.quantityGrams}g) | Debet: Akun 1157 (Vault Utama) | Kredit: Akun 1159 (Transit Kurir ${purchase.courierName})`,
      lines: [
        { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Lokal - Vault Utama)', debit: purchase.totalAmount, credit: 0 },
        { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan Kurir (Transit)', debit: 0, credit: purchase.totalAmount }
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    showModal({
      variant: 'success',
      title: '🎉 Tahap 2 Sukses — Physical Stock In Vault',
      message: `• Debet Akun 1157 (Vault Utama) +${purchase.quantityGrams}g berhasil!\n• Kredit Akun 1159 (Transit Kurir) ditutup Rp ${purchase.totalAmount.toLocaleString()}\n• Dokumen TTB resmi diverifikasi 4 TTD.`
    });
    loadInitialData();
  };

  return (
    <div className="space-y-6">
      {/* Banner Prefill Purchase Request */}
      {activePRPrefill && (
        <Alert
          variant="info"
          title={`Form Pembelian Emas Lokal Diisi Otomatis dari Purchase Request: ${activePRPrefill.sourcePRNumber}`}
          icon={<Package size={22} className="text-gold-light" />}
          className="border-gold/50 bg-gold/10"
        >
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-xs text-fg-soft m-0">
              Departemen: <strong className="text-fg">{activePRPrefill.department}</strong> | Pemohon: <strong className="text-fg">{activePRPrefill.requesterName}</strong> | Supplier Ref: {activePRPrefill.supplierName}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActivePRPrefill(null)}
              leftIcon={<X size={13} />}
            >
              Bersihkan Prefill
            </Button>
          </div>
        </Alert>
      )}

      {/* FORM CARD */}
      <Card>
        <CardHeader className="flex-row items-start justify-between flex-wrap gap-4 border-b border-line pb-5">
          <div>
            <CardTitle>
              <ShoppingCart className="text-gold" size={24} />
              Pembelian Emas Lokal (Direct Cash Pegadaian Jakarta)
            </CardTitle>
            <CardDescription className="mt-1">
              Alur 2 Tahap Akuntansi SAK EMKM: Transit Kurir (Akun 1159) ➔ Penerimaan Fisik Vault Utama (Akun 1157)
            </CardDescription>
          </div>

          {/* Mode Transaksi Selector Buttons */}
          <div className="flex gap-1.5 bg-canvas/80 p-1.5 rounded-md border border-line">
            <Button
              size="sm"
              variant={paymentMode === 'cash' ? 'emerald' : 'ghost'}
              onClick={() => setPaymentMode('cash')}
              leftIcon={<Wallet size={15} />}
            >
              💵 Tunai Direct (Transit 1159 ➔ Vault 1157)
            </Button>
            <Button
              size="sm"
              variant={paymentMode === 'credit' ? 'sky' : 'ghost'}
              onClick={() => setPaymentMode('credit')}
              leftIcon={<FileText size={15} />}
            >
              📝 Pembelian Tempo (Memakai PO)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mode Indicator Banner Alert */}
            {paymentMode === 'cash' ? (
              <Alert
                variant="success"
                icon={<ArrowRightLeft className="text-emerald-light" size={24} />}
                title="Alur 2-Tahap Akuntansi & Kontrol Fisik Brankas PT TAN"
              >
                <p className="m-0 leading-relaxed text-fg-soft">
                  <strong className="text-fg">• Tahap 1 (Saat Transfer Bayar)</strong>: Debet <code className="text-emerald-light">1159</code> (Emas Dalam Perjalanan Kurir) vs Kredit Kas/Bank (<code className="text-emerald-light">1111</code>).<br />
                  <strong className="text-fg">• Tahap 2 (Saat Emas Tiba di Brankas)</strong>: Klik Konfirmasi Vault ➔ Debet <code className="text-emerald-light">1157</code> (Vault Utama) vs Kredit <code className="text-emerald-light">1159</code> (Transit Kurir).
                </p>
              </Alert>
            ) : (
              <Alert
                variant="info"
                icon={<FileText className="text-sky-light" size={24} />}
                title="Mode Pembelian Kredit Supplier (Purchase Order PO)"
              >
                <p className="m-0 leading-relaxed text-fg-soft">
                  Untuk transaksi pembelian dengan perjanjian tempo/kredit. Meng-generate PO dan mencatat ke Hutang Usaha (Akun 2111).
                </p>
              </Alert>
            )}

            {/* FORM INPUT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label required>
                  {paymentMode === 'cash' ? 'No. Nota / Kuitansi Pegadaian' : 'No. PO Pembelian'}
                </Label>
                <Input
                  className="font-bold text-gold-light"
                  value={formData.receiptNo}
                  onChange={e => setFormData({ ...formData, receiptNo: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label required>Tgl Transaksi / Ambil Emas</Label>
                <Input
                  type="date"
                  value={formData.orderDate}
                  onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label required>Supplier / Tempat Beli Emas</Label>
                <Combobox
                  value={formData.supplierName}
                  onChange={supplierName => setFormData({ ...formData, supplierName })}
                  searchPlaceholder="Cari nama supplier…"
                  emptyText="Supplier tidak ditemukan."
                  options={[
                    { value: 'PT Pegadaian (Persero) Jakarta', label: 'PT Pegadaian (Persero) Jakarta' },
                    { value: 'PT Antam Tbk (UBPP LM Jakarta)', label: 'PT Antam Tbk (UBPP LM Jakarta)' },
                    { value: 'PT UBS Fine Gold (Surabaya)', label: 'PT UBS Fine Gold' },
                    { value: 'Toko Emas & Bullion Dealer Jakarta', label: 'Toko Emas & Bullion Dealer Jakarta' }
                  ]}
                />
              </div>

              {/* SELEKSI BARANG DARI MASTER DATA BARANG */}
              <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3 bg-gold/10 p-3.5 rounded-sm border border-gold/40">
                <Label required className="text-gold-light font-bold">
                  <Box size={16} /> Pilih Produk Dari Master Kode Barang Emas:
                </Label>
                <Combobox
                  className="bg-ink text-gold-light font-bold text-sm"
                  value={formData.itemCode}
                  onChange={handleItemSelect}
                  placeholder="-- (Pilih Barang Emas Dari Master Katalog PT TAN) --"
                  searchPlaceholder="Cari kode atau nama barang…"
                  emptyText="Barang tidak ditemukan di master katalog."
                  options={masterItemsList.map(item => ({
                    value: item.code || item.id,
                    label: `[${item.code}] ${item.name} (${item.category || 'Emas Murni'} - ${item.purity || 99.99}%)`
                  }))}
                />
              </div>

              {/* INFORMASI KURIR PENGAMBIL EMAS */}
              <div className="flex flex-col gap-1.5">
                <Label required className="text-sky-light font-bold">
                  <Truck size={14} className="inline mr-0.5" /> Nama Kurir Pengambil Emas
                </Label>
                <Input
                  className="border-sky-light/40 text-sky-light font-bold placeholder:text-sky-light/30"
                  placeholder="Misal: Bpk. Budi (Kurir Khusus)"
                  value={formData.courierName}
                  onChange={e => setFormData({ ...formData, courierName: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>No. Surat Tugas / Surat Kuasa Kurir</Label>
                <Input
                  placeholder="No. Surat Kuasa Ambil Emas..."
                  value={formData.courierDocNo}
                  onChange={e => setFormData({ ...formData, courierDocNo: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  <MapPin size={14} className="inline mr-0.5" /> Lokasi Pengambilan (Cabang)
                </Label>
                <Input
                  placeholder="Misal: Pegadaian Cabang Jakarta Pusat..."
                  value={formData.pickupLocation}
                  onChange={e => setFormData({ ...formData, pickupLocation: e.target.value })}
                />
              </div>

              {/* Sumber Pembayaran Kas / Bank jika Mode Tunai */}
              {paymentMode === 'cash' ? (
                <div className="flex flex-col gap-1.5">
                  <Label required className="text-emerald-light font-bold">
                    <Wallet size={14} className="inline mr-0.5" /> Sumber Rekening Bayar Tunai
                  </Label>
                  <Select
                    className="border-emerald/40 text-emerald-light font-bold"
                    value={formData.paymentSourceAccount}
                    onChange={e => {
                      const acc = e.target.value;
                      const name = acc === '1111' ? 'Bank BCA IDR (Akun 1111)' : acc === '1110' ? 'Kas Utama PT TAN (Akun 1110)' : 'Kas Kecil (Akun 1110-1)';
                      setFormData({ ...formData, paymentSourceAccount: acc, paymentSourceAccountName: name });
                    }}
                  >
                    <option value="1111">Bank BCA IDR (Akun 1111)</option>
                    <option value="1110">Kas Utama PT TAN (Akun 1110)</option>
                    <option value="1110-1">Kas Kecil Operasional (Akun 1110-1)</option>
                  </Select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>Tipe Pembayaran</Label>
                  <Input disabled value="Kredit Tempo / Utang Supplier (Akun 2111)" />
                </div>
              )}

              {/* OTORISASI & NAMA PEMILIK / DIREKTUR */}
              <div className="flex flex-col gap-1.5">
                <Label required className="text-gold-light font-bold">
                  <UserCheck size={14} className="inline mr-0.5" /> Otorisasi TTD Pemilik / Direktur
                </Label>
                <Input
                  className="border-gold/40 text-gold-light font-bold"
                  placeholder="Nama Pemilik / Direktur Utama..."
                  value={formData.ownerApprovedBy}
                  onChange={e => setFormData({ ...formData, ownerApprovedBy: e.target.value })}
                />
              </div>

              {/* INPUT BANYAK NOMOR SERTIFIKAT / MULTI BAR SERIALS */}
              <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sky-light font-bold">
                    <Layers size={15} /> Multi No. Sertifikat / Nomor Seri Batangan (Pisahkan Koma / Enter):
                  </Label>
                  {detectedBarCount > 0 && (
                    <Badge variant="emerald" dot>
                      📦 {detectedBarCount} Batang Bar Terdeteksi
                    </Badge>
                  )}
                </div>
                <Textarea
                  rows={2}
                  className="border-sky-light/40 font-mono text-xs text-white"
                  placeholder="Contoh: CERT-PEG-001, CERT-PEG-002, CERT-PEG-003, CERT-PEG-004..."
                  value={formData.barCertificateNo}
                  onChange={e => setFormData({ ...formData, barCertificateNo: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label required>Total Berat Fisik Emas (Gram)</Label>
                <NumberInput
                  allowDecimal
                  className="border-gold/40 text-gold-light font-bold text-base"
                  value={formData.quantityGrams}
                  onChange={quantityGrams => setFormData({ ...formData, quantityGrams })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label required>Harga Beli Tunai IDR / Gram</Label>
                <NumberInput
                  className="text-base"
                  value={formData.unitPriceIDR}
                  onChange={unitPriceIDR => setFormData({ ...formData, unitPriceIDR })}
                />
              </div>

              {/* CHECKBOX OTORISASI PEMILIK */}
              <div className="flex items-center md:col-span-2 lg:col-span-3 bg-gold/10 p-3 rounded-sm border border-gold/40">
                <label className="flex items-center gap-2.5 text-gold-light font-bold cursor-pointer text-sm select-none">
                  <input
                    className="w-4 h-4 rounded accent-gold cursor-pointer"
                    type="checkbox"
                    checked={formData.ownerApproved}
                    onChange={e => setFormData({ ...formData, ownerApproved: e.target.checked })}
                  />
                  ✍️ Konfirmasi Persetujuan Pembelian Tunai & Siap Di-TTD Oleh Pemilik ({formData.ownerApprovedBy})
                </label>
              </div>
            </div>

            {/* SUMMARY STATS PANEL */}
            <div className="bg-canvas/90 p-4 rounded-md border border-gold/25">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="stat-lbl">Total Pembelian IDR</span>
                  <div className="font-heading font-extrabold text-gold-light text-2xl mt-0.5">
                    Rp {totalAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Jurnal Tahap 1 (Transfer Bayar)</span>
                  <div className="font-bold text-sky-light text-xs mt-1 leading-relaxed">
                    Debet: Akun 1159 (Transit Kurir {formData.courierName})<br />
                    Kredit: {paymentMode === 'cash' ? formData.paymentSourceAccountName : 'Akun 2111 (Hutang Usaha)'}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Jurnal Tahap 2 (Tiba Di Brankas)</span>
                  <div className="font-bold text-emerald-light text-xs mt-1 leading-relaxed">
                    Debet: Akun 1157 (Vault Utama PT TAN)<br />
                    Kredit: Akun 1159 (Transit Kurir Closed)
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <Button
              type="submit"
              size="lg"
              variant={paymentMode === 'cash' ? 'emerald' : 'sky'}
              className="w-full text-sm font-bold shadow-md"
              leftIcon={paymentMode === 'cash' ? <CheckCircle size={18} /> : <Plus size={18} />}
            >
              {paymentMode === 'cash'
                ? 'Simpan Pembelian Tunai & Penugasan Kurir (Post Jurnal Tahap 1: Debet 1159 Transit)'
                : 'Terbitkan PO & Catat Pembelian Emas Kredit (Hutang 2111)'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* HISTORY TABLE CARD */}
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b border-line pb-4">
          <div>
            <CardTitle>
              📋 Riwayat Pembelian Emas Lokal
              <Badge variant="gold" size="sm" className="ml-2">
                {purchases.length} Transaksi
              </Badge>
            </CardTitle>
            <CardDescription className="mt-0.5">
              Register dokumen kuitansi, penugasan kurir, status brankas vault, dan riwayat pembayaran cicilan
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Nota / PO</TableHead>
                <TableHead>Status Tahap Transit / Vault</TableHead>
                <TableHead>Supplier & Lokasi Ambil</TableHead>
                <TableHead>Kurir Pengambil</TableHead>
                <TableHead>Barang Master & No. Seri Bar</TableHead>
                <TableHead className="text-right">Berat Gram</TableHead>
                <TableHead className="text-right">Total Valuasi (IDR)</TableHead>
                <TableHead>Status Pembayaran</TableHead>
                <TableHead>Otorisasi</TableHead>
                <TableHead>Aksi Verifikasi & Dokumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada riwayat pembelian Emas Lokal." />
              ) : (
                purchases.map(p => {
                  const certList = (p.barCertificateNo || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                  const isReceived = p.isVaultReceived || p.status?.includes('RECEIVED & STOCKED');
                  const totalAmt = Number(p.totalAmount || 0);
                  const isCash = p.paymentMode === 'cash';
                  const paidIDR = Number(p.paidAmountIDR || (isCash ? totalAmt : 0));
                  const remainingIDR = typeof p.remainingBalanceIDR !== 'undefined' ? Number(p.remainingBalanceIDR) : Math.max(0, totalAmt - paidIDR);

                  let paymentBadge = (
                    <Badge variant="rose" dot>
                      🔴 UNPAID
                    </Badge>
                  );
                  if (paidIDR >= totalAmt && totalAmt > 0) {
                    paymentBadge = (
                      <Badge variant="emerald" dot>
                        🟢 LUNAS {isCash ? '(TUNAI)' : '(PAID)'}
                      </Badge>
                    );
                  } else if (paidIDR > 0 && remainingIDR > 0) {
                    paymentBadge = (
                      <Badge variant="gold" size="sm">
                        🟡 DICICIL (Sisa Rp {remainingIDR.toLocaleString()})
                      </Badge>
                    );
                  }

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <strong className="text-fg">{p.receiptNo || p.poNumber}</strong>
                      </TableCell>
                      <TableCell>
                        {isReceived ? (
                          <Badge variant="emerald" dot>
                            VAULT STOCKED (1157)
                          </Badge>
                        ) : (
                          <Badge variant="gold" dot>
                            IN TRANSIT KURIR (1159)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <strong>{p.supplierName}</strong>
                        <br />
                        <small className="text-fg-muted flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-fg-muted" /> {p.pickupLocation || 'Jakarta'}
                        </small>
                      </TableCell>
                      <TableCell>
                        <Badge variant="emerald" size="sm" icon={<Truck size={12} />}>
                          {p.courierName || 'Kurir Internal'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <strong>{p.itemName}</strong>
                        <br />
                        <small className="text-gold-light">Kode: {p.itemCode}</small>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {certList.map((cert, idx) => (
                            <Badge key={idx} variant="secondary" size="sm" className="text-[0.68rem] px-1.5 py-0">
                              #{idx + 1}: {cert}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-gold-light font-sans">
                        {p.quantityGrams} g
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-light font-sans">
                        Rp {totalAmt.toLocaleString()}
                      </TableCell>
                      <TableCell>{paymentBadge}</TableCell>
                      <TableCell>
                        <Badge variant="gold" size="sm" icon={<UserCheck size={12} />}>
                          {p.ownerApprovedBy || 'Pemilik PT TAN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {!isReceived && (
                            <Button
                              size="sm"
                              variant="emerald"
                              onClick={() => handleConfirmVaultArrival(p)}
                              leftIcon={<Box size={13} />}
                            >
                              Konfirmasi Vault (1157)
                            </Button>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-sky-light border-sky-light/30 hover:border-sky-light hover:text-sky-light text-xs px-2.5 h-7"
                              onClick={() => setSelectedPOHistory(p)}
                              leftIcon={<History size={12} />}
                            >
                              Riwayat
                            </Button>
                            <Button
                              size="sm"
                              variant="sky"
                              className="text-xs px-2.5 h-7"
                              onClick={async () => {
                                await exportCourierAuthorizationPdf(p);
                                showModal({
                                  variant: 'info',
                                  title: `📱 Dispatch WhatsApp PDF (${p.receiptNo || p.poNumber})`,
                                  message: `Dokumen PDF Surat Kuasa Ambil Emas (${p.receiptNo || p.poNumber}) berhasil di-generate dan dibuka di tab baru untuk langsung dicetak/dikirimkan ke WhatsApp Kurir (${p.courierName || 'Bpk. Budi'}) & Kasir ${p.supplierName} Jakarta.`
                                });
                              }}
                              leftIcon={<Share2 size={12} />}
                            >
                              WA PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs px-2.5 h-7"
                              onClick={async () => {
                                await exportCourierAuthorizationPdf(p);
                                showModal({
                                  variant: 'success',
                                  title: `🖨️ Cetak Bukti Serah Terima Vault (${p.receiptNo || p.poNumber})`,
                                  message: `Dokumen Surat Kuasa & Serah Terima 4 TTD (${p.receiptNo || p.poNumber}) berhasil di-generate dan dibuka di tab baru untuk langsung dicetak.\n\nBarang: ${p.itemName} (${p.itemCode})\nJurnal Status: ${isReceived ? 'Tahap 2 Selesai (Debet 1157 Vault)' : 'Tahap 1 (Debet 1159 Transit Kurir)'}\nStatus Pembayaran: ${paidIDR >= totalAmt && totalAmt > 0 ? '🟢 LUNAS' : paidIDR > 0 ? `🟡 DICICIL (Sisa Rp ${remainingIDR.toLocaleString()})` : '🔴 BELUM BAYAR'}\n\nLengkap dengan 4 kolom tanda tangan fisik:\n1. Kurir Pengambil: ${p.courierName || 'Bpk Budi'} (No. ${p.courierDocNo || 'SK-KURIR-01'})\n2. Yang Menyerahkan: ${p.supplierName} (${p.pickupLocation || 'Jakarta'})\n3. Penerima Vault: Petugas Brankas PT TAN (Vault 1157)\n4. Disetujui & TTD Pemilik: ${p.ownerApprovedBy || 'Pemilik PT TAN'}`
                                });
                              }}
                              leftIcon={<Printer size={12} />}
                            >
                              4 TTD
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              className="text-xs px-2.5 h-7"
                              onClick={async () => {
                                await exportPurchaseOrderPdf(p);
                                showModal({
                                  variant: 'success',
                                  title: `🖨️ Cetak Dokumen PO ${p.poNumber || p.receiptNo}`,
                                  message: `Dokumen Purchase Order Lokal (${p.poNumber || p.receiptNo}) berhasil di-generate dan dibuka di tab baru untuk langsung dicetak.\n\n• Supplier: ${p.supplierName}\n• Total Berat: ${p.weightGrams} g\n• Total Nilai: Rp ${(p.totalAmount || 0).toLocaleString()}`
                                });
                              }}
                              leftIcon={<Printer size={12} />}
                            >
                              PO
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL POPUP RIWAYAT CICILAN PEMBAYARAN PO LOKAL (AUDIT TRAIL) */}
      {selectedPOHistory && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[9999] p-5 backdrop-blur-xs animate-modal-fade">
          <Card className="w-full max-w-[680px] bg-[#0f172a] border-gold shadow-modal animate-modal-rise">
            <CardHeader className="flex-row items-center justify-between border-b border-line pb-3.5">
              <CardTitle className="text-gold-light text-base">
                <History size={18} /> Log Riwayat Pembayaran BBK / Kas (Audit Trail)
              </CardTitle>
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={() => setSelectedPOHistory(null)}
              >
                <X size={14} />
              </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="bg-white/[0.03] p-3.5 rounded-sm border border-line">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <span className="stat-lbl">No. Transaksi / PO</span>
                    <strong className="text-sky-light block mt-0.5 text-xs font-mono">
                      {selectedPOHistory.receiptNo || selectedPOHistory.poNumber}
                    </strong>
                  </div>
                  <div>
                    <span className="stat-lbl">Supplier</span>
                    <strong className="text-fg block mt-0.5 text-xs">
                      {selectedPOHistory.supplierName}
                    </strong>
                  </div>
                  <div>
                    <span className="stat-lbl">Total Tagihan</span>
                    <strong className="text-fg block mt-0.5 text-xs font-sans">
                      Rp {Number(selectedPOHistory.totalAmount || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="stat-lbl">Sisa Hutang Pokok</span>
                    <strong className="text-gold-light block mt-0.5 text-xs font-sans">
                      Rp {(typeof selectedPOHistory.remainingBalanceIDR !== 'undefined' ? selectedPOHistory.remainingBalanceIDR : Math.max(0, Number(selectedPOHistory.totalAmount || 0) - Number(selectedPOHistory.paidAmountIDR || 0))).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-sky-light">
                  📋 Rincian Transaksi Voucher Pembayaran Diterbitkan:
                </h4>
                <Badge variant="sky" size="sm">
                  {selectedPOHistory.paymentHistory?.length || 0} Voucher Diterbitkan
                </Badge>
              </div>

              {(!selectedPOHistory.paymentHistory || selectedPOHistory.paymentHistory.length === 0) ? (
                <div className="p-6 text-center text-fg-muted bg-field/50 rounded-sm border border-line">
                  <AlertCircle size={28} className="text-danger mx-auto mb-2 opacity-80" />
                  Belum ada transaksi pembayaran (BBK/BKK) untuk transaksi ini. (Status: 🔴 UNPAID)
                </div>
              ) : (
                <Table containerClassName="max-h-[260px] overflow-y-auto" className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Voucher</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Sumber Rekening</TableHead>
                      <TableHead className="text-right">Nominal (IDR)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPOHistory.paymentHistory.map((pmt, i) => (
                      <TableRow key={i}>
                        <TableCell><strong className="text-sky-light font-mono">{pmt.voucherNo}</strong></TableCell>
                        <TableCell>{pmt.date}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              pmt.category === 'CUSTOMS_DUTY_PPH22'
                                ? 'sky'
                                : pmt.category === 'LOGISTICS_HANDLING'
                                ? 'emerald'
                                : pmt.category === 'OTHER_EXPENSE'
                                ? 'orange'
                                : 'gold'
                            }
                            size="sm"
                          >
                            {pmt.categoryLabel || (pmt.category === 'CUSTOMS_DUTY_PPH22' ? '🏛️ Pajak PPh 22' : pmt.category === 'LOGISTICS_HANDLING' ? '🚚 Logistik' : '💰 Pokok Supplier')}
                          </Badge>
                        </TableCell>
                        <TableCell><span className="font-semibold text-fg">{pmt.payee || selectedPOHistory.supplierName}</span></TableCell>
                        <TableCell><small className="text-fg-soft">{pmt.bank || 'Bank BCA IDR'}</small></TableCell>
                        <TableCell className="text-right font-extrabold text-emerald-light font-sans">
                          Rp {Number(pmt.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="emerald" size="sm" dot>
                            POSTED
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedPOHistory(null)}
                >
                  Selesai / Tutup
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
