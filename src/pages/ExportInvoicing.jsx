import React, { useState, useEffect } from 'react';
import { FileText, Globe, DollarSign, Download, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getCustomers, getFinishedGoods } from '../services/storageService';
import { getStoredUsdRate } from '../services/currencyService';

export default function ExportInvoicing() {
  const [activeView, setActiveView] = useState('list'); // 'list' (Table Register) or 'create' (Form)
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveRate, setLiveRate] = useState(16250);

  // Form State with Auto-Selection Dropdowns
  const [form, setForm] = useState({
    invoiceNo: 'INV-EXP-2026-001',
    date: new Date().toISOString().split('T')[0],
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
    // 1. Customers
    const custs = getCustomers();
    setCustomers(custs);
    if (custs.length > 0 && !form.selectedCustomerId) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: custs[0].id || custs[0].code,
        buyerName: custs[0].name,
        country: custs[0].country || 'United Arab Emirates'
      }));
    }

    // 2. Finished Goods Catalog
    const fgs = getFinishedGoods();
    setFinishedGoods(fgs);

    // 3. Live Exchange Rate
    const rate = getStoredUsdRate();
    if (rate) {
      setLiveRate(rate);
      setForm(prev => ({ ...prev, exchangeRate: rate }));
    }

    // 4. Stored Export Invoices
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_export_invoices') || [
        {
          id: 'INV-EXP-2026-001',
          invoiceNo: 'INV-EXP-2026-001',
          date: '2026-08-10',
          buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
          country: 'United Arab Emirates (UAE)',
          pebNumber: 'PEB-2026-088912',
          itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
          weightGrams: 1300,
          pricePerGramUSD: 85.00,
          totalUSD: 110500,
          exchangeRate: 16250,
          totalIDR: 1795625000,
          status: 'PEB APPROVED (PPN 0%)'
        }
      ];
      setInvoices(stored);
    }
  };

  // Handler Customer Dropdown Select
  const handleCustomerSelect = (e) => {
    const custId = e.target.value;
    const found = customers.find(c => (c.id === custId || c.code === custId));
    if (found) {
      setForm({
        ...form,
        selectedCustomerId: custId,
        buyerName: found.name,
        country: found.country || 'Overseas Buyer'
      });
    } else {
      setForm({ ...form, selectedCustomerId: custId, buyerName: custId });
    }
  };

  // Handler SKU Finished Goods Dropdown Select
  const handleSKUSelect = (e) => {
    const skuCode = e.target.value;
    const found = finishedGoods.find(fg => (fg.sku === skuCode || fg.id === skuCode));
    if (found) {
      setForm({
        ...form,
        selectedSKU: skuCode,
        itemDescription: `${found.name} (${found.type} Karat ${found.karat} ${found.goldColor})`,
        karat: found.karat,
        hsCode: found.hsCode || '7113.19.90'
      });
    }
  };

  // Calculations
  const totalUSD = (form.weightGrams || 0) * (form.pricePerGramUSD || 0);
  const totalIDR = totalUSD * (form.exchangeRate || 16250);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.invoiceNo || !form.buyerName || !form.weightGrams) {
      alert('Mohon lengkapi No Invoice, Buyer, dan Berat Perhiasan Ekspor.');
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

      // 2. Auto Posting EMKM Journal (Debet 1125 Bank Valas USD / Kredit 4120 Pendapatan Ekspor PPN 0%)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-EXP-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: `Penjualan Ekspor Perhiasan (${newInvoice.invoiceNo}) - ${newInvoice.buyerName} [PEB: ${newInvoice.pebNumber}]`,
        lines: [
          { accountCode: '1125', accountName: 'Bank Valas USD (Mandiri/BCA)', debit: totalIDR, credit: 0 },
          { accountCode: '4120', accountName: 'Pendapatan Ekspor Perhiasan Emas (PPN 0%)', debit: 0, credit: totalIDR }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      alert(`✅ Faktur Ekspor USD (${newInvoice.invoiceNo}) Berhasil Diterbitkan & Jurnal Mutasi Otomatis Diposting ke Akun 4120 (PPN 0%)!`);
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
              Manajemen Faktur Ekspor Perhiasan, Integrasi Master Buyer & Vault Ekspor, Sertifikat PPN 0% Pabean
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
              <Plus size={18} /> Buat Faktur Ekspor Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: TABLE REGISTER FAJTUR EKSPOR */}
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
                  <th>Tanggal</th>
                  <th>Buyer Ekspor</th>
                  <th>Negara Tujuan</th>
                  <th>Dokumen PEB</th>
                  <th>Berat (g)</th>
                  <th style={{ textAlign: 'right' }}>Total Nilai USD</th>
                  <th style={{ textAlign: 'right' }}>Equivalent IDR</th>
                  <th>Status PPN 0%</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Belum ada Faktur Ekspor diterbitkan</td></tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id || inv.invoiceNo}>
                      <td><strong>{inv.invoiceNo}</strong></td>
                      <td>{inv.date}</td>
                      <td><strong>{inv.buyerName}</strong></td>
                      <td>{inv.country}</td>
                      <td><small style={{ color: '#38bdf8' }}>{inv.pebNumber}</small></td>
                      <td style={{ fontWeight: 700 }}>{inv.weightGrams} g</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>$ {(inv.totalUSD || 0).toLocaleString()} USD</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>Rp {(inv.totalIDR || 0).toLocaleString()}</td>
                      <td><span className="badge badge-emerald"><ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />{inv.status || 'PPN 0% APPROVED'}</span></td>
                      <td>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          onClick={() => alert(`🖨️ Mencetak Commercial Export Invoice PDF (${inv.invoiceNo}) untuk ${inv.buyerName}...`)}
                        >
                          <Printer size={14} /> Cetak Invoice
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM CREATE FAKTUR EKSPOR (WITH AUTO-SELECTION) */}
      {activeView === 'create' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: '#fbbf24' }}>
            ✍️ Form Pembuatan Faktur Ekspor Baru (Penarikan Otomatis Master Data)
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* Auto Select Customer / Buyer */}
              <div className="form-group">
                <label className="form-label">Pilih Buyer Overseas (Dari Master Customer)</label>
                <select
                  className="form-select"
                  value={form.selectedCustomerId}
                  onChange={handleCustomerSelect}
                >
                  {customers.length === 0 ? (
                    <option value="">(Belum ada data Master Customer - Pilih Default)</option>
                  ) : (
                    customers.map(c => (
                      <option key={c.id || c.code} value={c.id || c.code}>{c.name} ({c.country || 'Overseas'})</option>
                    ))
                  )}
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

              {/* Auto Select Item / Finished Goods */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Pilih Perhiasan Dari Stok Vault Ekspor (Master Finished Goods)</label>
                <select
                  className="form-select"
                  value={form.selectedSKU}
                  onChange={handleSKUSelect}
                >
                  <option value="">-- (Pilih Item Perhiasan Dari Vault Ekspor) --</option>
                  {finishedGoods.map(fg => (
                    <option key={fg.id || fg.sku} value={fg.sku}>
                      [{fg.sku}] {fg.name} - Karat {fg.karat} ({fg.goldColor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Rincian Deskripsi Barang Ekspor</label>
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
                <label className="form-label">Harga Satuan USD / Gram</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
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
    </div>
  );
}
