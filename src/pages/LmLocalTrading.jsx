import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer, CheckCircle, Package, DollarSign, Wallet, ShieldCheck, FileText } from 'lucide-react';
import { getMasterItems } from '../services/storageService';

export default function LmLocalTrading() {
  const [purchases, setPurchases] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' (Direct Tunai Pegadaian) or 'credit' (Tempo PO)

  const [formData, setFormData] = useState({
    receiptNo: 'KW-PEG-2026-001',
    supplierName: 'PT Pegadaian (Persero)',
    orderDate: new Date().toISOString().split('T')[0],
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan 999.9 (Antam/Pegadaian)',
    paymentSourceAccount: '1111', // '1110' Kas Utama, '1110-1' Kas Kecil, '1111' Bank BCA/Mandiri
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111)',
    quantityGrams: 1000,
    unitPriceIDR: 1350000, // Rp 1.350.000 / g
    barCertificateNo: 'CERT-PEG-998812',
    notes: 'Pembelian Emas Tunai Direct di Pegadaian (Tanpa PO / Lunas Seketika)'
  });

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = () => {
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
          itemCode: 'LM-ANTAM-1000G',
          itemName: 'Emas Batangan Antam 1kg (999.9)',
          quantityGrams: 1000,
          unitPriceIDR: 1350000,
          totalAmount: 1350000000,
          journalAccountDebit: '1157',
          journalAccountCredit: '1111',
          paymentSourceAccountName: 'Bank BCA IDR (Akun 1111)',
          barCertificateNo: 'CERT-PEG-998812',
          warehouseName: 'Vault Utama PT TAN (Akun 1157)',
          status: 'PAID & STOCKED IN VAULT',
          createdAt: new Date().toISOString()
        }
      ];
      setPurchases(stored);
    }
  };

  const totalAmount = formData.quantityGrams * formData.unitPriceIDR;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.quantityGrams || !formData.unitPriceIDR || !formData.receiptNo) {
      alert('Mohon lengkapi No Nota Kuitansi, Jumlah Gram, dan Harga Satuan.');
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
      warehouseName: 'Vault Utama PT TAN (Akun 1157)',
      status: isCash ? 'PAID & STOCKED IN VAULT' : 'RECEIVED (CREDIT TEMPO)',
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
          ? `Pembelian Emas Tunai Direct (${newPurchase.receiptNo}) - ${formData.supplierName} [Lunas via ${creditAccountName}]`
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
          ? `✅ Pembelian Emas Tunai Direct (${newPurchase.receiptNo}) Berhasil! Dibayar Lunas via ${creditAccountName}. Emas ${newPurchase.quantityGrams}g Langsung Masuk Ke Stok Vault Utama (Akun 1157)!`
          : `✅ Pembelian Kredit Tempo (${newPurchase.poNumber}) Berhasil Disimpan!`
      );
      loadPurchases();
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart color="#f59e0b" size={24} /> Pembelian Emas Lokal (Direct Cash Pegadaian / Antam)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Transaksi Pembelian Tunai Seketika Tanpa PO (Kas/Bank) Atau Pembelian Tempo PO Supplier
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
              <Wallet size={16} /> 💵 Pembelian Tunai Direct (Tanpa PO)
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
                  <Wallet color="#10b981" size={24} />
                  <div>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>Mode Pembelian Tunai Seketika (Over-The-Counter Cash Buy)</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Sangat cocok untuk pembelian langsung di <strong>PT Pegadaian / PT Antam / Toko Emas</strong>. Bayar tunai dari Kas/Bank & stok emas langsung masuk Vault (Akun 1157) tanpa perlu bikin PO/Hutang.
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
              <label className="form-label">Tgl Transaksi</label>
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
                <option value="PT Pegadaian (Persero)">PT Pegadaian (Persero)</option>
                <option value="PT Antam Tbk (Logam Mulia UBPP LM)">PT Antam Tbk (UBPP LM)</option>
                <option value="PT UBS Fine Gold (Surabaya)">PT UBS Fine Gold</option>
                <option value="Toko Emas & Bullion Dealer Lokal">Toko Emas & Bullion Dealer Lokal</option>
              </select>
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

            <div className="form-group">
              <label className="form-label">Pilihan Barang Emas Batangan / Granul</label>
              <select
                className="form-select"
                value={formData.itemCode}
                onChange={e => {
                  const code = e.target.value;
                  const name = code === 'LM-ANTAM-1000G' ? 'Emas Batangan Antam 1kg (999.9)' : code === 'LM-ANTAM-100G' ? 'Emas Batangan Antam 100g (999.9)' : code === 'LM-PEGADAIAN-1KG' ? 'Emas Batangan Pegadaian 1kg (999.9)' : 'Granul Emas Murni 999.9';
                  setFormData({ ...formData, itemCode: code, itemName: name });
                }}
              >
                <option value="LM-ANTAM-1000G">Emas Batangan Antam 1kg (999.9)</option>
                <option value="LM-PEGADAIAN-1KG">Emas Batangan Pegadaian 1kg (999.9)</option>
                <option value="LM-ANTAM-100G">Emas Batangan Antam 100g (999.9)</option>
                <option value="GOLD-GRANULE-9999">Granul Emas Murni 999.9</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">No. Sertifikat Emas / Seri Bar</label>
              <input
                className="form-input"
                placeholder="Nomor sertifikat Pegadaian/Antam..."
                value={formData.barCertificateNo}
                onChange={e => setFormData({ ...formData, barCertificateNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Berat Fisik Emas (Gram)</label>
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
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span className="stat-lbl">Total Pembelian IDR</span>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.3rem' }}>Rp {totalAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Posting Auto-Jurnal SAK</span>
                <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.85rem' }}>
                  Debet: Akun 1157 (Vault Utama)<br/>
                  Kredit: {paymentMode === 'cash' ? formData.paymentSourceAccountName : 'Akun 2110 (Utang Supplier)'}
                </div>
              </div>
              <div>
                <span className="stat-lbl">Penerimaan Stok Vault</span>
                <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>Vault Utama PT TAN (Akun 1157)</div>
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
                <CheckCircle size={18} /> Simpan Pembelian Emas Tunai Direct & Tambah Stok Vault Instan
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
                <th>Supplier / Beli Di</th>
                <th>Tanggal</th>
                <th>Item Barang & Sertifikat</th>
                <th>Berat Gram</th>
                <th style={{ textAlign: 'right' }}>Total Valuasi (IDR)</th>
                <th>Posting Auto-Jurnal</th>
                <th>Cetak Bukti</th>
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
                purchases.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.receiptNo || p.poNumber}</strong>
                    </td>
                    <td>
                      <span className={`badge ${p.paymentMode === 'cash' ? 'badge-emerald' : 'badge-gold'}`} style={{ fontSize: '0.75rem' }}>
                        {p.paymentMode === 'cash' ? '💵 TUNAI DIRECT' : '📝 KREDIT PO'}
                      </span>
                    </td>
                    <td><strong>{p.supplierName}</strong></td>
                    <td>{p.orderDate}</td>
                    <td>
                      {p.itemName}<br/>
                      <small style={{ color: '#38bdf8' }}>Cert: {p.barCertificateNo || 'CERT-PEG-998812'}</small>
                    </td>
                    <td style={{ fontWeight: 800, color: '#fbbf24' }}>{p.quantityGrams} g</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>Rp {(p.totalAmount || 0).toLocaleString()}</td>
                    <td>
                      <small style={{ color: '#34d399' }}>Dr 1157</small><br/>
                      <small style={{ color: '#38bdf8' }}>Cr {p.journalAccountCredit || '1111'}</small>
                    </td>
                    <td>
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => alert(`🖨️ Mencetak Bukti Pembelian Emas Tunai Direct / TTB (${p.receiptNo || p.poNumber}) untuk ${p.supplierName}...`)}>
                        <Printer size={14} /> Cetak Bukti
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
