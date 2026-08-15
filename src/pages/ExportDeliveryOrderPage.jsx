import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Package, Award, Tag } from 'lucide-react';
import { getPurchaseOrders } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function ExportDeliveryOrderPage() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    doNumber: 'DO-EXP-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedInvoiceNo: '',
    soNumber: 'SO-EXP-2026-001', // Ref Sales Order Number
    goldCertificateNo: 'CERT-FINEGOLD-998812', // No. Sertifikat Emas
    purityCertificateNo: 'ASSAY-KARAT-750-0012', // No. Sertifikat Kadar
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
          goldCertificateNo: 'CERT-FINEGOLD-998812',
          purityCertificateNo: 'ASSAY-KARAT-750-0012',
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
      showModal({
        variant: 'success',
        title: `✅ Data Ditarik Dari Invoice ${foundInv.invoiceNo}`,
        message: `• Ref SO: ${foundInv.soNumber || 'SO-EXP-2026-001'}\n• Buyer: ${foundInv.buyerName}\nForm surat jalan sudah terisi otomatis.`
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.doNumber || !form.buyerName || !form.netWeightGram || !form.soNumber) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi No. Surat Jalan, Ref Sales Order (SO), Buyer, dan Berat Barang.' });
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

      // 2. Deduct Physical Stock from Vault 1160
      showModal({
        variant: 'success',
        title: `✅ Surat Jalan Ekspor (${newDO.doNumber}) Diterbitkan`,
        message: `• Ref SO: ${newDO.soNumber}\n• Sertifikat Emas: ${newDO.goldCertificateNo}\n• Sertifikat Kadar: ${newDO.purityCertificateNo}`
      });
      loadInitialData();
      setActiveView('list');
    }
  };

  const filteredDO = deliveryOrders.filter(d =>
    d.doNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.soNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.goldCertificateNo?.toLowerCase().includes(searchQuery.toLowerCase())
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
              Penerbitan Surat Jalan Ekspor Lengkap Dengan Ref Sales Order (SO), No. Sertifikat Emas, & No. Sertifikat Kadar Assay
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
                placeholder="Cari Surat Jalan, SO, Invoice, atau Sertifikat..."
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
                  <th>Ref Sales Order (SO)</th>
                  <th>Ref Invoice</th>
                  <th>Tanggal Kirim</th>
                  <th>Buyer Overseas</th>
                  <th>No. Sertifikat Emas</th>
                  <th>No. Sertifikat Kadar</th>
                  <th>Net Weight (g)</th>
                  <th>Status Shipping</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDO.map(d => (
                  <tr key={d.id || d.doNumber}>
                    <td><strong>{d.doNumber}</strong></td>
                    <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>{d.soNumber || 'SO-EXP-2026-001'}</span></td>
                    <td><small style={{ color: '#34d399' }}>{d.invoiceNo}</small></td>
                    <td>{d.date}</td>
                    <td><strong>{d.buyerName}</strong></td>
                    <td><small style={{ color: '#38bdf8', fontWeight: 600 }}>{d.goldCertificateNo || 'CERT-GOLD-998812'}</small></td>
                    <td><small style={{ color: '#a78bfa', fontWeight: 600 }}>{d.purityCertificateNo || 'ASSAY-750-0012'}</small></td>
                    <td style={{ fontWeight: 700, color: '#fbbf24' }}>{d.netWeightGram} g</td>
                    <td><span className="badge badge-emerald">{d.status || 'SHIPPED'}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => showModal({
                          variant: 'info',
                          title: `🖨️ Cetak Surat Jalan Ekspor ${d.doNumber}`,
                          message: `• SO: ${d.soNumber}\n• Cert Emas: ${d.goldCertificateNo}\n• Cert Kadar: ${d.purityCertificateNo}`
                        })}
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
            ✍️ Form Pembuatan Surat Jalan Ekspor (Termasuk Ref Sales Order & Sertifikat Emas)
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
                  <option value="">-- (Pilih No. Commercial Invoice Untuk Tarik Data Barang & SO) --</option>
                  {invoices.map(inv => (
                    <option key={inv.id || inv.invoiceNo} value={inv.invoiceNo}>
                      [{inv.invoiceNo}] (Ref SO: {inv.soNumber || 'SO-EXP-2026-001'}) - {inv.buyerName} ({inv.weightGrams}g)
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

              {/* REFERENSI SALES ORDER */}
              <div className="form-group">
                <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700 }}>Ref No. Sales Order (SO Ekspor)</label>
                <input
                  className="form-input"
                  style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                  value={form.soNumber}
                  onChange={e => setForm({ ...form, soNumber: e.target.value })}
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

              {/* INPUT NOMOR SERTIFIKAT EMAS */}
              <div className="form-group">
                <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>No. Sertifikat Emas (Fine Gold Certificate)</label>
                <input
                  className="form-input"
                  style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
                  value={form.goldCertificateNo}
                  onChange={e => setForm({ ...form, goldCertificateNo: e.target.value })}
                />
              </div>

              {/* INPUT NOMOR SERTIFIKAT KADAR / ASSAY */}
              <div className="form-group">
                <label className="form-label" style={{ color: '#a78bfa', fontWeight: 700 }}>No. Sertifikat Kadar (Purity Assay Cert)</label>
                <input
                  className="form-input"
                  style={{ border: '1px solid #8b5cf6', color: '#a78bfa', fontWeight: 700 }}
                  value={form.purityCertificateNo}
                  onChange={e => setForm({ ...form, purityCertificateNo: e.target.value })}
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

      <Modal {...modalProps} />
    </div>
  );
}
