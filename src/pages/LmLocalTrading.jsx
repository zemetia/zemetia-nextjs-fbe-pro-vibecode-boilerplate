import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer, CheckCircle, Package, DollarSign, Wallet, ShieldCheck, FileText, Layers, CheckSquare, UserCheck, Truck, MapPin, Send, Share2, Box, ArrowRightLeft } from 'lucide-react';
import { getMasterItems } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function LmLocalTrading() {
  const { modalProps, showModal } = useModal();
  const [purchases, setPurchases] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' (Direct Tunai Pegadaian) or 'credit' (Tempo PO)

  const [formData, setFormData] = useState({
    receiptNo: 'KW-PEG-2026-001',
    supplierName: 'PT Pegadaian (Persero)',
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
          supplierName: 'PT Pegadaian (Persero)',
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
  const handleItemSelect = (e) => {
    const selectedCode = e.target.value;
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
    const creditAccount = isCash ? formData.paymentSourceAccount : '2110';
    const creditAccountName = isCash
      ? formData.paymentSourceAccountName
      : 'Hutang Usaha Supplier Lokal (Akun 2110)';

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
          : `Pembelian LM Kredit PO (${newPurchase.poNumber}) - ${formData.supplierName}`,
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
          : `Nomor PO: ${newPurchase.poNumber}`
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
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart color="#f59e0b" size={24} /> Pembelian Emas Lokal (Direct Cash Pegadaian Jakarta)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Alur 2 Tahap Akuntansi SAK EMKM: Transit Kurir (Akun 1159) ➔ Penerimaan Fisik Vault Utama (Akun 1157)
            </p>
          </div>

          {/* Mode Transaksi Selector */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.8)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              className="btn-primary"
              style={{
                background: paymentMode === 'cash' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: paymentMode === 'cash' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}
              onClick={() => setPaymentMode('cash')}
            >
              <Wallet size={16} /> 💵 Tunai Direct (Alur 2-Tahap Transit 1159 ➔ Vault 1157)
            </button>
            <button
              className="btn-primary"
              style={{
                background: paymentMode === 'credit' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                color: paymentMode === 'credit' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}
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
              style={{
                gridColumn: 'span 2',
                background: paymentMode === 'cash' ? 'rgba(16,185,129,0.1)' : 'rgba(2,132,199,0.1)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: paymentMode === 'cash' ? '1px solid #10b981' : '1px solid #0284c7',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {paymentMode === 'cash' ? (
                <>
                  <ArrowRightLeft color="#10b981" size={26} />
                  <div>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>Alur 2-Tahap Akuntansi & Kontrol Fisik Brankas PT TAN</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      <strong>• Tahap 1 (Saat Transfer Bayar)</strong>: Debet `1159` (Emas Dalam Perjalanan Kurir) vs Kredit Kas/Bank (`1111`).<br/>
                      <strong>• Tahap 2 (Saat Emas Tiba di Brankas)</strong>: Klik Konfirmasi Vault ➔ Debet `1157` (Vault Utama) vs Kredit `1159` (Transit Kurir).
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileText color="#0284c7" size={24} />
                  <div>
                    <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>Mode Pembelian Kredit Supplier (Purchase Order PO)</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Untuk transaksi pembelian dengan perjanjian tempo/kredit. Meng-generate PO dan mencatat ke Hutang Usaha (Akun 2110).
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{paymentMode === 'cash' ? 'No. Nota / Kuitansi Pegadaian (Kwitansi)' : 'No. PO Pembelian'}</label>
              <input
                className="form-input"
                style={{ fontWeight: 700, color: '#fbbf24' }}
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
              <select
                className="form-select"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              >
                <option value="PT Pegadaian (Persero) Jakarta">PT Pegadaian (Persero) Jakarta</option>
                <option value="PT Antam Tbk (UBPP LM Jakarta)">PT Antam Tbk (UBPP LM Jakarta)</option>
                <option value="PT UBS Fine Gold (Surabaya)">PT UBS Fine Gold</option>
                <option value="Toko Emas & Bullion Dealer Jakarta">Toko Emas & Bullion Dealer Jakarta</option>
              </select>
            </div>

            {/* SELEKSI BARANG DARI MASTER DATA BARANG */}
            <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(245,158,11,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box size={18} /> Pilih Produk Dari Master Kode Barang Emas:
              </label>
              <select
                className="form-select"
                style={{ background: '#0f172a', color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem' }}
                value={formData.itemCode}
                onChange={handleItemSelect}
              >
                <option value="">-- (Pilih Barang Emas Dari Master Katalog PT TAN) --</option>
                {masterItemsList.map(item => (
                  <option key={item.code || item.id} value={item.code || item.id}>
                    [{item.code}] {item.name} ({item.category || 'Emas Murni'} - {item.purity || 99.99}%)
                  </option>
                ))}
              </select>
            </div>

            {/* INFORMASI KURIR PENGAMBIL EMAS */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>Nama Kurir / Petugas Pengambil Emas</label>
              <input
                className="form-input"
                style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
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
                <label className="form-label" style={{ color: '#34d399', fontWeight: 700 }}>Sumber Pembayaran Tunai (Kas / Bank)</label>
                <select
                  className="form-select"
                  style={{ border: '1px solid #10b981', color: '#34d399', fontWeight: 700 }}
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
              <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700 }}>Otorisasi TTD Pemilik / Direktur Utama</label>
              <input
                className="form-input"
                style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                placeholder="Nama Pemilik / Direktur Utama..."
                value={formData.ownerApprovedBy}
                onChange={e => setFormData({ ...formData, ownerApprovedBy: e.target.value })}
              />
            </div>

            {/* INPUT BANYAK NOMOR SERTIFIKAT / MULTI BAR SERIALS */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} /> Multi No. Sertifikat / Nomor Seri Batangan (Pisahkan Dengan Koma / Enter):
                </label>
                {detectedBarCount > 0 && (
                  <span className="badge badge-emerald" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    📦 {detectedBarCount} Batang Bar Terdeteksi
                  </span>
                )}
              </div>
              <textarea
                className="form-input"
                rows={2}
                style={{ border: '1px solid #38bdf8', color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem' }}
                placeholder="Contoh: CERT-PEG-001, CERT-PEG-002, CERT-PEG-003, CERT-PEG-004..."
                value={formData.barCertificateNo}
                onChange={e => setFormData({ ...formData, barCertificateNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Berat Fisik Emas (Gram)</label>
              <input
                type="number"
                className="form-input"
                style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                value={formData.quantityGrams}
                onChange={e => setFormData({ ...formData, quantityGrams: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Harga Beli Tunai IDR / Gram</label>
              <input
                type="number"
                className="form-input"
                value={formData.unitPriceIDR}
                onChange={e => setFormData({ ...formData, unitPriceIDR: Number(e.target.value) })}
              />
            </div>

            {/* CHECKBOX OTORISASI PEMILIK */}
            <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(245,158,11,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                  checked={formData.ownerApproved}
                  onChange={e => setFormData({ ...formData, ownerApproved: e.target.checked })}
                />
                ✍️ Konfirmasi Persetujuan Pembelian Tunai & Siap Di-TTD Oleh Pemilik ({formData.ownerApprovedBy})
              </label>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span className="stat-lbl">Total Pembelian IDR</span>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.3rem' }}>Rp {totalAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Jurnal Tahap 1 (Transfer Bayar)</span>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                  Debet: Akun 1159 (Transit Kurir {formData.courierName})<br/>
                  Kredit: {paymentMode === 'cash' ? formData.paymentSourceAccountName : 'Akun 2110 (Utang)'}
                </div>
              </div>
              <div>
                <span className="stat-lbl">Jurnal Tahap 2 (Tiba Di Brankas)</span>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.85rem' }}>
                  Debet: Akun 1157 (Vault Utama PT TAN)<br/>
                  Kredit: Akun 1159 (Transit Kurir Closed)
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              background: paymentMode === 'cash' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
              width: '100%',
              justifyContent: 'center',
              padding: '12px'
            }}
          >
            {paymentMode === 'cash' ? (
              <>
                <CheckCircle size={18} /> Simpan Pembelian Tunai & Penugasan Kurir (Post Jurnal Tahap 1: Debet 1159 Transit)
              </>
            ) : (
              <>
                <Plus size={18} /> Terbitkan PO & Catat Pembelian Emas Kredit
              </>
            )}
          </button>
        </form>
      </div>

      {/* History Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
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
                <th style={{ textAlign: 'right' }}>Total Valuasi (IDR)</th>
                <th>Otorisasi Pemilik</th>
                <th>Aksi Verifikasi & Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada riwayat pembelian Emas Lokal.
                  </td>
                </tr>
              ) : (
                purchases.map(p => {
                  const certList = (p.barCertificateNo || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                  const isReceived = p.isVaultReceived || p.status?.includes('RECEIVED & STOCKED');
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.receiptNo || p.poNumber}</strong>
                      </td>
                      <td>
                        {isReceived ? (
                          <span className="badge badge-emerald" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            ✅ VAULT STOCKED (1157)
                          </span>
                        ) : (
                          <span className="badge badge-gold" style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b' }}>
                            🚚 IN TRANSIT KURIR (1159)
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{p.supplierName}</strong><br/>
                        <small style={{ color: 'var(--text-muted)' }}><MapPin size={10} style={{ display: 'inline' }} /> {p.pickupLocation || 'Jakarta'}</small>
                      </td>
                      <td>
                        <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                          <Truck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {p.courierName || 'Kurir Internal'}
                        </span>
                      </td>
                      <td>
                        <strong>{p.itemName}</strong><br/>
                        <small style={{ color: '#fbbf24' }}>Kode: {p.itemCode}</small>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {certList.map((cert, idx) => (
                            <span key={idx} className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                              #{idx + 1}: {cert}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, color: '#fbbf24' }}>{p.quantityGrams} g</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>Rp {(p.totalAmount || 0).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                          <UserCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {p.ownerApprovedBy || 'Pemilik PT TAN'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {!isReceived && (
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: '1px solid #34d399' }}
                              onClick={() => handleConfirmVaultArrival(p)}
                            >
                              <Box size={13} /> 📦 Konfirmasi Tiba Di Vault (Debet 1157)
                            </button>
                          )}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                              onClick={() => showModal({
                                variant: 'info',
                                title: `📱 Dispatch WhatsApp PDF (${p.receiptNo})`,
                                message: `Mengirimkan PDF Surat Kuasa Ambil Emas resmi & Kuitansi Lunas ke WhatsApp Kurir (${p.courierName}) & Kasir ${p.supplierName} Jakarta.\nDokumen dapat langsung di-print di Pegadaian Jakarta.`
                              })}
                            >
                              <Share2 size={13} /> WA PDF
                            </button>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => showModal({
                                variant: 'info',
                                title: `🖨️ Cetak Bukti Serah Terima Vault (${p.receiptNo || p.poNumber})`,
                                message: `Barang: ${p.itemName} (${p.itemCode})\nJurnal Status: ${isReceived ? 'Tahap 2 Selesai (Debet 1157 Vault)' : 'Tahap 1 (Debet 1159 Transit Kurir)'}\n\nLengkap dengan 4 kolom tanda tangan fisik:\n1. Kurir Pengambil: ${p.courierName || 'Bpk Budi'} (No. ${p.courierDocNo || 'SK-KURIR-01'})\n2. Yang Menyerahkan: ${p.supplierName} (${p.pickupLocation || 'Jakarta'})\n3. Penerima Vault: Petugas Brankas PT TAN (Vault 1157)\n4. Disetujui & TTD Pemilik: ${p.ownerApprovedBy || 'Pemilik PT TAN'}`
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

      <Modal {...modalProps} />
    </div>
  );
}
