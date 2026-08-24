import React, { useState, useEffect } from 'react';
import { PackageCheck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Warehouse, PlaneTakeoff, ShoppingCart } from 'lucide-react';
import {
  getPurchaseOrders,
  savePurchaseOrders,
  getSuppliers,
  getGoodsReceipts,
  saveGoodsReceipts,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber
} from '../services/storageService';
import { exportTTBPdf } from '../services/pdfService';
import {
  Modal,
  useModal,
  Combobox,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function GoodsReceiptPage() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    grnNumber: 'GRN-2026-001',
    date: new Date().toISOString().split('T')[0],
    selectedPOId: '',
    poNumber: 'PO-IMP-2026-001', // Ref No. Purchase Order PT TAN
    supplierName: 'Valcambi SA Switzerland (Overseas Refiner)',
    supplierDoNumber: 'SJ-SUP-VALCAMBI-998811', // No. Surat Jalan Supplier
    pibNo: '001234/PIB/KPU-TP/2026', // Dokumen Kepabeanan Impor saat TTB
    sppbNo: 'SPPB-009876/KPU.01/2026',
    mawbNo: 'SQ-618-99881122',
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
    setReceipts(getGoodsReceipts());
  };

  // Handler Pull From Purchase Order (PO)
  const handlePOSelect = (poId) => {
    const foundPO = purchaseOrders.find(p => (p.id === poId || p.poNumber === poId));
    if (foundPO) {
      const isImport = foundPO.type === 'import' || foundPO.currency === 'USD' || (foundPO.poNumber && foundPO.poNumber.includes('IMP'));
      const targetVault = isImport ? '1158' : '1157';
      const targetVaultName = isImport ? 'Vault Impor 999.9 (Akun 1158)' : 'Vault Utama LM 999.9 (Akun 1157)';
      const weight = foundPO.weightGrams || foundPO.quantityUnits || 1000;
      const unitPrice = foundPO.unitLandedCostIDRPerGram || foundPO.pricePerGramIDR || 1350000;
      const totalVal = foundPO.totalLandedCostIDR || (weight * unitPrice);

      setForm({
        ...form,
        selectedPOId: poId,
        poNumber: foundPO.poNumber || foundPO.id || poId,
        supplierName: foundPO.supplierName || 'Gold Supplier',
        supplierDoNumber: foundPO.supplierDoNumber || form.supplierDoNumber || 'SJ-SUP-998811',
        pibNo: foundPO.pibNo || form.pibNo || '',
        sppbNo: foundPO.sppbNo || form.sppbNo || '',
        mawbNo: foundPO.mawbNo || form.mawbNo || '',
        itemDescription: foundPO.itemDescription || (foundPO.items && foundPO.items[0]?.itemName) || 'Emas Batangan 999.9',
        barSerialNumbers: Array.isArray(foundPO.barSerialNumbers) ? foundPO.barSerialNumbers.join(', ') : (foundPO.barSerialNumbers || form.barSerialNumbers),
        targetVault,
        targetVaultName,
        receivedWeightGram: weight,
        unitPriceIDRPerGram: unitPrice,
        totalValueIDR: totalVal
      });
      showModal({
        variant: 'success',
        title: `✅ Data Ditarik Dari PO ${foundPO.poNumber}`,
        message: `• Supplier: ${foundPO.supplierName}\n• Berat: ${weight}g\nForm tanda terima sudah terisi otomatis.`
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.grnNumber || !form.supplierName || !form.receivedWeightGram || !form.poNumber || !form.supplierDoNumber) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi No TTB/GRN, Ref No. PO PT TAN, No. Surat Jalan Supplier, Supplier, dan Berat Emas.' });
      return;
    }

    const newGRN = {
      id: form.grnNumber,
      poNumber: form.poNumber,
      supplierDoNumber: form.supplierDoNumber,
      pibNo: form.pibNo || '',
      sppbNo: form.sppbNo || '',
      mawbNo: form.mawbNo || '',
      ...form,
      status: 'RECEIVED & VERIFIED',
      createdAt: new Date().toISOString()
    };

    // 1. Save Goods Receipt
    const list = getGoodsReceipts();
    list.unshift(newGRN);
    await saveGoodsReceipts(list);

    // 2. Auto Posting EMKM Journal & Update Vault Inventory
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: form.date,
      description: `Penerimaan Emas Fisik (${newGRN.grnNumber}) Ref PO PT TAN: ${newGRN.poNumber} | SJ: ${newGRN.supplierDoNumber}${newGRN.pibNo ? ` | PIB: ${newGRN.pibNo}` : ''} - ${newGRN.supplierName} [Vault: ${newGRN.targetVault}]`,
      lines: [
        { accountCode: form.targetVault, accountName: form.targetVaultName, debit: form.totalValueIDR, credit: 0 },
        { accountCode: '2111', accountName: 'Hutang Usaha (Trade Payables)', debit: 0, credit: form.totalValueIDR }
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    // Update PO status to received
    const storedPOs = getPurchaseOrders();
    const updatedPOs = storedPOs.map(p => {
      if (p.poNumber === form.poNumber || p.id === form.poNumber) {
        return { ...p, status: 'received', receivedAt: new Date().toISOString(), grnNumber: newGRN.grnNumber };
      }
      return p;
    });
    await savePurchaseOrders(updatedPOs);

    showModal({
      variant: 'success',
      title: `✅ Penerimaan Barang (TTB ${newGRN.grnNumber}) Tersimpan`,
      message: `• Ref PO PT TAN: ${newGRN.poNumber}\n• No. SJ Supplier: ${newGRN.supplierDoNumber}${newGRN.pibNo ? `\n• No. PIB: ${newGRN.pibNo}` : ''}\n• Stok Vault ${form.targetVaultName} bertambah ${newGRN.receivedWeightGram}g`
    });
    loadInitialData();
    setActiveView('list');
  };

  const filteredReceipts = receipts.filter(r =>
    r.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.supplierDoNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <PackageCheck color="#34d399" size={24} /> Tanda Terima Barang Vault (Goods Receipt Note - TTB)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Modul Penerimaan Fisik Emas Dengan Referensi No. PO PT TAN & Input No. Surat Jalan Supplier
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className={`btn-primary ${
                activeView === 'list'
                  ? 'bg-linear-135 from-emerald to-emerald-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('list')}
            >
              <PackageCheck size={18} /> Register Penerimaan TTB
            </button>
            <button
              className={`btn-primary ${
                activeView === 'create'
                  ? 'bg-linear-135 from-gold to-gold-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat TTB / Terima Barang Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE PENERIMAAN BARANG */}
      {activeView === 'list' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
            <h3 className="font-heading text-[1.1rem]">
              📋 Daftar Tanda Terima Barang (TTB / Goods Receipt Note) ({filteredReceipts.length})
            </h3>

            <div className="relative w-75">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
              <input
                className="form-input pl-9.5 w-full"
                placeholder="Cari TTB, PO PT TAN, SJ Supplier, atau Supplier..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. TTB (GRN)</TableHead>
                <TableHead>Ref No. PO PT TAN</TableHead>
                <TableHead>Surat Jalan & Dokumen Impor</TableHead>
                <TableHead>Tanggal Terima</TableHead>
                <TableHead>Supplier Emas</TableHead>
                <TableHead>Vault Tujuan</TableHead>
                <TableHead>Deskripsi Emas</TableHead>
                <TableHead className="text-right">Berat Gram Diterima</TableHead>
                <TableHead className="text-right">Total Valuasi IDR</TableHead>
                <TableHead>Status Verifikasi</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.length === 0 ? (
                <TableEmpty colSpan={11} message="Belum ada catatan penerimaan barang (TTB/GRN)." />
              ) : (
                filteredReceipts.map(r => (
                  <TableRow key={r.id || r.grnNumber}>
                    <TableCell><strong>{r.grnNumber}</strong></TableCell>
                    <TableCell><span className="badge badge-gold text-xs">{r.poNumber}</span></TableCell>
                    <TableCell>
                      <div><small className="text-sky-light font-semibold block">{r.supplierDoNumber || 'SJ-SUP-998811'}</small></div>
                      {(r.pibNo || r.sppbNo || r.mawbNo) && (
                        <div className="text-[0.7rem] text-fg-muted mt-0.5">
                          {r.pibNo && <div>PIB: <span className="text-[#93c5fd]">{r.pibNo}</span></div>}
                          {r.sppbNo && <div>SPPB: <span className="text-[#86efac]">{r.sppbNo}</span></div>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell><strong>{r.supplierName}</strong></TableCell>
                    <TableCell><span className="badge badge-emerald">{r.targetVaultName || r.targetVault}</span></TableCell>
                    <TableCell>{r.itemDescription}</TableCell>
                    <TableCell className="text-right font-extrabold text-sky-light">{r.receivedWeightGram} g</TableCell>
                    <TableCell className="text-right font-bold text-emerald-light">Rp {(r.totalValueIDR || 0).toLocaleString()}</TableCell>
                    <TableCell><span className="badge badge-emerald"><ShieldCheck className="inline mr-1" size={12} />{r.status || 'VERIFIED'}</span></TableCell>
                    <TableCell>
                      <button
                        className="btn-primary py-1.5 px-2.5 text-xs flex items-center gap-1 cursor-pointer"
                        onClick={async () => {
                          await exportTTBPdf(r);
                          showModal({
                            variant: 'success',
                            title: `🖨️ Cetak TTB / GRN ${r.grnNumber}`,
                            message: `Dokumen Tanda Terima Barang (TTB) ${r.grnNumber} berhasil di-generate dan dibuka di tab baru untuk langsung dicetak.\n\n• Ref PO PT TAN: ${r.poNumber}\n• SJ Supplier: ${r.supplierDoNumber || '-'}\n• Dokumen Kepabeanan:\n   - PIB: ${r.pibNo || '-'}\n   - SPPB: ${r.sppbNo || '-'}\n   - MAWB: ${r.mawbNo || '-'}\n• Supplier: ${r.supplierName}\n• Total Valuasi: Rp ${(r.totalValueIDR || 0).toLocaleString()}`
                          });
                        }}
                      >
                        <Printer size={14} /> Cetak TTB
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* VIEW 2: FORM CREATE GOODS RECEIPT */}
      {activeView === 'create' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-gold-light">
            ✍️ Form Input Tanda Terima Barang (TTB) Dengan Ref PO PT TAN & Surat Jalan Supplier
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM PURCHASE ORDER (PO) DROPDOWN */}
              <div className="form-group col-span-2 bg-[rgba(52,211,153,0.1)] p-3 rounded-sm border border-emerald-light">
                <label className="form-label text-emerald-light font-bold flex items-center gap-2">
                  <ShoppingCart size={18} /> Tarik Otomatis Dari Purchase Order PT TAN (PO Impor / Lokal):
                </label>
                <Combobox className="bg-ink text-white font-semibold"
                  value={form.selectedPOId}
                  onChange={handlePOSelect}
                  placeholder="-- (Pilih No. Purchase Order PO PT TAN Untuk Auto-Fill) --"
                  searchPlaceholder="Cari nomor PO, supplier, atau barang…"
                  emptyText="Nomor PO tidak ditemukan."
                  options={purchaseOrders.map(po => ({
                    value: po.poNumber,
                    label: `[${po.poNumber}] ${po.supplierName} - ${po.itemDescription || 'Emas Batangan'} (${po.weightGrams}g)`
                  }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Tanda Terima Barang (TTB / GRN Number)</label>
                <input
                  className="form-input"
                  value={form.grnNumber}
                  onChange={e => setForm({ ...form, grnNumber: e.target.value })}
                />
              </div>

              {/* NOMOR PURCHASE ORDER (PO PT TAN) */}
              <div className="form-group">
                <label className="form-label text-gold-light font-bold">Ref No. Purchase Order (PO PT TAN)</label>
                <input
                  className="form-input border border-gold text-gold-light font-bold"
                  value={form.poNumber}
                  onChange={e => setForm({ ...form, poNumber: e.target.value, selectedPOId: e.target.value })}
                />
              </div>

              {/* INPUT NOMOR SURAT JALAN SUPPLIER */}
              <div className="form-group">
                <label className="form-label text-sky-light font-bold">No. Surat Jalan Supplier (Supplier Delivery Note)</label>
                <input
                  className="form-input border border-sky-light text-sky-light font-bold"
                  placeholder="Nomor Surat Jalan dari Supplier..."
                  value={form.supplierDoNumber}
                  onChange={e => setForm({ ...form, supplierDoNumber: e.target.value })}
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

              {/* DOKUMEN IMPOR & KEPABEANAN (DIINPUT SAAT PENERIMAAN BARANG / TTB) */}
              <div className="form-group col-span-2 bg-[rgba(59,130,246,0.08)] p-4 rounded-[10px] border border-blue">
                <label className="form-label text-[#60a5fa] font-bold flex items-center gap-1.5 mb-3 text-[0.95rem]">
                  <FileText size={18} /> Dokumen Impor & Kepabeanan (Customs Clearance Saat TTB)
                </label>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                  <div>
                    <label className="form-label text-[0.8rem] text-[#93c5fd]">1. No. PIB (Pemberitahuan Impor)</label>
                    <input
                      type="text"
                      className="form-input border border-blue text-[#60a5fa] font-semibold"
                      placeholder="Contoh: 001234/PIB/KPU-TP/2026"
                      value={form.pibNo || ''}
                      onChange={e => setForm({ ...form, pibNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label text-[0.8rem] text-[#86efac]">2. No. SPPB (Persetujuan Pengeluaran)</label>
                    <input
                      type="text"
                      className="form-input border border-[#22c55e] text-[#4ade80] font-semibold"
                      placeholder="Contoh: SPPB-009876/KPU.01/2026"
                      value={form.sppbNo || ''}
                      onChange={e => setForm({ ...form, sppbNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label text-[0.8rem] text-[#fcd34d]">3. No. MAWB (Master Air Waybill)</label>
                    <input
                      type="text"
                      className="form-input border border-gold text-gold-light font-semibold"
                      placeholder="Contoh: SQ-618-99881122"
                      value={form.mawbNo || ''}
                      onChange={e => setForm({ ...form, mawbNo: e.target.value })}
                    />
                  </div>
                </div>
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

              <div className="form-group col-span-2">
                <label className="form-label">Nomor Seri Bar / Lot Serial Numbers</label>
                <input
                  className="form-input"
                  value={form.barSerialNumbers}
                  onChange={e => setForm({ ...form, barSerialNumbers: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Deskripsi Fisik Barang Diterima</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label text-emerald-light font-bold">Berat Fisik Emas Diterima (Gram)</label>
                <NumberInput
                  allowDecimal
                  className="border border-emerald-light text-emerald-light font-bold"
                  value={form.receivedWeightGram}
                  onChange={receivedWeightGram => setForm({
                    ...form,
                    receivedWeightGram,
                    totalValueIDR: receivedWeightGram * (form.unitPriceIDRPerGram || 1350000)
                  })}
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 mx-0 border border-[rgba(52,211,153,0.4)]">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <div>
                  <span className="stat-lbl">Total Valuasi Fisik Diterima (IDR)</span>
                  <div className="font-extrabold text-emerald-light text-[1.4rem]">
                    Rp {(form.totalValueIDR || (form.receivedWeightGram * (form.unitPriceIDRPerGram || 0))).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Posting Penambahan Stok</span>
                  <div className="font-extrabold text-sky-light text-[1.1rem]">
                    Debet: Akun {form.targetVault} ({form.targetVaultName})
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary bg-[linear-gradient(135deg,_#10b981,_#059669)]">
              <CheckCircle2 size={18} /> Simpan Tanda Terima Barang (TTB) & Tambah Stok Vault
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
