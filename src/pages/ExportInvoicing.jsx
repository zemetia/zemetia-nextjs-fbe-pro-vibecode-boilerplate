import React, { useState, useEffect } from 'react';
import { FileText, Globe, DollarSign, Download, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck, ShoppingBag } from 'lucide-react';
import { getCustomers, getFinishedGoods } from '../services/storageService';
import { getStoredUsdRate } from '../services/currencyService';
import Modal, { useModal } from '../components/ui/Modal';

export default function ExportInvoicing() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' (Table Register) or 'create' (Form)
  const [invoices, setInvoices] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State with Auto-Selection Dropdowns
  const [form, setForm] = useState({
    invoiceNo: 'INV-EXP-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedSOId: '',
    selectedCustomerId: '',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    pebNumber: 'PEB-2026-088912',
    awbNumber: 'AWB-FEDEX-99881122',
    incoterms: 'FOB Jakarta Port',
    currency: 'USD',
    exchangeRate: 16250,
    selectedSKU: '',
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    karat: '750',
    hsCode: '7113.19.90',
    weightGrams: 1000,
    pricePerGramUSD: 85.00
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    // 1. Customers & Finished Goods
    setCustomers(getCustomers());
    setFinishedGoods(getFinishedGoods());

    // 2. Sales Orders
    if (typeof window !== 'undefined' && window.Storage) {
      const storedSO = window.Storage.get('pttan_export_sales_orders') || [];
      setSalesOrders(storedSO);
    }

    // 3. Stored Export Invoices
    if (typeof window !== 'undefined' && window.Storage) {
      const storedInv = window.Storage.get('pttan_export_invoices') || [
        {
          id: 'INV-EXP-2026-001',
          invoiceNo: 'INV-EXP-2026-001',
          soNumber: 'SO-EXP-2026-001',
          date: '2026-08-10',
          buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
          country: 'United Arab Emirates (UAE)',
          pebNumber: 'PEB-2026-088912',
          itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
          weightGrams: 1000,
          pricePerGramUSD: 85.00,
          totalUSD: 85000,
          exchangeRate: 16250,
          totalIDR: 1381250000,
          status: 'PEB APPROVED (PPN 0%)'
        }
      ];
      setInvoices(storedInv);
    }
  };

  // Handler Pull From Sales Order (SO)
  const handleSOSelect = (e) => {
    const soId = e.target.value;
    const foundSO = salesOrders.find(so => (so.id === soId || so.soNumber === soId));
    if (foundSO) {
      setForm({
        ...form,
        selectedSOId: soId,
        buyerName: foundSO.buyerName,
        country: foundSO.country,
        itemDescription: foundSO.itemDescription,
        weightGrams: foundSO.weightGrams,
        pricePerGramUSD: foundSO.pricePerGramUSD,
        exchangeRate: foundSO.exchangeRate || 16250
      });
      showModal({
        variant: 'success',
        title: `✅ Data Ditarik Dari ${foundSO.soNumber}`,
        message: `• Harga fixing: $ ${foundSO.pricePerGramUSD}/g\n• Total terkunci: $ ${foundSO.totalUSD.toLocaleString()} USD`
      });
    }
  };

  // Calculations
  const totalUSD = (form.weightGrams || 0) * (form.pricePerGramUSD || 0);
  const totalIDR = totalUSD * (form.exchangeRate || 16250);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.invoiceNo || !form.buyerName || !form.weightGrams) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi No Invoice, Buyer, dan Berat Perhiasan Ekspor.' });
      return;
    }

    const newInvoice = {
      id: form.invoiceNo,
      ...form,
      totalUSD,
      totalIDR,
      status: 'PEB APPROVED (PPN 0%)',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save Export Invoice
      const list = window.Storage.get('pttan_export_invoices') || [];
      list.unshift(newInvoice);
      window.Storage.set('pttan_export_invoices', list);

      // 2. Auto Posting EMKM Journal
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-EXP-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: `Penjualan Ekspor Perhiasan (${newInvoice.invoiceNo}) Ref SO: ${form.selectedSOId || 'Direct'} - ${newInvoice.buyerName} [PEB: ${newInvoice.pebNumber}]`,
        lines: [
          { accountCode: '1125', accountName: 'Bank Valas USD (Mandiri/BCA)', debit: totalIDR, credit: 0 },
          { accountCode: '4120', accountName: 'Pendapatan Ekspor Perhiasan Emas (PPN 0%)', debit: 0, credit: totalIDR }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      showModal({
        variant: 'success',
        title: `✅ Faktur Ekspor USD (${newInvoice.invoiceNo}) Diterbitkan`,
        message: `• Buyer: ${newInvoice.buyerName}\n• Jurnal PPN 0% diposting ke Akun 4120.`
      });
      loadInitialData();
      setActiveView('list');
    }
  };

  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.pebNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Top Bar Header & Action Controls */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText color="#34d399" size={24} /> Modul Penjualan Ekspor USD (Faktur Ekspor PPN 0% & PEB)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Penerbitan Faktur Ekspor Ditarik Otomatis Dari Export Sales Order (SO) & Fixing Harga USD
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ background: activeView === 'list' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('list')}
            >
              <FileText size={18} /> Register Faktur Ekspor
            </button>
            <button
              className="btn-primary"
              style={{ background: activeView === 'create' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Faktur Ekspor Dari SO
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: TABLE REGISTER FAKTUR EKSPOR */}
      {activeView === 'list' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              📋 Daftar Faktur Ekspor Diterbitkan ({filteredInvoices.length})
            </h3>

            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                placeholder="Cari Invoice, Buyer, atau PEB..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. Invoice</th>
                  <th>Ref No. SO</th>
                  <th>Tanggal</th>
                  <th>Buyer Ekspor</th>
                  <th>Dokumen PEB</th>
                  <th>Berat Gram</th>
                  <th style={{ textAlign: 'right' }}>Total Nilai USD</th>
                  <th style={{ textAlign: 'right' }}>Equivalent IDR</th>
                  <th>Status PPN 0%</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={inv.id || inv.invoiceNo}>
                    <td><strong>{inv.invoiceNo}</strong></td>
                    <td><small style={{ color: '#fbbf24' }}>{inv.soNumber || 'SO-EXP-2026-001'}</small></td>
                    <td>{inv.date}</td>
                    <td><strong>{inv.buyerName}</strong></td>
                    <td><small style={{ color: '#38bdf8' }}>{inv.pebNumber}</small></td>
                    <td style={{ fontWeight: 700 }}>{inv.weightGrams} g</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>$ {(inv.totalUSD || 0).toLocaleString()} USD</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>Rp {(inv.totalIDR || 0).toLocaleString()}</td>
                    <td><span className="badge badge-emerald"><ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />{inv.status || 'PPN 0% APPROVED'}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => showModal({
                          variant: 'info',
                          title: `🖨️ Cetak Commercial Export Invoice ${inv.invoiceNo}`,
                          message: `Dokumen PDF untuk ${inv.buyerName}.`
                        })}
                      >
                        <Printer size={14} /> Cetak Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM CREATE FAKTUR EKSPOR (PULL FROM SO) */}
      {activeView === 'create' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: '#fbbf24' }}>
            ✍️ Form Pembuatan Faktur Ekspor (Penarikan Otomatis Dari Export Sales Order)
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM SALES ORDER (SO) DROPDOWN */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(245,158,11,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} /> Tarik Otomatis Dari Export Sales Order (SO) & Price Fixing:
                </label>
                <select
                  className="form-select"
                  value={form.selectedSOId}
                  onChange={handleSOSelect}
                  style={{ background: '#0f172a', color: '#fff', fontWeight: 600 }}
                >
                  <option value="">-- (Pilih No. Sales Order SO Ekspor Untuk Tarik Harga & Spesifikasi) --</option>
                  {salesOrders.map(so => (
                    <option key={so.id || so.soNumber} value={so.soNumber}>
                      [{so.soNumber}] {so.buyerName} - {so.itemDescription} ({so.weightGrams}g @ ${so.pricePerGramUSD}/g = ${so.totalUSD.toLocaleString()} USD)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Commercial Invoice Ekspor</label>
                <input
                  className="form-input"
                  value={form.invoiceNo}
                  onChange={e => setForm({ ...form, invoiceNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Transaksi</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buyer Overseas (Dari SO)</label>
                <input
                  className="form-input"
                  value={form.buyerName}
                  onChange={e => setForm({ ...form, buyerName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Negara Tujuan Ekspor</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
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
                <label className="form-label">No. Airway Bill (AWB / Courier)</label>
                <input
                  className="form-input"
                  value={form.awbNumber}
                  onChange={e => setForm({ ...form, awbNumber: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Rincian Deskripsi Barang Ekspor (Dari SO)</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HS Code Ekspor PPN 0%</label>
                <input
                  className="form-input"
                  value={form.hsCode}
                  onChange={e => setForm({ ...form, hsCode: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Perhiasan Ekspor (Net Weight Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.weightGrams}
                  onChange={e => setForm({ ...form, weightGrams: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Harga USD / Gram (Terunci Dari SO)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                  value={form.pricePerGramUSD}
                  onChange={e => setForm({ ...form, pricePerGramUSD: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kurs BCA e-Rate USD/IDR</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.exchangeRate}
                  onChange={e => setForm({ ...form, exchangeRate: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid rgba(52,211,153,0.3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <span className="stat-lbl">Total Nilai Penjualan Ekspor (USD)</span>
                  <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.4rem' }}>
                    $ {totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Nilai Kesetaraan Rupiah (IDR)</span>
                  <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.3rem' }}>
                    Rp {totalIDR.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Fasilitas Perpajakan</span>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.1rem' }}>
                    PPN 0% (Pasal 4B UU PPN Ekspor)
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <CheckCircle2 size={18} /> Terbitkan Commercial Invoice & Posting Auto-Jurnal PPN 0%
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
