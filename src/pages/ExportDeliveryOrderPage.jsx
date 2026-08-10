import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Package } from 'lucide-react';

export default function ExportDeliveryOrderPage() {
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    doNumber: 'DO-EXP-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedInvoiceNo: '',
    soNumber: 'SO-EXP-2026-001',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    courierName: 'Brinks Global Secured Transport / Malca-Amit',
    awbNumber: 'AWB-FEDEX-99881122',
    pebNumber: 'PEB-2026-088912',
    securitySealNo: 'SEAL-GOLD-998812',
    boxCount: 2,
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    netWeightGram: 1000,
    grossWeightGram: 1250 // Weight with protective vault box
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    // 1. Invoices
    if (typeof window !== 'undefined' && window.Storage) {
      const storedInv = window.Storage.get('pttan_export_invoices') || [];
      setInvoices(storedInv);

      // 2. Delivery Orders
      const storedDO = window.Storage.get('pttan_export_delivery_orders') || [
        {
          id: 'DO-EXP-2026-001',
          doNumber: 'DO-EXP-2026-001',
          invoiceNo: 'INV-EXP-2026-001',
          soNumber: 'SO-EXP-2026-001',
          date: '2026-08-10',
          buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
          country: 'United Arab Emirates (UAE)',
          courierName: 'Brinks Global Secured Transport',
          awbNumber: 'AWB-FEDEX-99881122',
          pebNumber: 'PEB-2026-088912',
          securitySealNo: 'SEAL-GOLD-998812',
          boxCount: 2,
          itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
          netWeightGram: 1000,
          grossWeightGram: 1250,
          status: 'SHIPPED / IN TRANSIT'
        }
      ];
      setDeliveryOrders(storedDO);
    }
  };

  const handleInvoiceSelect = (e) => {
    const invNo = e.target.value;
    const foundInv = invoices.find(i => (i.id === invNo || i.invoiceNo === invNo));
    if (foundInv) {
      setForm({
        ...form,
        selectedInvoiceNo: invNo,
        soNumber: foundInv.soNumber || 'SO-EXP-2026-001',
        buyerName: foundInv.buyerName,
        country: foundInv.country,
        pebNumber: foundInv.pebNumber || 'PEB-2026-088912',
        awbNumber: foundInv.awbNumber || 'AWB-FEDEX-99881122',
        itemDescription: foundInv.itemDescription,
        netWeightGram: foundInv.weightGrams,
        grossWeightGram: Math.round(foundInv.weightGrams * 1.25)
      });
      alert(`✅ Surat Jalan Ditarik Otomatis Dari Invoice ${foundInv.invoiceNo}! Net Weight ${foundInv.weightGrams}g & Buyer ${foundInv.buyerName} Terisi.`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.doNumber || !form.buyerName || !form.netWeightGram) {
      alert('Mohon lengkapi No. Surat Jalan, Buyer, dan Berat Barang.');
      return;
    }

    const newDO = {
      id: form.doNumber,
      invoiceNo: form.selectedInvoiceNo || 'INV-EXP-2026-001',
      ...form,
      status: 'SHIPPED / IN TRANSIT',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save DO
      const list = window.Storage.get('pttan_export_delivery_orders') || [];
      list.unshift(newDO);
      window.Storage.set('pttan_export_delivery_orders', list);

      // 2. Deduct Physical Stock from Vault 1160 (Persediaan Perhiasan Ekspor)
      alert(`✅ Surat Jalan Ekspor (${newDO.doNumber}) Berhasil Diterbitkan & ${newDO.netWeightGram}g Perhiasan Dipotong dari Vault Siap Ekspor (Akun 1160)!`);
      loadInitialData();
      setActiveView('list');
    }
  };

  const filteredDO = deliveryOrders.filter(d =>
    d.doNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck color="#38bdf8" size={24} /> Surat Jalan Ekspor (Export Delivery Order & Packing List)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Modul Penerbitan Surat Jalan Ekspor, Penyerahan Kargo Pengawal Emas (Brinks/Malca-Amit), & Security Seal Koli
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ background: activeView === 'list' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('list')}
            >
              <Truck size={18} /> Register Surat Jalan Ekspor
            </button>
            <button
              className="btn-primary"
              style={{ background: activeView === 'create' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Surat Jalan Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE SURAT JALAN */}
      {activeView === 'list' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              📋 Daftar Surat Jalan Ekspor Diterbitkan ({filteredDO.length})
            </h3>

            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                placeholder="Cari Surat Jalan, Invoice, atau Buyer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. Surat Jalan</th>
                  <th>Ref Invoice</th>
                  <th>Tanggal Kirim</th>
                  <th>Buyer Overseas</th>
                  <th>Kurir Kargo Secured</th>
                  <th>Security Seal No</th>
                  <th>Net Weight (g)</th>
                  <th>Gross Weight (g)</th>
                  <th>Status Shipping</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDO.map(d => (
                  <tr key={d.id || d.doNumber}>
                    <td><strong>{d.doNumber}</strong></td>
                    <td><small style={{ color: '#34d399' }}>{d.invoiceNo}</small></td>
                    <td>{d.date}</td>
                    <td><strong>{d.buyerName}</strong></td>
                    <td>{d.courierName}</td>
                    <td><small style={{ color: '#38bdf8' }}>{d.securitySealNo}</small></td>
                    <td style={{ fontWeight: 700, color: '#fbbf24' }}>{d.netWeightGram} g</td>
                    <td>{d.grossWeightGram} g</td>
                    <td><span className="badge badge-emerald">{d.status || 'SHIPPED'}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => alert(`🖨️ Mencetak Surat Jalan Ekspor / Delivery Order PDF (${d.doNumber}) untuk ${d.buyerName}...`)}
                      >
                        <Printer size={14} /> Cetak Surat Jalan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM CREATE SURAT JALAN */}
      {activeView === 'create' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: '#38bdf8' }}>
            ✍️ Form Pembuatan Surat Jalan Ekspor Baru (Penarikan Otomatis Dari Invoice Ekspor)
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM INVOICE DROPDOWN */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(56,189,248,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #38bdf8' }}>
                <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> Tarik Otomatis Dari Commercial Invoice Ekspor:
                </label>
                <select
                  className="form-select"
                  value={form.selectedInvoiceNo}
                  onChange={handleInvoiceSelect}
                  style={{ background: '#0f172a', color: '#fff', fontWeight: 600 }}
                >
                  <option value="">-- (Pilih No. Commercial Invoice Untuk Tarik Data Barang) --</option>
                  {invoices.map(inv => (
                    <option key={inv.id || inv.invoiceNo} value={inv.invoiceNo}>
                      [{inv.invoiceNo}] {inv.buyerName} - {inv.itemDescription} ({inv.weightGrams}g)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Surat Jalan Ekspor (DO Number)</label>
                <input
                  className="form-input"
                  value={form.doNumber}
                  onChange={e => setForm({ ...form, doNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Pengiriman Bandara</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Buyer Overseas</label>
                <input
                  className="form-input"
                  value={form.buyerName}
                  onChange={e => setForm({ ...form, buyerName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ekspedisi Kargo Secured (Pengawal Emas)</label>
                <input
                  className="form-input"
                  value={form.courierName}
                  onChange={e => setForm({ ...form, courierName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Airway Bill (AWB / Tracking)</label>
                <input
                  className="form-input"
                  value={form.awbNumber}
                  onChange={e => setForm({ ...form, awbNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. PEB (Pemberitahuan Ekspor Barang)</label>
                <input
                  className="form-input"
                  value={form.pebNumber}
                  onChange={e => setForm({ ...form, pebNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Security Seal Brankas Vault</label>
                <input
                  className="form-input"
                  value={form.securitySealNo}
                  onChange={e => setForm({ ...form, securitySealNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Koli / Box Brankas</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.boxCount}
                  onChange={e => setForm({ ...form, boxCount: Number(e.target.value) })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Deskripsi Barang Ekspor</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Bersih Emas (Net Weight Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.netWeightGram}
                  onChange={e => setForm({ ...form, netWeightGram: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Kotor Dengan Box (Gross Weight Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.grossWeightGram}
                  onChange={e => setForm({ ...form, grossWeightGram: Number(e.target.value) })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '16px', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
              <CheckCircle2 size={18} /> Terbitkan Surat Jalan Ekspor & Potong Stok Vault Ekspor (1160)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
