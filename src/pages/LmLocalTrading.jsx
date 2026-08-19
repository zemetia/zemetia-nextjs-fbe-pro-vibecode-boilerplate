import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer, CheckCircle, Package, DollarSign, Wallet, ShieldCheck, FileText, Layers, CheckSquare, UserCheck, Truck, MapPin, Send, Share2, Box, ArrowRightLeft, History, AlertCircle } from 'lucide-react';
import { getMasterItems } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

export default function LmLocalTrading() {
  const { modalProps, showModal } = useModal();
  const [purchases, setPurchases] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' (Direct Tunai Pegadaian) or 'credit' (Tempo PO)
  const [selectedPOHistory, setSelectedPOHistory] = useState(null); // State for Payment History Modal

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
  }, []);

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
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_local_purchases') || [
        {
          id: 'PURCH-CASH-001',
          paymentMode: 'cash',
          receiptNo: 'KW-PEG-2026-001',
          poNumber: 'CASH-BUY-PEGADAIN',
          ttbNumber: 'TTB-PEG-2026-001',
          supplierName: 'PT Pegadaian (Persero) Jakarta',
          orderDate: new Date().toISOString().split('T')[0],
          itemCode: 'LM-PEGADAIAN-1KG',
          itemName: 'Emas Batangan Pegadaian 1kg (999.9)',
          quantityGrams: 3000,
          unitPriceIDR: 1350000,
          totalAmount: 4050000000,
          journalAccountDebitStage1: '1159', // Debet Transit Kurir
          journalAccountCreditStage1: '1111', // Kredit Bank BCA
          paymentSourceAccountName: 'Bank BCA IDR (Akun 1111)',
          barCertificateNo: 'CERT-PEG-998812, CERT-PEG-998813, CERT-PEG-998814',
          courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
          courierDocNo: 'SK-KURIR-2026-0801',
          pickupLocation: 'Pegadaian Jakarta Pusat',
          ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
          ownerApproved: true,
          warehouseName: 'Vault Utama PT TAN (Akun 1157)',
          status: 'IN TRANSIT (DIAMBIL KURIR DI PEGADAIAN JAKARTA)',
          isVaultReceived: false,
          createdAt: new Date().toISOString()
        }
      ];
      setPurchases(stored);
    }
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
  const handleSubmit = (e) => {
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

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save Purchase Record
      const list = window.Storage.get('pttan_local_purchases') || [];
      list.unshift(newPurchase);
      window.Storage.set('pttan_local_purchases', list);

      // 2. Auto-Post Journal Entry TAHAP 1 (Debet 1159 Transit Emas Kurir vs Kredit Kas/Bank 1111/1110)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-PAY-${Date.now().toString().slice(-6)}`,
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
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      showModal({
        variant: 'success',
        title: isCash
          ? `✅ Tahap 1 Tersimpan — Pembayaran Tunai Rp ${totalAmount.toLocaleString()}`
          : '✅ Pembelian Kredit Tempo Tersimpan',
        message: isCash
          ? `• Jurnal Tahap 1: Debet Akun 1159 (Emas Dalam Perjalanan Kurir) vs Kredit ${creditAccountName}\n• Kurir (${newPurchase.courierName}) ditugaskan ambil emas di Pegadaian Jakarta.\n• Catatan: Persediaan Vault Utama (1157) BELUM DIDEBET sampai kurir tiba membawa fisik emas ke kantor PT TAN!`
          : `Nomor PO: ${newPurchase.poNumber}\nStatus Pembayaran: 🔴 UNPAID (Siap dibayar via BBK di Voucher Kasir)`
      });
      loadInitialData();
    }
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

  const postVaultArrival = (purchase) => {
    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Update Purchase Record Status
      const list = window.Storage.get('pttan_local_purchases') || [];
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
      window.Storage.set('pttan_local_purchases', updatedList);

      // 2. Auto-Post Journal Entry TAHAP 2 (Debet 1157 Vault Utama vs Kredit 1159 Transit Emas Kurir)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-VAULT-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        description: `[TAHAP 2] Serah Terima Fisik Emas Ke Vault Utama (${purchase.receiptNo}) - Barang: ${purchase.itemName} (${purchase.quantityGrams}g) | Debet: Akun 1157 (Vault Utama) | Kredit: Akun 1159 (Transit Kurir ${purchase.courierName})`,
        lines: [
          { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Lokal - Vault Utama)', debit: purchase.totalAmount, credit: 0 },
          { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan Kurir (Transit)', debit: 0, credit: purchase.totalAmount }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      showModal({
        variant: 'success',
        title: '🎉 Tahap 2 Sukses — Physical Stock In Vault',
        message: `• Debet Akun 1157 (Vault Utama) +${purchase.quantityGrams}g berhasil!\n• Kredit Akun 1159 (Transit Kurir) ditutup Rp ${purchase.totalAmount.toLocaleString()}\n• Dokumen TTB resmi diverifikasi 4 TTD.`
      });
      loadInitialData();
    }
  };

  return (
    <div>
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <ShoppingCart color="#f59e0b" size={24} /> Pembelian Emas Lokal (Direct Cash Pegadaian Jakarta)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Alur 2 Tahap Akuntansi SAK EMKM: Transit Kurir (Akun 1159) ➔ Penerimaan Fisik Vault Utama (Akun 1157)
            </p>
          </div>

          {/* Mode Transaksi Selector */}
          <div className="flex gap-2 bg-[rgba(15,23,42,0.8)] p-1.5 rounded-[10px] border border-line">
            <button
              className={`btn-primary text-[0.85rem] ${
                paymentMode === 'cash'
                  ? 'bg-linear-135 from-emerald to-emerald-dark text-white'
                  : 'bg-none bg-transparent text-fg-soft'
              }`}
              onClick={() => setPaymentMode('cash')}
            >
              <Wallet size={16} /> 💵 Tunai Direct (Alur 2-Tahap Transit 1159 ➔ Vault 1157)
            </button>
            <button
              className={`btn-primary text-[0.85rem] ${
                paymentMode === 'credit'
                  ? 'bg-linear-135 from-sky to-sky-dark text-white'
                  : 'bg-none bg-transparent text-fg-soft'
              }`}
              onClick={() => setPaymentMode('credit')}
            >
              <FileText size={16} /> 📝 Pembelian Tempo (Memakai PO)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Mode Indicator Banner */}
            <div
              className={`col-span-2 flex items-center gap-3 rounded-sm border px-4 py-3 ${
                paymentMode === 'cash'
                  ? 'border-emerald bg-emerald/10'
                  : 'border-sky bg-sky/10'
              }`}
            >
              {paymentMode === 'cash' ? (
                <>
                  <ArrowRightLeft color="#10b981" size={26} />
                  <div>
                    <strong className="text-emerald-light text-[0.95rem]">Alur 2-Tahap Akuntansi & Kontrol Fisik Brankas PT TAN</strong>
                    <p className="text-[0.8rem] text-fg-soft m-0">
                      <strong>• Tahap 1 (Saat Transfer Bayar)</strong>: Debet `1159` (Emas Dalam Perjalanan Kurir) vs Kredit Kas/Bank (`1111`).<br/>
                      <strong>• Tahap 2 (Saat Emas Tiba di Brankas)</strong>: Klik Konfirmasi Vault ➔ Debet `1157` (Vault Utama) vs Kredit `1159` (Transit Kurir).
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileText color="#0284c7" size={24} />
                  <div>
                    <strong className="text-sky-light text-[0.95rem]">Mode Pembelian Kredit Supplier (Purchase Order PO)</strong>
                    <p className="text-[0.8rem] text-fg-soft m-0">
                      Untuk transaksi pembelian dengan perjanjian tempo/kredit. Meng-generate PO dan mencatat ke Hutang Usaha (Akun 2110).
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{paymentMode === 'cash' ? 'No. Nota / Kuitansi Pegadaian (Kwitansi)' : 'No. PO Pembelian'}</label>
              <input
                className="form-input font-bold text-gold-light"
                value={formData.receiptNo}
                onChange={e => setFormData({ ...formData, receiptNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tgl Transaksi / Ambil Emas</label>
              <input
                type="date"
                className="form-input"
                value={formData.orderDate}
                onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier / Tempat Beli Emas</label>
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
            <div className="form-group col-span-2 bg-[rgba(245,158,11,0.1)] py-2.5 px-3.5 rounded-sm border border-gold">
              <label className="form-label text-gold-light font-bold flex items-center gap-2">
                <Box size={18} /> Pilih Produk Dari Master Kode Barang Emas:
              </label>
              <Combobox className="bg-ink text-gold-light font-bold text-[0.95rem]"
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
            <div className="form-group">
              <label className="form-label text-sky-light font-bold">Nama Kurir / Petugas Pengambil Emas</label>
              <input
                className="form-input border border-sky-light text-sky-light font-bold"
                placeholder="Misal: Bpk. Budi (Kurir Khusus)"
                value={formData.courierName}
                onChange={e => setFormData({ ...formData, courierName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">No. Surat Tugas / Surat Kuasa Kurir</label>
              <input
                className="form-input"
                placeholder="No. Surat Kuasa Ambil Emas..."
                value={formData.courierDocNo}
                onChange={e => setFormData({ ...formData, courierDocNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Lokasi Pengambilan Emas (Cabang Pegadaian)</label>
              <input
                className="form-input"
                placeholder="Misal: Pegadaian Cabang Jakarta Pusat..."
                value={formData.pickupLocation}
                onChange={e => setFormData({ ...formData, pickupLocation: e.target.value })}
              />
            </div>

            {/* Sumber Pembayaran Kas / Bank jika Mode Tunai */}
            {paymentMode === 'cash' ? (
              <div className="form-group">
                <label className="form-label text-emerald-light font-bold">Sumber Pembayaran Tunai (Kas / Bank)</label>
                <select
                  className="form-select border border-emerald text-emerald-light font-bold"
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
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Tipe Pembayaran</label>
                <input className="form-input" disabled value="Kredit Tempo / Utang Supplier (Akun 2110)" />
              </div>
            )}

            {/* OTORISASI & NAMA PEMILIK / DIREKTUR */}
            <div className="form-group">
              <label className="form-label text-gold-light font-bold">Otorisasi TTD Pemilik / Direktur Utama</label>
              <input
                className="form-input border border-gold text-gold-light font-bold"
                placeholder="Nama Pemilik / Direktur Utama..."
                value={formData.ownerApprovedBy}
                onChange={e => setFormData({ ...formData, ownerApprovedBy: e.target.value })}
              />
            </div>

            {/* INPUT BANYAK NOMOR SERTIFIKAT / MULTI BAR SERIALS */}
            <div className="form-group col-span-2">
              <div className="flex justify-between items-center mb-1.5">
                <label className="form-label text-sky-light font-bold m-0 flex items-center gap-1.5">
                  <Layers size={16} /> Multi No. Sertifikat / Nomor Seri Batangan (Pisahkan Dengan Koma / Enter):
                </label>
                {detectedBarCount > 0 && (
                  <span className="badge badge-emerald text-xs font-bold">
                    📦 {detectedBarCount} Batang Bar Terdeteksi
                  </span>
                )}
              </div>
              <textarea
                className="form-input"
                rows={2}
                className="form-input border border-sky-light font-mono text-[0.85rem] text-white"
                placeholder="Contoh: CERT-PEG-001, CERT-PEG-002, CERT-PEG-003, CERT-PEG-004..."
                value={formData.barCertificateNo}
                onChange={e => setFormData({ ...formData, barCertificateNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Berat Fisik Emas (Gram)</label>
              <NumberInput
                allowDecimal
                className="border border-gold text-gold-light font-bold"
                value={formData.quantityGrams}
                onChange={quantityGrams => setFormData({ ...formData, quantityGrams })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Harga Beli Tunai IDR / Gram</label>
              <NumberInput
                value={formData.unitPriceIDR}
                onChange={unitPriceIDR => setFormData({ ...formData, unitPriceIDR })}
              />
            </div>

            {/* CHECKBOX OTORISASI PEMILIK */}
            <div className="form-group col-span-2 bg-[rgba(245,158,11,0.1)] py-2.5 px-3.5 rounded-sm border border-gold">
              <label className="flex items-center gap-2.5 text-gold-light font-bold cursor-pointer">
                <input className="w-4.5 h-4.5 accent-gold"
                  type="checkbox"
                  checked={formData.ownerApproved}
                  onChange={e => setFormData({ ...formData, ownerApproved: e.target.checked })}
                />
                ✍️ Konfirmasi Persetujuan Pembelian Tunai & Siap Di-TTD Oleh Pemilik ({formData.ownerApprovedBy})
              </label>
            </div>
          </div>

          <div className="bg-[rgba(15,23,42,0.6)] p-4 rounded-[10px] my-4 mx-0 border border-[rgba(245,158,11,0.2)]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <div>
                <span className="stat-lbl">Total Pembelian IDR</span>
                <div className="font-extrabold text-gold-light text-[1.3rem]">Rp {totalAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Jurnal Tahap 1 (Transfer Bayar)</span>
                <div className="font-bold text-sky-light text-[0.85rem]">
                  Debet: Akun 1159 (Transit Kurir {formData.courierName})<br/>
                  Kredit: {paymentMode === 'cash' ? formData.paymentSourceAccountName : 'Akun 2111 (Hutang Usaha)'}
                </div>
              </div>
              <div>
                <span className="stat-lbl">Jurnal Tahap 2 (Tiba Di Brankas)</span>
                <div className="font-bold text-emerald-light text-[0.85rem]">
                  Debet: Akun 1157 (Vault Utama PT TAN)<br/>
                  Kredit: Akun 1159 (Transit Kurir Closed)
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={`btn-primary w-full justify-center p-3 bg-linear-135 ${
              paymentMode === 'cash'
                ? 'from-emerald to-emerald-dark'
                : 'from-sky to-sky-dark'
            }`}
          >
            {paymentMode === 'cash' ? (
              <>
                <CheckCircle size={18} /> Simpan Pembelian Tunai & Penugasan Kurir (Post Jurnal Tahap 1: Debet 1159 Transit)
              </>
            ) : (
              <>
                <Plus size={18} /> Terbitkan PO & Catat Pembelian Emas Kredit (Hutang 2111)
              </>
            )}
          </button>
        </form>
      </div>

      {/* History Table */}
      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4">
          📋 Riwayat Pembelian Emas Lokal ({purchases.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Nota / PO</th>
                <th>Status Tahap Transit / Vault</th>
                <th>Supplier & Lokasi Ambil</th>
                <th>Kurir Pengambil</th>
                <th>Barang Master & Multi-No Seri Bar</th>
                <th>Berat Gram</th>
                <th className="text-right">Total Valuasi (IDR)</th>
                <th>Status Pembayaran (Cicilan)</th>
                <th>Otorisasi Pemilik</th>
                <th>Aksi Verifikasi & Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td className="text-center text-fg-muted p-7.5" colSpan="10">
                    Belum ada riwayat pembelian Emas Lokal.
                  </td>
                </tr>
              ) : (
                purchases.map(p => {
                  const certList = (p.barCertificateNo || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                  const isReceived = p.isVaultReceived || p.status?.includes('RECEIVED & STOCKED');
                  const totalAmt = Number(p.totalAmount || 0);
                  const isCash = p.paymentMode === 'cash';
                  const paidIDR = Number(p.paidAmountIDR || (isCash ? totalAmt : 0));
                  const remainingIDR = typeof p.remainingBalanceIDR !== 'undefined' ? Number(p.remainingBalanceIDR) : Math.max(0, totalAmt - paidIDR);

                  let paymentBadge = (
                    <span className="badge badge-rose">
                      🔴 UNPAID
                    </span>
                  );
                  if (paidIDR >= totalAmt && totalAmt > 0) {
                    paymentBadge = (
                      <span className="badge badge-emerald">
                        🟢 LUNAS {isCash ? '(TUNAI DIRECT)' : '(PAID)'}
                      </span>
                    );
                  } else if (paidIDR > 0 && remainingIDR > 0) {
                    paymentBadge = (
                      <span className="badge badge-gold text-xs">
                        🟡 DICICIL<br/>
                        <small className="font-bold">Bayar: Rp {paidIDR.toLocaleString()} | Sisa: Rp {remainingIDR.toLocaleString()}</small>
                      </span>
                    );
                  }

                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.receiptNo || p.poNumber}</strong>
                      </td>
                      <td>
                        {isReceived ? (
                          <span className="badge badge-emerald text-xs font-bold">
                            ✅ VAULT STOCKED (1157)
                          </span>
                        ) : (
                          <span className="badge badge-gold text-xs font-bold bg-[rgba(245,158,11,0.2)] border border-gold">
                            🚚 IN TRANSIT KURIR (1159)
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{p.supplierName}</strong><br/>
                        <small className="text-fg-muted"><MapPin className="inline" size={10} /> {p.pickupLocation || 'Jakarta'}</small>
                      </td>
                      <td>
                        <span className="badge badge-emerald text-xs">
                          <Truck className="inline mr-1" size={12} />
                          {p.courierName || 'Kurir Internal'}
                        </span>
                      </td>
                      <td>
                        <strong>{p.itemName}</strong><br/>
                        <small className="text-gold-light">Kode: {p.itemCode}</small>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {certList.map((cert, idx) => (
                            <span key={idx} className="badge badge-emerald text-[0.7rem]">
                              #{idx + 1}: {cert}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="font-extrabold text-gold-light">{p.quantityGrams} g</td>
                      <td className="text-right font-bold text-emerald-light">Rp {totalAmt.toLocaleString()}</td>
                      <td>{paymentBadge}</td>
                      <td>
                        <span className="badge badge-gold text-xs">
                          <UserCheck className="inline mr-1" size={12} />
                          {p.ownerApprovedBy || 'Pemilik PT TAN'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1.5">
                          {!isReceived && (
                            <button
                              className="btn-primary py-1.5 px-2.5 text-xs bg-[linear-gradient(135deg,_#10b981,_#059669)] border border-emerald-light"
                              onClick={() => handleConfirmVaultArrival(p)}
                            >
                              <Box size={13} /> 📦 Konfirmasi Tiba Di Vault (Debet 1157)
                            </button>
                          )}
                          <div className="flex gap-1.5 flex-wrap">
                            <button
                              className="btn-primary py-1.5 px-2.5 text-xs bg-[rgba(56,189,248,0.2)] border border-sky-light text-sky-light"
                              onClick={() => setSelectedPOHistory(p)}
                            >
                              <History size={13} /> Riwayat Cicilan
                            </button>
                            <button
                              className="btn-primary py-1.5 px-2.5 text-xs bg-[linear-gradient(135deg,_#0284c7,_#0369a1)]"
                              onClick={() => showModal({
                                variant: 'info',
                                title: `📱 Dispatch WhatsApp PDF (${p.receiptNo || p.poNumber})`,
                                message: `Mengirimkan PDF Surat Kuasa Ambil Emas resmi & Kuitansi Lunas ke WhatsApp Kurir (${p.courierName}) & Kasir ${p.supplierName} Jakarta.\nDokumen dapat langsung di-print di Pegadaian Jakarta.`
                              })}
                            >
                              <Share2 size={13} /> WA PDF
                            </button>
                            <button
                              className="btn-primary py-1.5 px-2.5 text-xs"
                              onClick={() => showModal({
                                variant: 'info',
                                title: `🖨️ Cetak Bukti Serah Terima Vault (${p.receiptNo || p.poNumber})`,
                                message: `Barang: ${p.itemName} (${p.itemCode})\nJurnal Status: ${isReceived ? 'Tahap 2 Selesai (Debet 1157 Vault)' : 'Tahap 1 (Debet 1159 Transit Kurir)'}\nStatus Pembayaran: ${paidIDR >= totalAmt && totalAmt > 0 ? '🟢 LUNAS' : paidIDR > 0 ? `🟡 DICICIL (Sisa Rp ${remainingIDR.toLocaleString()})` : '🔴 BELUM BAYAR'}\n\nLengkap dengan 4 kolom tanda tangan fisik:\n1. Kurir Pengambil: ${p.courierName || 'Bpk Budi'} (No. ${p.courierDocNo || 'SK-KURIR-01'})\n2. Yang Menyerahkan: ${p.supplierName} (${p.pickupLocation || 'Jakarta'})\n3. Penerima Vault: Petugas Brankas PT TAN (Vault 1157)\n4. Disetujui & TTD Pemilik: ${p.ownerApprovedBy || 'Pemilik PT TAN'}`
                              })}
                            >
                              <Printer size={13} /> Cetak (4 TTD)
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL POPUP RIWAYAT CICILAN PEMBAYARAN PO LOKAL (AUDIT TRAIL) */}
      {selectedPOHistory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-5">
          <div className="glass-panel w-full max-w-[650px] p-6 bg-[#0f172a] border border-gold">
            <div className="flex justify-between items-center mb-4 border-b border-line pb-3">
              <h3 className="font-heading text-[1.2rem] text-gold-light flex items-center gap-2">
                <History size={20} /> Log Riwayat Pembayaran BBK / Kas (Audit Trail)
              </h3>
              <button
                className="btn-primary py-1 px-2.5 text-xs bg-rose/20 border border-rose text-rose cursor-pointer"
                onClick={() => setSelectedPOHistory(null)}
              >
                ✕ Tutup
              </button>
            </div>

            <div className="bg-white/3 p-3.5 rounded-lg mb-4 border border-line">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <span className="stat-lbl">No. Transaksi / PO</span>
                  <strong className="text-sky-light">{selectedPOHistory.receiptNo || selectedPOHistory.poNumber}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Supplier</span>
                  <strong>{selectedPOHistory.supplierName}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Total Tagihan Pokok</span>
                  <strong className="text-fg">
                    Rp {Number(selectedPOHistory.totalAmount || 0).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="stat-lbl">Sisa Hutang Pokok</span>
                  <strong className="text-gold-light">
                    Rp {(typeof selectedPOHistory.remainingBalanceIDR !== 'undefined' ? selectedPOHistory.remainingBalanceIDR : Math.max(0, Number(selectedPOHistory.totalAmount || 0) - Number(selectedPOHistory.paidAmountIDR || 0))).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <h4 className="text-[0.9rem] text-sky-light mb-2.5 flex items-center justify-between">
              <span>📋 Rincian Transaksi Voucher Pembayaran yang Diterbitkan:</span>
              <span className="text-xs text-fg-muted">
                {selectedPOHistory.paymentHistory?.length || 0} Voucher Diterbitkan
              </span>
            </h4>

            {(!selectedPOHistory.paymentHistory || selectedPOHistory.paymentHistory.length === 0) ? (
              <div className="p-6 text-center text-fg-muted bg-[rgba(15,23,42,0.6)] rounded-lg">
                <AlertCircle size={28} className="text-rose mx-auto mb-2" />
                Belum ada transaksi pembayaran (BBK/BKK) untuk transaksi ini. (Status: 🔴 UNPAID)
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>No. Voucher / Ref</th>
                      <th>Tanggal Bayar</th>
                      <th>Kategori Alokasi</th>
                      <th>Penerima (Payee)</th>
                      <th>Akun Bank / Sumber</th>
                      <th className="text-right">Nominal (IDR)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPOHistory.paymentHistory.map((pmt, i) => (
                      <tr key={i}>
                        <td><strong className="text-sky-light">{pmt.voucherNo}</strong></td>
                        <td>{pmt.date}</td>
                        <td>
                          <span className={`badge text-xs ${
                            pmt.category === 'CUSTOMS_DUTY_PPH22'
                              ? 'bg-sky-950/80 text-sky-300 border border-sky-600/50'
                              : pmt.category === 'LOGISTICS_HANDLING'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                              : pmt.category === 'OTHER_EXPENSE'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50'
                              : 'bg-amber-950/80 text-gold-light border border-gold/50'
                          }`}>
                            {pmt.categoryLabel || (pmt.category === 'CUSTOMS_DUTY_PPH22' ? '🏛️ Pajak PPh 22' : pmt.category === 'LOGISTICS_HANDLING' ? '🚚 Logistik' : '💰 Pokok Supplier')}
                          </span>
                        </td>
                        <td><small className="font-semibold text-fg">{pmt.payee || selectedPOHistory.supplierName}</small></td>
                        <td><small>{pmt.bank || 'Bank BCA IDR'}</small></td>
                        <td className="text-right font-extrabold text-emerald-light">
                          Rp {Number(pmt.amount || 0).toLocaleString()}
                        </td>
                        <td><span className="badge badge-emerald">✅ POSTED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                className="btn-primary"
                onClick={() => setSelectedPOHistory(null)}
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
