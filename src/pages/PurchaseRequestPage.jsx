import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Printer, CheckCircle, Clock, AlertTriangle, ShieldCheck, ArrowRight, Trash2, Layers, Tag, CheckSquare, Search, Filter } from 'lucide-react';
import { getMasterItems, getSuppliers, createPurchaseOrder } from '../services/storageService';

export default function PurchaseRequestPage() {
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [masterItems, setMasterItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form State
  const [form, setForm] = useState({
    prNumber: `PR-${Date.now().toString().slice(-6)}`,
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    department: 'Refinery & Lab QC',
    requesterName: 'Staf Lab Pemurnian',
    priority: 'Normal', // Normal, Urgent
    notes: 'Kebutuhan bahan kimia asam nitrat & perlengkapan safety lab',
    items: [
      {
        itemId: 'CHEM-HNO3-68',
        itemCode: 'CHEM-HNO3-68',
        itemName: 'Asam Nitrat (HNO3 68% Technical Grade)',
        quantity: 5,
        unit: 'Jerigen (30kg)',
        estUnitPrice: 450000,
        notes: 'Untuk proses parting pemurnian emas'
      }
    ]
  });

  const [newItem, setNewItem] = useState({
    itemId: '',
    itemCode: '',
    itemName: 'Sarung Tangan Kulit Tahan Panas 500°C',
    quantity: 10,
    unit: 'Pasang',
    estUnitPrice: 85000,
    notes: 'Safety operator peleburan'
  });

  useEffect(() => {
    setMasterItems(getMasterItems());
    setSuppliers(getSuppliers());
    loadRequests();
  }, []);

  const loadRequests = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_purchase_requests') || [
        {
          id: 'PR-2026-001',
          prNumber: 'PR-2026-001',
          requestDate: '2026-08-12',
          requiredDate: '2026-08-16',
          department: 'Refinery & Lab QC',
          requesterName: 'Ahmad (Operator Refineri)',
          priority: 'Urgent',
          status: 'APPROVED',
          notes: 'Stok kowi lebur habis untuk proses casting perhiasan',
          items: [
            { itemCode: 'CRU-CLAY-10KG', itemName: 'Kowi Crucible Grafit 10kg', quantity: 4, unit: 'pcs', estUnitPrice: 650000, subtotal: 2600000 }
          ],
          totalEstAmount: 2600000,
          approvedBy: 'Direktur Operasional',
          createdAt: new Date().toISOString()
        },
        {
          id: 'PR-2026-002',
          prNumber: 'PR-2026-002',
          requestDate: '2026-08-14',
          requiredDate: '2026-08-18',
          department: 'Produksi Perhiasan',
          requesterName: 'Budi (Kepala Casting)',
          priority: 'Normal',
          status: 'PENDING',
          notes: 'Kebutuhan master alloy copper/silver untuk kadar 750',
          items: [
            { itemCode: 'ALLOY-750-ITA', itemName: 'Master Alloy Italy Yellow Gold 750', quantity: 2, unit: 'kg', estUnitPrice: 1200000, subtotal: 2400000 }
          ],
          totalEstAmount: 2400000,
          createdAt: new Date().toISOString()
        }
      ];
      setRequests(stored);
      window.Storage.set('pttan_purchase_requests', stored);
    }
  };

  const handleAddItem = () => {
    if (!newItem.itemName || !newItem.quantity) {
      alert('Nama barang dan jumlah kuantitas wajib diisi.');
      return;
    }
    const itemToAdd = {
      ...newItem,
      subtotal: Number(newItem.quantity) * Number(newItem.estUnitPrice || 0)
    };
    setForm(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));
    setNewItem({
      itemId: '',
      itemCode: '',
      itemName: '',
      quantity: 1,
      unit: 'pcs',
      estUnitPrice: 0,
      notes: ''
    });
  };

  const handleRemoveItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleCreatePR = (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      alert('Minimal 1 item barang yang diajukan dalam PR.');
      return;
    }

    const totalEstAmount = form.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.estUnitPrice || 0)), 0);

    const newPR = {
      id: `PR-${Date.now().toString().slice(-6)}`,
      prNumber: `PR-${Date.now().toString().slice(-6)}`,
      requestDate: form.requestDate,
      requiredDate: form.requiredDate,
      department: form.department,
      requesterName: form.requesterName,
      priority: form.priority,
      notes: form.notes,
      items: form.items,
      totalEstAmount,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get('pttan_purchase_requests') || [];
      list.unshift(newPR);
      window.Storage.set('pttan_purchase_requests', list);
      alert(`✅ Purchase Request (${newPR.prNumber}) Berhasil Diajukan!\n• Departemen: ${newPR.department}\n• Total Estimasi: Rp ${totalEstAmount.toLocaleString()}\n• Status: PENDING APPROVAL`);
      loadRequests();
      setShowForm(false);
    }
  };

  const handleApprovePR = (prId) => {
    if (!confirm('Setujui Purchase Request (PR) ini?')) return;
    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get('pttan_purchase_requests') || [];
      const updated = list.map(pr => pr.id === prId ? { ...pr, status: 'APPROVED', approvedBy: 'Owner / Direktur' } : pr);
      window.Storage.set('pttan_purchase_requests', updated);
      alert('🎉 Purchase Request Berhasil Disetujui (APPROVED)! Siap Diterbitkan Menjadi PO.');
      loadRequests();
    }
  };

  // Convert Approved PR to Purchase Order (1-Klik)
  const handleConvertToPO = async (pr) => {
    if (!confirm(`Konversi PR (${pr.prNumber}) menjadi Purchase Order (PO) Resmi?`)) return;

    const poPayload = {
      supplier: 'SUPP-GENERAL-01',
      supplierName: 'Mitra Kimia & Alat Laboratorium',
      orderDate: new Date().toISOString().split('T')[0],
      currency: 'IDR',
      exchangeRate: 1,
      status: 'approved',
      reference: pr.prNumber,
      notes: `Diterbitkan dari PR ${pr.prNumber} (${pr.department} - Pemohon: ${pr.requesterName})`,
      items: pr.items.map(item => ({
        itemId: item.itemId || item.itemCode || 'ITEM-GEN',
        itemCode: item.itemCode || 'ITEM-GEN',
        itemName: item.itemName,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.estUnitPrice || 0)
      }))
    };

    const res = await createPurchaseOrder(poPayload);
    if (res.success) {
      // Update PR Status to CONVERTED
      if (typeof window !== 'undefined' && window.Storage) {
        const list = window.Storage.get('pttan_purchase_requests') || [];
        const updated = list.map(p => p.id === pr.id ? { ...p, status: 'CONVERTED TO PO', convertedPoNumber: res.order?.poNumber } : p);
        window.Storage.set('pttan_purchase_requests', updated);
      }
      alert(`🎉 BERHASIL! PO Pembelian Resmi Diterbitkan dari PR (${pr.prNumber})!\n• No. PO: ${res.order?.poNumber}\n• Status: APPROVED`);
      loadRequests();
    } else {
      alert('Gagal membuat PO: ' + JSON.stringify(res.errors));
    }
  };

  const filteredRequests = requests.filter(pr => {
    if (statusFilter !== 'ALL' && pr.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return pr.prNumber.toLowerCase().includes(q) || pr.department.toLowerCase().includes(q) || pr.requesterName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList color="#f59e0b" size={24} /> Purchase Request (PR - Permintaan Pengadaan Barang & Kimia)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Alur Pengajuan Kebutuhan Non-Emas (Bahan Kimia, Kowi Lebur, Safety, Consumables) & Konversi 1-Klik ke PO
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Ajukan Purchase Request (PR) Baru
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ maxWidth: '220px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua Status PR</option>
              <option value="PENDING">PENDING APPROVAL</option>
              <option value="APPROVED">APPROVED (SIAP PO)</option>
              <option value="CONVERTED TO PO">CONVERTED TO PO</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              className="form-input"
              placeholder="Cari nomor PR, departemen, nama pemohon..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Form Create PR */}
        {showForm && (
          <form onSubmit={handleCreatePR} style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Pengajuan Permintaan Pembelian Barang (PR)</h4>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Departemen Pemohon</label>
                <select
                  className="form-select"
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                >
                  <option value="Refinery & Lab QC">Refinery & Lab QC (Peleburan & Pemurnian)</option>
                  <option value="Produksi Perhiasan">Produksi Perhiasan & Casting</option>
                  <option value="Gudang Brankas Vault">Gudang Brankas Vault</option>
                  <option value="General Affair & Safety">General Affair & Keselamatan Kerja (K3)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Pemohon (Requester)</label>
                <input
                  className="form-input"
                  style={{ fontWeight: 700, color: '#fbbf24' }}
                  value={form.requesterName}
                  onChange={e => setForm({ ...form, requesterName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Pengajuan</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.requestDate}
                  onChange={e => setForm({ ...form, requestDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Dibutuhkan (Target)</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.requiredDate}
                  onChange={e => setForm({ ...form, requiredDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tingkat Prioritas</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent (Mendesak Produksi)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Keperluan / Keterangan Kebutuhan</label>
                <input
                  className="form-input"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Sub-Form Item List */}
            <div style={{ marginTop: '20px', background: 'rgba(15,23,42,0.6)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <h5 style={{ color: '#38bdf8', marginBottom: '12px', fontSize: '0.9rem' }}>📦 Daftar Barang yang Diminta:</h5>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Nama Barang</label>
                  <input
                    className="form-input"
                    placeholder="Nama barang / kimia..."
                    value={newItem.itemName}
                    onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Jumlah</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Satuan</label>
                  <input
                    className="form-input"
                    placeholder="pcs / kg / liter"
                    value={newItem.unit}
                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Est. Harga (Rp)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newItem.estUnitPrice}
                    onChange={e => setNewItem({ ...newItem, estUnitPrice: Number(e.target.value) })}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '8px 14px' }}
                  onClick={handleAddItem}
                >
                  <Plus size={16} /> Tambah
                </button>
              </div>

              {/* Items Table in Form */}
              <table className="custom-table" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Jumlah</th>
                    <th>Satuan</th>
                    <th style={{ textAlign: 'right' }}>Est. Harga</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx}>
                      <td><strong>{it.itemName}</strong></td>
                      <td>{it.quantity}</td>
                      <td>{it.unit}</td>
                      <td style={{ textAlign: 'right' }}>Rp {Number(it.estUnitPrice || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        Rp {(Number(it.quantity) * Number(it.estUnitPrice || 0)).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <CheckCircle size={16} /> Ajukan Purchase Request (PR)
            </button>
          </form>
        )}
      </div>

      {/* PR Table List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Purchase Request / Pengajuan Barang ({filteredRequests.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PR</th>
                <th>Tgl Pengajuan</th>
                <th>Departemen & Pemohon</th>
                <th>Rincian Kebutuhan Item</th>
                <th style={{ textAlign: 'right' }}>Total Estimasi</th>
                <th>Prioritas</th>
                <th>Status PR</th>
                <th>Aksi & Konversi PO</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data Purchase Request (PR).
                  </td>
                </tr>
              ) : (
                filteredRequests.map(pr => (
                  <tr key={pr.id || pr.prNumber}>
                    <td><strong style={{ color: '#38bdf8' }}>{pr.prNumber}</strong></td>
                    <td>{pr.requestDate}</td>
                    <td>
                      <strong>{pr.department}</strong><br/>
                      <small style={{ color: 'var(--text-muted)' }}>Pemohon: {pr.requesterName}</small>
                    </td>
                    <td>
                      {(pr.items || []).map((it, i) => (
                        <div key={i} style={{ fontSize: '0.8rem' }}>
                          • {it.itemName} ({it.quantity} {it.unit})
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                      Rp {(pr.totalEstAmount || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${pr.priority === 'Urgent' ? 'badge-rose' : 'badge-gold'}`} style={{ fontSize: '0.75rem' }}>
                        {pr.priority}
                      </span>
                    </td>
                    <td>
                      {pr.status === 'PENDING' && <span className="badge badge-gold">⏳ PENDING APPROVAL</span>}
                      {pr.status === 'APPROVED' && <span className="badge badge-emerald">🟢 APPROVED</span>}
                      {pr.status === 'CONVERTED TO PO' && (
                        <span className="badge badge-blue">🚀 PO TERBIT ({pr.convertedPoNumber || 'PO-GEN'})</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {pr.status === 'PENDING' && (
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            onClick={() => handleApprovePR(pr.id)}
                          >
                            <CheckSquare size={13} /> Setujui (Approve)
                          </button>
                        )}
                        {pr.status === 'APPROVED' && (
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #38bdf8, #0284c7)' }}
                            onClick={() => handleConvertToPO(pr)}
                          >
                            <ArrowRight size={13} /> Terbitkan PO
                          </button>
                        )}
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          onClick={() => alert(`🖨️ Mencetak PDF Formulir Purchase Request ${pr.prNumber} (${pr.department})...`)}
                        >
                          <Printer size={13} /> Cetak PR
                        </button>
                      </div>
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
