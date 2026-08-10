import React, { useState } from 'react';
import { FileText, Globe, DollarSign, Download } from 'lucide-react';

export default function ExportInvoicing() {
  const [invoice, setInvoice] = useState({
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    pebNumber: 'PEB-2026-088912',
    awbNumber: 'AWB-FEDEX-99881122',
    incoterms: 'FOB Jakarta Port',
    currency: 'USD',
    exchangeRate: 16200,
    itemDescription: 'Fine Gold Jewelry 750 (18K) Export Assorted Rings & Necklaces',
    weightGrams: 1300,
    pricePerGramUSD: 85.00
  });

  const totalUSD = invoice.weightGrams * invoice.pricePerGramUSD;
  const totalIDR = totalUSD * invoice.exchangeRate;

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText color="#34d399" size={22} /> Pembuatan Faktur Ekspor (Export Sales Invoice USD - PPN 0%)
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Buyer Overseas</label>
            <input
              className="form-input"
              value={invoice.buyerName}
              onChange={e => setInvoice({ ...invoice, buyerName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Negara Tujuan Ekspor</label>
            <input
              className="form-input"
              value={invoice.country}
              onChange={e => setInvoice({ ...invoice, country: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">No. PEB (Pemberitahuan Ekspor Barang)</label>
            <input
              className="form-input"
              value={invoice.pebNumber}
              onChange={e => setInvoice({ ...invoice, pebNumber: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">No. Airway Bill (AWB / Courier)</label>
            <input
              className="form-input"
              value={invoice.awbNumber}
              onChange={e => setInvoice({ ...invoice, awbNumber: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Berat Perhiasan Ekspor (Gram)</label>
            <input
              type="number"
              className="form-input"
              value={invoice.weightGrams}
              onChange={e => setInvoice({ ...invoice, weightGrams: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Harga USD / Gram</label>
            <input
              type="number"
              className="form-input"
              value={invoice.pricePerGramUSD}
              onChange={e => setInvoice({ ...invoice, pricePerGramUSD: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(52,211,153,0.3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <span className="stat-lbl">Total Nilai Ekspor (USD)</span>
              <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.3rem' }}>${totalUSD.toLocaleString()} USD</div>
            </div>
            <div>
              <span className="stat-lbl">Nilai Kesetaraan IDR (Kurs 16.200)</span>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>Rp {totalIDR.toLocaleString()}</div>
            </div>
            <div>
              <span className="stat-lbl">Tarif Pajak PPN</span>
              <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.1rem' }}>0% (Bebas PPN Ekspor)</div>
            </div>
          </div>
        </div>

        <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Download size={18} /> Terbitkan & Cetak Commercial Export Invoice PDF
        </button>
      </div>
    </div>
  );
}
