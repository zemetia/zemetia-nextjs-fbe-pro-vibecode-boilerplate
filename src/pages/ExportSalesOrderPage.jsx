import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react';
import { getCustomers, getFinishedGoods } from '../services/storageService';
import { getStoredUsdRate } from '../services/currencyService';

export default function ExportSalesOrderPage() {
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    soNumber: 'SO-EXP-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedCustomerId: '',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    paymentTerms: 'NET 30 (LC at Sight)',
    incoterms: 'FOB Jakarta Port',
    currency: 'USD',
    exchangeRate: 16250,
    selectedSKU: '',
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    karat: '750',
    weightGrams: 1000,
    pricePerGramUSD: 85.00, // Fixed Gold Price USD/Gram
    deliveryTargetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
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

    // 2. Finished Goods
    const fgs = getFinishedGoods();
    setFinishedGoods(fgs);

    // 3. Stored Sales Orders
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_export_sales_orders') || [
        {
          id: 'SO-EXP-2026-001',
          soNumber: 'SO-EXP-2026-001',
          date: '2026-08-10',
          buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
          country: 'United Arab Emirates (UAE)',
          itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
          weightGrams: 1000,
          pricePerGramUSD: 85.00,
          totalUSD: 85000,
          exchangeRate: 16250,
          totalIDR: 1381250000,
          status: 'FIXED / IN PRODUCTION',
          invoiced: false
        }
      ];
      setSalesOrders(stored);
    }
  };

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
    }
  };

  const handleSKUSelect = (e) => {
    const skuCode = e.target.value;
    const found = finishedGoods.find(fg => (fg.sku === skuCode || fg.id === skuCode));
    if (found) {
      setForm({
        ...form,
        selectedSKU: skuCode,
        itemDescription: `${found.name} (${found.type} Karat ${found.karat} ${found.goldColor})`,
        karat: found.karat
      });
    }
  };

  const totalUSD = (form.weightGrams || 0) * (form.pricePerGramUSD || 0);
  const totalIDR = totalUSD * (form.exchangeRate || 16250);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.soNumber || !form.buyerName || !form.weightGrams || !form.pricePerGramUSD) {
      alert('Mohon lengkapi No SO, Buyer, Berat Gram, dan Harga USD/Gram Fixing.');
      return;
    }

    const newSO = {
      id: form.soNumber,
      ...form,
      totalUSD,
      totalIDR,
      status: 'FIXED / IN PRODUCTION',
      invoiced: false,
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get('pttan_export_sales_orders') || [];
      list.unshift(newSO);
      window.Storage.set('pttan_export_sales_orders', list);

      alert(`✅ Export Sales Order (${newSO.soNumber}) Berhasil Disimpan & Harga USD $${form.pricePerGramUSD}/g Dikunci (Fixed Price)!`);
      loadInitialData();
      setActiveView('list');
    }
  };

  const filteredOrders = salesOrders.filter(so =>
    so.soNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    so.buyerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingBag color="#f59e0b" size={24} /> Export Sales Order (SO Ekspor & Gold Price Fixing)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Modul Input Kontrak Pesanan Ekspor & Penguncian Harga Emas USD/Gram (Price Fixing Basis Faktur Ekspor)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ background: activeView === 'list' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('list')}
            >
              <ShoppingBag size={18} /> Register Sales Order (SO)
            </button>
            <button
              className="btn-primary"
              style={{ background: activeView === 'create' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(15,23,42,0.6)' }}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Sales Order (SO) Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE SO EKSPOR */}
      {activeView === 'list' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
              📋 Daftar Sales Order Ekspor Aktif ({filteredOrders.length})
            </h3>

            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                placeholder="Cari No. SO atau Nama Buyer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. SO Ekspor</th>
                  <th>Tanggal Fixing</th>
                  <th>Buyer Overseas</th>
                  <th>Negara</th>
                  <th>Berat Gram</th>
                  <th style={{ textAlign: 'right' }}>Harga Fixing USD/g</th>
                  <th style={{ textAlign: 'right' }}>Total Contract USD</th>
                  <th>Status Pesanan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Belum ada Sales Order Ekspor dibuat</td></tr>
                ) : (
                  filteredOrders.map(so => (
                    <tr key={so.id || so.soNumber}>
                      <td><strong>{so.soNumber}</strong></td>
                      <td>{so.date}</td>
                      <td><strong>{so.buyerName}</strong></td>
                      <td>{so.country}</td>
                      <td style={{ fontWeight: 700 }}>{so.weightGrams} g</td>
                      <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>$ {so.pricePerGramUSD} / g</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>$ {(so.totalUSD || 0).toLocaleString()} USD</td>
                      <td><span className="badge badge-gold">{so.status || 'FIXED / IN PRODUCTION'}</span></td>
                      <td>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          onClick={() => alert(`🖨️ Mencetak Export Sales Order PDF (${so.soNumber}) untuk ${so.buyerName}...`)}
                        >
                          <Printer size={14} /> Cetak SO
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

      {/* VIEW 2: FORM CREATE SALES ORDER */}
      {activeView === 'create' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: '#fbbf24' }}>
            ✍️ Form Input Export Sales Order (SO) & Fixing Harga USD
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Pilih Buyer Overseas (Dari Master Customer)</label>
                <select
                  className="form-select"
                  value={form.selectedCustomerId}
                  onChange={handleCustomerSelect}
                >
                  {customers.map(c => (
                    <option key={c.id || c.code} value={c.id || c.code}>{c.name} ({c.country || 'Overseas'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Export Sales Order (SO)</label>
                <input
                  className="form-input"
                  value={form.soNumber}
                  onChange={e => setForm({ ...form, soNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Fixing Kontrak SO</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Syarat Pembayaran (Payment Terms)</label>
                <input
                  className="form-input"
                  value={form.paymentTerms}
                  onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                />
              </div>

              {/* Auto Select Item / Finished Goods */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Pilih Perhiasan Pesanan (Master Finished Goods)</label>
                <select
                  className="form-select"
                  value={form.selectedSKU}
                  onChange={handleSKUSelect}
                >
                  <option value="">-- (Pilih Item Perhiasan) --</option>
                  {finishedGoods.map(fg => (
                    <option key={fg.id || fg.sku} value={fg.sku}>
                      [{fg.sku}] {fg.name} - Karat {fg.karat} ({fg.goldColor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Rincian Spesifikasi Perhiasan Pesanan</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Pesanan (Gross Weight Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.weightGrams}
                  onChange={e => setForm({ ...form, weightGrams: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HARGA FIXING KONTRAK (USD / Gram)</label>
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
                <label className="form-label">Kurs BCA e-Rate USD/IDR (Acuan Kontrak)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.exchangeRate}
                  onChange={e => setForm({ ...form, exchangeRate: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Tanggal Pengiriman (Delivery Target)</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.deliveryTargetDate}
                  onChange={e => setForm({ ...form, deliveryTargetDate: e.target.value })}
                />
              </div>
            </div>

            {/* Calculations Summary Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid rgba(245,158,11,0.4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <span className="stat-lbl">Total Nilai Kontrak SO (USD)</span>
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
                  <span className="stat-lbl">Status Penguncian Harga</span>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.1rem' }}>
                    GOLD PRICE FIXED
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <CheckCircle2 size={18} /> Simpan Export Sales Order & Kunci Harga USD
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
