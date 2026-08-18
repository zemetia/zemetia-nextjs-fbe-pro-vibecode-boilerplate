import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Package, Award, Tag } from 'lucide-react';
import { getPurchaseOrders } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

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

  const handleInvoiceSelect = (invNo) => {
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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Truck color="#38bdf8" size={24} /> Surat Jalan Ekspor (Export Delivery Order & Packing List)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Penerbitan Surat Jalan Ekspor Lengkap Dengan Ref Sales Order (SO), No. Sertifikat Emas, & No. Sertifikat Kadar Assay
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className={`btn-primary ${
                activeView === 'list'
                  ? 'bg-linear-135 from-sky to-sky-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('list')}
            >
              <Truck size={18} /> Register Surat Jalan Ekspor
            </button>
            <button
              className={`btn-primary ${
                activeView === 'create'
                  ? 'bg-linear-135 from-emerald to-emerald-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Surat Jalan Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE SURAT JALAN */}
      {activeView === 'list' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
            <h3 className="font-heading text-[1.1rem]">
              📋 Daftar Surat Jalan Ekspor Diterbitkan ({filteredDO.length})
            </h3>

            <div className="relative w-75">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
              <input
                className="form-input pl-9.5 w-full"
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
                    <td><span className="badge badge-gold text-xs">{d.soNumber || 'SO-EXP-2026-001'}</span></td>
                    <td><small className="text-emerald-light">{d.invoiceNo}</small></td>
                    <td>{d.date}</td>
                    <td><strong>{d.buyerName}</strong></td>
                    <td><small className="text-sky-light font-semibold">{d.goldCertificateNo || 'CERT-GOLD-998812'}</small></td>
                    <td><small className="text-[#a78bfa] font-semibold">{d.purityCertificateNo || 'ASSAY-750-0012'}</small></td>
                    <td className="font-bold text-gold-light">{d.netWeightGram} g</td>
                    <td><span className="badge badge-emerald">{d.status || 'SHIPPED'}</span></td>
                    <td>
                      <button
                        className="btn-primary py-1.5 px-2.5 text-xs"
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
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-sky-light">
            ✍️ Form Pembuatan Surat Jalan Ekspor (Termasuk Ref Sales Order & Sertifikat Emas)
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM INVOICE DROPDOWN */}
              <div className="form-group col-span-2 bg-[rgba(56,189,248,0.1)] p-3 rounded-sm border border-sky-light">
                <label className="form-label text-sky-light font-bold flex items-center gap-2">
                  <FileText size={18} /> Tarik Otomatis Dari Commercial Invoice Ekspor:
                </label>
                <Combobox className="bg-ink text-white font-semibold"
                  value={form.selectedInvoiceNo}
                  onChange={handleInvoiceSelect}
                  placeholder="-- (Pilih No. Commercial Invoice Untuk Tarik Data Barang & SO) --"
                  searchPlaceholder="Cari nomor invoice, SO, atau buyer…"
                  emptyText="Commercial Invoice tidak ditemukan."
                  options={invoices.map(inv => ({
                    value: inv.invoiceNo,
                    label: `[${inv.invoiceNo}] (Ref SO: ${inv.soNumber || 'SO-EXP-2026-001'}) - ${inv.buyerName} (${inv.weightGrams}g)`
                  }))}
                />
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
                <label className="form-label text-gold-light font-bold">Ref No. Sales Order (SO Ekspor)</label>
                <input
                  className="form-input border border-gold text-gold-light font-bold"
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
                <label className="form-label text-sky-light font-bold">No. Sertifikat Emas (Fine Gold Certificate)</label>
                <input
                  className="form-input border border-sky-light text-sky-light font-bold"
                  value={form.goldCertificateNo}
                  onChange={e => setForm({ ...form, goldCertificateNo: e.target.value })}
                />
              </div>

              {/* INPUT NOMOR SERTIFIKAT KADAR / ASSAY */}
              <div className="form-group">
                <label className="form-label text-[#a78bfa] font-bold">No. Sertifikat Kadar (Purity Assay Cert)</label>
                <input
                  className="form-input border border-purple text-[#a78bfa] font-bold"
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
                <NumberInput
                  value={form.boxCount}
                  onChange={boxCount => setForm({ ...form, boxCount })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Deskripsi Barang Ekspor</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Bersih Emas (Net Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={form.netWeightGram}
                  onChange={netWeightGram => setForm({ ...form, netWeightGram })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Kotor Dengan Box (Gross Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={form.grossWeightGram}
                  onChange={grossWeightGram => setForm({ ...form, grossWeightGram })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary mt-4 bg-[linear-gradient(135deg,_#0284c7,_#0369a1)]">
              <CheckCircle2 size={18} /> Terbitkan Surat Jalan Ekspor & Potong Stok Vault Ekspor (1160)
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
