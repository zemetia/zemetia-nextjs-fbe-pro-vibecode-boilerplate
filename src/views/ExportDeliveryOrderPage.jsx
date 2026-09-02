import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Printer, CheckCircle2, ShieldCheck, FileText, Package, Award, Tag, MoreHorizontal } from 'lucide-react';
import {
  apiErrorMessage,
  metalLotService,
  salesDeliveryService,
  salesInvoiceService,
  salesOrderService,
  storageLocationService
} from '../services';
import { exportExportDeliveryOrderPdf } from '../services/pdfService';
import {
  Modal,
  useModal,
  toast,
  Combobox,
  NumberInput,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '../components/ui';

export default function ExportDeliveryOrderPage() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    doNumber: 'DO-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
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

  const loadInitialData = async () => {
    try {
      // 1. Invoices ekspor (dari database)
      const invoices = await salesInvoiceService.list({ type: 'EXPORT', limit: 100 });
      setInvoices((invoices.items || []).map(inv => ({
        id: inv.id,
        invoiceNo: inv.number,
        orderId: inv.orderId,
        soNumber: inv.orderNumber,
        customerPONumber: '',
        buyerName: inv.orderNumber,
        country: '',
        pebNumber: inv.pebNumber || '',
        awbNumber: inv.awbNumber || '',
        itemDescription: inv.items?.[0]?.productName ?? '',
        weightGrams: inv.items?.[0]?.weightGram ?? 0
      })));

      // 2. Delivery Orders ekspor (dari database)
      const deliveries = await salesDeliveryService.list({ type: 'EXPORT', limit: 100 });
      setDeliveryOrders((deliveries.items || []).map(d => ({
        id: d.id,
        doNumber: d.number,
        soNumber: d.orderNumber,
        invoiceNo: '',
        customerPONumber: '',
        date: d.date,
        buyerName: d.recipientName || d.orderNumber,
        country: '',
        courierName: d.carrierName || 'Brinks Global Secured Transport',
        awbNumber: d.awbNumber || '',
        pebNumber: d.pebNumber || '',
        securitySealNo: '',
        boxCount: 0,
        itemDescription: '',
        netWeightGram: d.totalWeightGram || 0,
        grossWeightGram: d.totalWeightGram || 0,
        status: d.statusLabel,
        createdAt: d.createdAt
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data surat jalan ekspor.'));
    }
  };

  const handleInvoiceSelect = (invNo) => {
    const foundInv = invoices.find(i => (i.id === invNo || i.invoiceNo === invNo));
    if (foundInv) {
      setForm({
        ...form,
        selectedInvoiceNo: invNo,
        soNumber: foundInv.soNumber || 'SO-EXP-2026-001',
        customerPONumber: foundInv.customerPONumber || form.customerPONumber || '',
        buyerName: foundInv.buyerName,
        country: foundInv.country,
        pebNumber: foundInv.pebNumber || 'PEB-2026-088912',
        awbNumber: foundInv.awbNumber || 'AWB-FEDEX-99881122',
        itemDescription: foundInv.itemDescription,
        netWeightGram: foundInv.weightGrams,
        grossWeightGram: Math.round(foundInv.weightGrams * 1.25)
      });
      toast.success(`Data ditarik dari Invoice ${foundInv.invoiceNo}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.doNumber || !form.buyerName || !form.netWeightGram || !form.soNumber) {
      toast.warning('Mohon lengkapi No. Surat Jalan, Ref Sales Order (SO), Buyer, dan Berat Barang.');
      return;
    }

    try {
      // Cari invoice & SO acuan dari database
      const foundInv = invoices.find(i => i.invoiceNo === form.selectedInvoiceNo || i.id === form.selectedInvoiceNo);
      const orderId = foundInv?.orderId;

      if (!orderId) {
        toast.warning('Pilih Faktur Ekspor (INV-EXP) terlebih dahulu — data SO ditarik dari faktur.');
        return;
      }

      const soDetail = await salesOrderService.detail(orderId);
      const orderItem = soDetail.items[0];
      if (!orderItem) {
        toast.warning('SO ini belum punya baris barang.');
        return;
      }

      // Cari lot stok tersedia untuk produk ini
      const lots = await metalLotService.list({ in_stock: true, limit: 100 });
      const matchingLot = (lots.items || []).find(l => l.productId === orderItem.productId && !l.isDepleted);
      if (!matchingLot) {
        toast.warning('Tidak ada lot stok tersedia untuk produk ini — pastikan stok sudah masuk via TTB terlebih dahulu.');
        return;
      }
      const locations = await storageLocationService.list();
      const location = locations[0];
      if (!location) {
        toast.warning('Belum ada lokasi penyimpanan aktif.');
        return;
      }

      // Buat Surat Jalan Ekspor (draft) lalu konfirmasi — mutasi ISSUE & jurnal HPP lahir di sini
      const delivery = await salesDeliveryService.create({
        type: 'EXPORT',
        order_id: orderId,
        date: form.date,
        delivery_method: 'EXPEDITION',
        recipient_name: form.buyerName,
        carrier_name: form.courierName || undefined,
        awb_number: form.awbNumber || undefined,
        peb_number: form.pebNumber || undefined,
        gold_certificate_no: form.goldCertificateNo || undefined,
        purity_certificate_no: form.purityCertificateNo || undefined,
        box_count: form.boxCount || 1,
        lines: [{
          order_item_id: orderItem.id,
          lot_id: matchingLot.id,
          location_id: location.id,
          gross_weight_gram: Number(form.netWeightGram),
          purity_percent: Number(orderItem.purityPercent)
        }],
        charges: [],
        notes: undefined
      });
      await salesDeliveryService.confirm(delivery.id, 'EXPORT');

      // Muat ulang register dari database
      const deliveries = await salesDeliveryService.list({ type: 'EXPORT', limit: 100 });
      setDeliveryOrders((deliveries.items || []).map(d => ({
        id: d.id,
        doNumber: d.number,
        soNumber: d.orderNumber,
        invoiceNo: '',
        customerPONumber: '',
        date: d.date,
        buyerName: d.recipientName || d.orderNumber,
        country: '',
        courierName: d.carrierName || 'Brinks Global Secured Transport',
        awbNumber: d.awbNumber || '',
        pebNumber: d.pebNumber || '',
        securitySealNo: '',
        boxCount: 0,
        itemDescription: '',
        netWeightGram: d.totalWeightGram || 0,
        grossWeightGram: d.totalWeightGram || 0,
        status: d.statusLabel,
        createdAt: d.createdAt
      })));

      showModal({
        variant: 'success',
        title: `✅ Surat Jalan Ekspor (${delivery.number}) Diterbitkan`,
        message: `• Ref SO: ${soDetail.number} | Ref Invoice: ${foundInv.invoiceNo}\n• Pengeluaran Fisik: ${Number(form.netWeightGram).toLocaleString('id-ID')}g dari stok vault\n• Jurnal HPP Diposting otomatis (Debet HPP vs Kredit Persediaan) saat konfirmasi.`
      });
      setActiveView('list');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menerbitkan surat jalan ekspor.'));
    }
  };

  const filteredDO = deliveryOrders.filter(d =>
    d.doNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.customerPONumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.soNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.buyerName?.toLowerCase().includes(searchQuery.toLowerCase())
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
                placeholder="Cari Surat Jalan, PO Cust, SO, Invoice..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Surat Jalan</TableHead>
                <TableHead>Ref Sales Order (SO)</TableHead>
                <TableHead>Ref Invoice</TableHead>
                <TableHead>Tanggal Kirim</TableHead>
                <TableHead>Buyer Overseas</TableHead>
                <TableHead>No. Sertifikat Emas</TableHead>
                <TableHead>No. Sertifikat Kadar</TableHead>
                <TableHead className="text-right">Net Weight (g)</TableHead>
                <TableHead>Status Shipping</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDO.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada surat jalan ekspor (delivery order)." />
              ) : (
                filteredDO.map(d => (
                  <TableRow key={d.id || d.doNumber}>
                    <TableCell>
                      <strong>{d.doNumber}</strong>
                      {d.customerPONumber && (
                        <small className="text-fg-muted block text-xs">PO Cust: {d.customerPONumber}</small>
                      )}
                    </TableCell>
                    <TableCell><span className="badge badge-gold text-xs">{d.soNumber || 'SO-EXP-2026-001'}</span></TableCell>
                    <TableCell><small className="text-emerald-light">{d.invoiceNo}</small></TableCell>
                    <TableCell>{d.date}</TableCell>
                    <TableCell><strong>{d.buyerName}</strong></TableCell>
                    <TableCell><small className="text-sky-light font-semibold">{d.goldCertificateNo || 'CERT-GOLD-998812'}</small></TableCell>
                    <TableCell><small className="text-orange-light font-semibold">{d.purityCertificateNo || 'ASSAY-750-0012'}</small></TableCell>
                    <TableCell className="text-right font-bold text-gold-light">{d.netWeightGram} g</TableCell>
                    <TableCell><span className="badge badge-emerald">{d.status || 'SHIPPED'}</span></TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${d.doNumber}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={async () => {
                              await exportExportDeliveryOrderPdf(d);
                              toast.success(`Dokumen Surat Jalan Ekspor (${d.doNumber}) siap dicetak.`);
                            }}
                            className="flex items-center gap-2 cursor-pointer text-sky-light hover:bg-sky/10 focus:bg-sky/10 focus:text-sky-light"
                          >
                            <Printer className="h-4 w-4 text-sky-light" />
                            <span>Cetak Surat Jalan Ekspor</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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

              <div className="form-group">
                <label className="form-label">No. PO Customer (Buyer PO)</label>
                <input
                  className="form-input font-semibold text-gold-light"
                  placeholder="Contoh: PO-DMCC-2026-8899"
                  value={form.customerPONumber}
                  onChange={e => setForm({ ...form, customerPONumber: e.target.value })}
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
                <label className="form-label text-orange-light font-bold">No. Sertifikat Kadar (Purity Assay Cert)</label>
                <input
                  className="form-input border border-orange text-orange-light font-bold"
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
