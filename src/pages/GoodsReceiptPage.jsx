import React, { useState, useEffect } from 'react';
import { PackageCheck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Warehouse, PlaneTakeoff, ShoppingCart } from 'lucide-react';
import { getPurchaseOrders, getSuppliers } from '../services/storageService';

export default function GoodsReceiptPage() {
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    grnNumber: 'GRN-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedPOId: '',
    supplierName: 'Valcambi SA Switzerland (Overseas Refiner)',
    supplierDoNumber: 'SJ-VALCAMBI-998811',
    targetVault: '1158', // Vault Impor (1158) or Vault Utama (1157) or Scrap (1152)
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
    barSerialNumbers: 'VAL-99120, VAL-99121, VAL-99122',
    assayCertificateNo: 'ASSAY-VAL-88912',
    receivedWeightGram: 1000,
    unitPriceIDRPerGram: 1350000,
    totalValueIDR: 1350000000,
    notes: 'Kondisi fisik emas dan segel Certificate Assay utuh 100%.'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    // 1. Purchase Orders & Suppliers
    const pos = getPurchaseOrders();
    setPurchaseOrders(pos);
    setSuppliers(getSuppliers());

    // 2. Goods Receipts
    if (typeof window !== 'undefined' && window.Storage) {
      const storedGRN = window.Storage.get('pttan_goods_receipts') || [
        {
          id: 'GRN-2026-001',
          grnNumber: 'GRN-2026-001',
          poNumber: 'PO-IMP-2026-001',
          date: '2026-08-10',
          supplierName: 'Valcambi SA Switzerland',
          supplierDoNumber: 'SJ-VAL-998811',
          targetVault: '1158',
          targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
          itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
          barSerialNumbers: 'VAL-99120, VAL-99121',
          assayCertificateNo: 'ASSAY-VAL-88912',
          receivedWeightGram: 1000,
          totalValueIDR: 1350000000,
          status: 'RECEIVED & VERIFIED'
        }
      ];
      setReceipts(storedGRN);
    }
  };

  // Handler Pull From Purchase Order (PO)
  const handlePOSelect = (e) => {
    const poId = e.target.value;
    const foundPO = purchaseOrders.find(p => (p.id === poId || p.poNumber === poId));
    if (foundPO) {
      const targetVault = foundPO.type === 'import' ? '1158' : '1157';
      const targetVaultName = foundPO.type === 'import' ? 'Vault Impor 999.9 (Akun 1158)' : 'Vault Utama LM 999.9 (Akun 1157)';

      setForm({
        ...form,
        selectedPOId: poId,
        supplierName: foundPO.supplierName || 'Gold Supplier',
        itemDescription: foundPO.itemDescription || 'Emas Batangan 999.9',
        targetVault,
        targetVaultName,
        receivedWeightGram: foundPO.weightGrams || 1000,
        unitPriceIDRPerGram: foundPO.pricePerGramIDR || 1350000,
        totalValueIDR: (foundPO.weightGrams || 1000) * (foundPO.pricePerGramIDR || 1350000)
      });
      alert(`✅ Penerimaan Barang Ditarik Otomatis Dari PO ${foundPO.poNumber}! Berat ${foundPO.weightGrams}g & Vault Tujuan ${targetVaultName} Terisi.`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.grnNumber || !form.supplierName || !form.receivedWeightGram) {
      alert('Mohon lengkapi No TTB/GRN, Supplier, dan Berat Emas Diterima.');
      return;
    }

    const newGRN = {
      id: form.grnNumber,
      poNumber: form.selectedPOId || 'PO-IMP-2026-001',
      ...form,
      status: 'RECEIVED & VERIFIED',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save Goods Receipt
      const list = window.Storage.get('pttan_goods_receipts') || [];
      list.unshift(newGRN);
      window.Storage.set('pttan_goods_receipts', list);

      // 2. Auto Posting EMKM Journal & Update Vault Inventory
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-GRN-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: `Penerimaan Emas Fisk (${newGRN.grnNumber}) Ref PO: ${form.selectedPOId} - ${newGRN.supplierName} [Vault: ${newGRN.targetVault}]`,
        lines: [
          { accountCode: form.targetVault, accountName: form.targetVaultName, debit: form.totalValueIDR, credit: 0 },
          { accountCode: '2110', accountName: 'Utang Usaha / Supplier Emas', debit: 0, credit: form.totalValueIDR }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      alert(`✅ Penerimaan Barang (TTB ${newGRN.grnNumber}) Berhasil Disimpan! Stok Vault ${form.targetVaultName} Bertambah ${newGRN.receivedWeightGram}g!`);
      loadInitialData();
      setActiveView('list');
    }
  };

  const filteredReceipts = receipts.filter(r =>
    r.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.poNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PackageCheck color="#34d399" size={24} /> Penerimaan Barang Vault (Goods Receipt Note - TTB)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Modul Berita Acara Penerimaan Fisik Emas, Penambahan Stok Vault Brankas, & Verifikasi Certificate Assay
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ background: activeView === 'list' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('list')}
            >
              <PackageCheck size={18} /> Register Penerimaan TTB
            </button>
            <button
              className="btn-primary"
              style={{ background: activeView === 'create' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Terima Barang Baru (TTB)
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE PENERIMAAN BARANG */}
      {activeView === 'list' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              📋 Daftar Tanda Terima Barang (TTB / Goods Receipt Note) ({filteredReceipts.length})
            </h3>

            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                placeholder="Cari TTB, PO, atau Supplier..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. TTB (GRN)</th>
                  <th>Ref No. PO</th>
                  <th>Tanggal Terima</th>
                  <th>Supplier Emas</th>
                  <th>Vault Tujuan</th>
                  <th>Deskripsi Emas</th>
                  <th>Berat Gram Diterima</th>
                  <th style={{ textAlign: 'right' }}>Total Valuasi IDR</th>
                  <th>Status Verifikasi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map(r => (
                  <tr key={r.id || r.grnNumber}>
                    <td><strong>{r.grnNumber}</strong></td>
                    <td><small style={{ color: '#fbbf24' }}>{r.poNumber}</small></td>
                    <td>{r.date}</td>
                    <td><strong>{r.supplierName}</strong></td>
                    <td><span className="badge badge-emerald">{r.targetVaultName || r.targetVault}</span></td>
                    <td>{r.itemDescription}</td>
                    <td style={{ fontWeight: 800, color: '#38bdf8' }}>{r.receivedWeightGram} g</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>Rp {(r.totalValueIDR || 0).toLocaleString()}</td>
                    <td><span className="badge badge-emerald"><ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />{r.status || 'VERIFIED'}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => alert(`🖨️ Mencetak Tanda Terima Barang (TTB / GRN PDF) ${r.grnNumber} untuk ${r.supplierName}...`)}
                      >
                        <Printer size={14} /> Cetak TTB
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM CREATE GOODS RECEIPT */}
      {activeView === 'create' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: '#fbbf24' }}>
            ✍️ Form Input Tanda Terima Barang (TTB) & Penambahan Stok Vault
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM PURCHASE ORDER (PO) DROPDOWN */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(52,211,153,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #34d399' }}>
                <label className="form-label" style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingCart size={18} /> Tarik Otomatis Dari Purchase Order (PO Impor / Lokal):
                </label>
                <select
                  className="form-select"
                  value={form.selectedPOId}
                  onChange={handlePOSelect}
                  style={{ background: '#0f172a', color: '#fff', fontWeight: 600 }}
                >
                  <option value="">-- (Pilih No. Purchase Order PO Pembelian) --</option>
                  {purchaseOrders.map(po => (
                    <option key={po.id || po.poNumber} value={po.poNumber}>
                      [{po.poNumber}] {po.supplierName} - {po.itemDescription || 'Emas Batangan'} ({po.weightGrams}g)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Tanda Terima Barang (TTB / GRN)</label>
                <input
                  className="form-input"
                  value={form.grnNumber}
                  onChange={e => setForm({ ...form, grnNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Terima Di Vault</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Supplier Emas</label>
                <input
                  className="form-input"
                  value={form.supplierName}
                  onChange={e => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Surat Jalan Supplier</label>
                <input
                  className="form-input"
                  value={form.supplierDoNumber}
                  onChange={e => setForm({ ...form, supplierDoNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Lokasi Vault Penambahan Stok</label>
                <select
                  className="form-select"
                  value={form.targetVault}
                  onChange={e => {
                    const code = e.target.value;
                    const name = code === '1158' ? 'Vault Impor 999.9 (Akun 1158)' : code === '1157' ? 'Vault Utama LM 999.9 (Akun 1157)' : 'Persediaan Scrap Retur (Akun 1152)';
                    setForm({ ...form, targetVault: code, targetVaultName: name });
                  }}
                >
                  <option value="1158">Vault Impor 999.9 (Akun 1158)</option>
                  <option value="1157">Vault Utama LM Lokal (Akun 1157)</option>
                  <option value="1152">Persediaan Scrap Retur (Akun 1152)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Sertifikat Assay Kemurnian</label>
                <input
                  className="form-input"
                  value={form.assayCertificateNo}
                  onChange={e => setForm({ ...form, assayCertificateNo: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nomor Seri Bar / Lot Serial Numbers</label>
                <input
                  className="form-input"
                  value={form.barSerialNumbers}
                  onChange={e => setForm({ ...form, barSerialNumbers: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Deskripsi Fisik Barang Diterima</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Fisik Emas Diterima (Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ border: '1px solid #34d399', color: '#34d399', fontWeight: 700 }}
                  value={form.receivedWeightGram}
                  onChange={e => setForm({ ...form, receivedWeightGram: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Harga Satuan IDR / Gram</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.unitPriceIDRPerGram}
                  onChange={e => setForm({ ...form, unitPriceIDRPerGram: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid rgba(52,211,153,0.4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <span className="stat-lbl">Total Valuasi Fisik Diterima (IDR)</span>
                  <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.4rem' }}>
                    Rp {(form.receivedWeightGram * form.unitPriceIDRPerGram).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Posting Penambahan Stok</span>
                  <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.1rem' }}>
                    Debet: Akun {form.targetVault} ({form.targetVaultName})
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <CheckCircle2 size={18} /> Simpan Tanda Terima Barang (TTB) & Tambah Stok Vault
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
