import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer, CheckCircle, Package, DollarSign, Wallet, ShieldCheck, FileText, Layers, CheckSquare, UserCheck, Truck, MapPin, Send, Share2, Box } from 'lucide-react';
import { getMasterItems } from '../services/storageService';

export default function LmLocalTrading() {
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
    notes: 'Pembelian 3 Batang Emas 1kg Tunai Direct di Pegadaian Jakarta via Kurir Bpk Budi (4 TTD)'
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
          journalAccountDebit: '1157',
          journalAccountCredit: '1111',
          paymentSourceAccountName: 'Bank BCA IDR (Akun 1111)',
          barCertificateNo: 'CERT-PEG-998812, CERT-PEG-998813, CERT-PEG-998814',
          courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
          courierDocNo: 'SK-KURIR-2026-0801',
          pickupLocation: 'Pegadaian Jakarta Pusat',
          ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
          ownerApproved: true,
          warehouseName: 'Vault Utama PT TAN (Akun 1157)',
          status: 'PICKED UP BY COURIER & VAULT VERIFIED (4 TTD)',
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.quantityGrams || !formData.unitPriceIDR || !formData.receiptNo || !formData.courierName) {
      alert('Mohon lengkapi No Nota Kuitansi, Nama Kurir Pengambil, Jumlah Gram, dan Harga Satuan.');
      return;
    }

    if (!formData.ownerApproved) {
      alert('⚠️ Transaksi pembelian tunai wajib mendapatkan Persetujuan & TTD dari Pemilik / Direktur Utama.');
      return;
    }

    const isCash = paymentMode === 'cash';
    const creditAccount = isCash ? formData.paymentSourceAccount : '2110';
    const creditAccountName = isCash
      ? formData.paymentSourceAccountName
      : 'Hutang Usaha Supplier Lokal (Akun 2110)';

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
      journalAccountDebit: '1157', // Persediaan Emas Vault Utama
      journalAccountCredit: creditAccount,
      paymentSourceAccountName: creditAccountName,
      barCertificateNo: formData.barCertificateNo,
      barCountDetected: detectedBarCount,
      courierName: formData.courierName,
      courierDocNo: formData.courierDocNo,
      pickupLocation: formData.pickupLocation,
      ownerApprovedBy: formData.ownerApprovedBy,
      ownerApproved: true,
      warehouseName: 'Vault Utama PT TAN (Akun 1157)',
      status: isCash ? 'PICKED UP BY COURIER & VAULT VERIFIED (4 TTD)' : 'RECEIVED (CREDIT TEMPO)',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save Purchase Record
      const list = window.Storage.get('pttan_local_purchases') || [];
      list.unshift(newPurchase);
      window.Storage.set('pttan_local_purchases', list);

      // 2. Auto-Post Journal Entry (Debet 1157 Persediaan vs Kredit Kas/Bank atau Hutang)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-BUY-${Date.now().toString().slice(-6)}`,
        date: formData.orderDate,
        description: isCash
          ? `Pembelian Emas Tunai Direct (${newPurchase.receiptNo}) - Barang: ${newPurchase.itemName} (${newPurchase.quantityGrams}g) | Kurir: ${newPurchase.courierName} | Otorisasi Pemilik: ${newPurchase.ownerApprovedBy}`
          : `Pembelian LM Kredit PO (${newPurchase.poNumber}) - ${formData.supplierName}`,
        lines: [
          { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (Vault Utama)', debit: totalAmount, credit: 0 },
          { accountCode: creditAccount, accountName: creditAccountName, debit: 0, credit: totalAmount }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      alert(
        isCash
          ? `✅ Pembelian Tunai Direct [Barang: ${newPurchase.itemName}] (${newPurchase.receiptNo}) Berhasil!\n• Disetujui Pemilik: ${newPurchase.ownerApprovedBy}\n• Kurir Pengambil: ${newPurchase.courierName}\n• Total Rp ${totalAmount.toLocaleString()} Ditransfer/Dipotong Dari ${creditAccountName}\n• Emas ${newPurchase.quantityGrams}g Langsung Masuk Vault Utama (1157)!`
          : `✅ Pembelian Kredit Tempo (${newPurchase.poNumber}) Berhasil Disimpan!`
      );
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
              Pembelian Tunai Instan Menggunakan Master Katalog Barang Emas, Pengambilan Kurir, & Otorisasi Pemilik
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
              <Wallet size={16} /> 💵 Tunai Direct (Tinggal Pilih Barang Master)
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
                  <Box color="#10b981" size={24} />
                  <div>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>Mode Pembelian Tunai Direct (Tinggal Pilih Dari Master Katalog Barang Emas)</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Pilih produk emas dari <strong>Master Katalog Barang</strong> (Pegadaian 1kg, Antam 1kg, 100g, Granul 999.9). Stok emas otomatis langsung bertambah ke Vault Utama (`1157`).
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
                <span className="stat-lbl">Barang Master Terpilih</span>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem' }}>
                  <Box size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {formData.itemName} ({formData.itemCode})
                </div>
              </div>
              <div>
                <span className="stat-lbl">Status Otorisasi TTD</span>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>
                  <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Disetujui Pemilik ({formData.ownerApprovedBy})
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
                <CheckCircle size={18} /> Simpan Pembelian Emas Tunai [{formData.itemName}] & Tambah Stok Vault
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
                <th>Mode Bayar</th>
                <th>Supplier & Lokasi Ambil</th>
                <th>Kurir Pengambil</th>
                <th>Barang Master & Multi-No Seri Bar</th>
                <th>Berat Gram</th>
                <th style={{ textAlign: 'right' }}>Total Valuasi (IDR)</th>
                <th>Otorisasi Pemilik</th>
                <th>Aksi Dokumen</th>
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
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.receiptNo || p.poNumber}</strong>
                      </td>
                      <td>
                        <span className={`badge ${p.paymentMode === 'cash' ? 'badge-emerald' : 'badge-gold'}`} style={{ fontSize: '0.75rem' }}>
                          {p.paymentMode === 'cash' ? '💵 TUNAI DIRECT' : '📝 KREDIT PO'}
                        </span>
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
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            onClick={() => alert(`📱 Membuka Dispatch WhatsApp PDF Surat Kuasa & Kuitansi Lunas (${p.receiptNo})\n--------------------------------------------------\nMengirimkan PDF Surat Kuasa Ambil Emas Resmi Ke WhatsApp Kurir (${p.courierName}) & Kasir ${p.supplierName} Jakarta!\nDokumen dapat langsung di-print di Pegadaian Jakarta.`)}
                          >
                            <Share2 size={13} /> WA PDF Kurir
                          </button>
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => alert(`🖨️ Mencetak Bukti Pembelian Emas Tunai Direct & Serah Terima Vault (${p.receiptNo || p.poNumber})\n--------------------------------------------------\nBarang: ${p.itemName} (${p.itemCode})\nLengkap Dengan 4 Kolom Tanda Tangan Fisik:\n1. Kurir Pengambil: ${p.courierName || 'Bpk Budi'} (No. ${p.courierDocNo || 'SK-KURIR-01'})\n2. Yang Menyerahkan: ${p.supplierName} (${p.pickupLocation || 'Jakarta'})\n3. Penerima Vault: Petugas Brankas PT TAN (Vault 1157)\n4. Disetujui & TTD Pemilik: ${p.ownerApprovedBy || 'Pemilik PT TAN'}`)}
                          >
                            <Printer size={13} /> Cetak (4 TTD)
                          </button>
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
    </div>
  );
}
