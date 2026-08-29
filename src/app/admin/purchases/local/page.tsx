'use client';

import { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Printer,
  Package,
  Wallet,
  FileText,
  UserCheck,
  Truck,
  MapPin,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  Coins,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/Badge';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import { formatCurrency, formatNumber } from '@/lib/number';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalPurchaseItem {
  id: string;
  receiptNo: string;
  poNumber: string;
  orderDate: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  quantityGrams: number;
  unitPriceIDR: number;
  totalAmount: number;
  paymentMode: 'cash' | 'credit';
  courierName: string;
  courierDocNo: string;
  pickupLocation: string;
  paymentSourceAccount: string;
  paymentSourceAccountName: string;
  barCertificateNo: string;
  barCountDetected: number;
  ownerApprovedBy: string;
  ownerApproved: boolean;
  status: string;
  isVaultReceived: boolean;
  paidAmountIDR: number;
  remainingBalanceIDR: number;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEY = 'pttan_local_purchases_v3';

const SEED_PURCHASES: LocalPurchaseItem[] = [
  {
    id: 'LP-0001',
    receiptNo: 'KW-LOKAL-001',
    poNumber: 'CASH-BUY-KW-001',
    orderDate: '2026-08-28',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    quantityGrams: 1000,
    unitPriceIDR: 1350000,
    totalAmount: 1350000000,
    paymentMode: 'cash',
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
    courierDocNo: 'SK-KURIR-0801',
    pickupLocation: 'Pegadaian Cabang Senen Jakarta',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    barCertificateNo: 'ANT-99101, ANT-99102',
    barCountDetected: 2,
    ownerApprovedBy: 'Direktur Utama PT TAN',
    ownerApproved: true,
    status: 'RECEIVED & STOCKED IN VAULT (VERIFIED)',
    isVaultReceived: true,
    paidAmountIDR: 1350000000,
    remainingBalanceIDR: 0,
    paymentStatus: 'PAID',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

function getInitialPurchases(): LocalPurchaseItem[] {
  if (typeof window === 'undefined') return SEED_PURCHASES;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as LocalPurchaseItem[]) : SEED_PURCHASES;
  } catch {
    return SEED_PURCHASES;
  }
}

function getDetectedBarCount(text: string): number {
  if (!text) return 0;
  return text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchasesLocalPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [purchases, setPurchases] = useState<LocalPurchaseItem[]>(getInitialPurchases);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    receiptNo: '',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    orderDate: new Date().toISOString().slice(0, 10),
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    quantityGrams: 0,
    unitPriceIDR: 0,
    barCertificateNo: '',
    courierName: '',
    courierDocNo: '',
    pickupLocation: '',
    ownerApprovedBy: 'Direktur Utama PT TAN',
    ownerApproved: true,
  });

  const totalAmount = (formData.quantityGrams || 0) * (formData.unitPriceIDR || 0);
  const detectedBarCount = getDetectedBarCount(formData.barCertificateNo);

  const MASTER_ITEMS = [
    { code: 'LM-PEGADAIAN-1KG', name: 'Emas Batangan Pegadaian 1kg (999.9)', category: 'Emas Murni', purity: 99.99 },
    { code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)', category: 'Emas Murni', purity: 99.99 },
    { code: 'LM-ANTAM-100G', name: 'Emas Batangan Antam 100g (999.9)', category: 'Emas Murni', purity: 99.99 },
    { code: 'GOLD-GRANULE-9999', name: 'Granul Emas Murni 999.9', category: 'Emas Murni', purity: 99.99 },
    { code: 'GOLD-SCRAP-LEBUR', name: 'Emas Rongsok / Scrap Leburan (Hasil Uji)', category: 'Scrap', purity: 95.0 },
  ];

  const handleItemSelect = (code: string) => {
    const item = MASTER_ITEMS.find((i) => i.code === code);
    if (item) setFormData((p) => ({ ...p, itemCode: item.code, itemName: item.name }));
  };

  const handleAccountChange = (acc: string) => {
    const name =
      acc === '1111-IDR' ? 'Bank BCA IDR (Akun 1111-IDR)' :
      acc === '1110'     ? 'Kas Utama PT TAN (Akun 1110)'  :
                           'Kas Kecil Operasional (Akun 11101)';
    setFormData((p) => ({ ...p, paymentSourceAccount: acc, paymentSourceAccountName: name }));
  };

  const save = (updated: LocalPurchaseItem[]) => {
    setPurchases(updated);
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated)); } catch { /* noop */ }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.quantityGrams || !formData.unitPriceIDR || !formData.supplierName) {
      toast.error('Data Belum Lengkap', { description: 'Mohon lengkapi Supplier, Jumlah Gram, dan Harga Satuan.' });
      return;
    }
    const isCash = paymentMode === 'cash';
    if (isCash && !formData.courierName) {
      toast.error('Nama Kurir Diperlukan', { description: 'Pembelian tunai direct wajib mencantumkan nama kurir pengambil emas.' });
      return;
    }

    const uid = `LP-${String(purchases.length + 1).padStart(4, '0')}`;
    const finalNo = formData.receiptNo.trim() || (isCash ? `KW-LOKAL-${uid.slice(-4)}` : `PO-LOKAL-${uid.slice(-4)}`);

    const newItem: LocalPurchaseItem = {
      id: uid,
      paymentMode,
      receiptNo: finalNo,
      poNumber: isCash ? `CASH-BUY-${finalNo}` : finalNo,
      orderDate: formData.orderDate ?? new Date().toISOString().split('T')[0],
      supplierName: formData.supplierName,
      itemCode: formData.itemCode,
      itemName: formData.itemName,
      quantityGrams: Number(formData.quantityGrams),
      unitPriceIDR: Number(formData.unitPriceIDR),
      totalAmount,
      courierName: formData.courierName,
      courierDocNo: formData.courierDocNo,
      pickupLocation: formData.pickupLocation,
      paymentSourceAccount: isCash ? formData.paymentSourceAccount : '2110',
      paymentSourceAccountName: isCash ? formData.paymentSourceAccountName : 'Hutang Usaha (Akun 2110)',
      barCertificateNo: formData.barCertificateNo,
      barCountDetected: detectedBarCount,
      ownerApprovedBy: formData.ownerApprovedBy,
      ownerApproved: true,
      status: isCash ? 'IN TRANSIT (DIAMBIL KURIR DI PEGADAIAN)' : 'RECEIVED (CREDIT TEMPO)',
      isVaultReceived: false,
      paidAmountIDR: isCash ? totalAmount : 0,
      remainingBalanceIDR: isCash ? 0 : totalAmount,
      paymentStatus: isCash ? 'PAID' : 'UNPAID',
      createdAt: new Date().toISOString(),
    };

    save([newItem, ...purchases]);
    toast.success(
      isCash ? '✅ Tahap 1 Tersimpan (Transit 1159)' : '✅ Pembelian Kredit Tempo Tersimpan',
      {
        description: isCash
          ? `Debet 1159 (Transit Kurir) vs Kredit ${newItem.paymentSourceAccountName} ${formatCurrency(totalAmount)}`
          : `PO: ${newItem.poNumber}`,
      },
    );
    setActiveTab('register');
  };

  const handleConfirmVault = (item: LocalPurchaseItem) => {
    const updated = purchases.map((p) =>
      p.id === item.id
        ? { ...p, status: 'RECEIVED & STOCKED IN VAULT (VERIFIED)', isVaultReceived: true }
        : p,
    );
    save(updated);
    toast.success('🎉 Tahap 2 Sukses — Fisik Emas Masuk Vault', {
      description: `Debet 1157 (Vault Utama) +${item.quantityGrams}g vs Kredit 1159 (Transit Kurir) ${formatCurrency(item.totalAmount)}`,
    });
  };

  const filtered = purchases.filter(
    (p) =>
      p.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.itemName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography variant="h2" className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-[color:var(--color-gold)]" />
            Pembelian &amp; Trading LM Lokal IDR
          </Typography>
          <Typography variant="muted">
            Alur 2-Tahap SAK EMKM: Transit Kurir (Akun 1159) ➔ Vault Utama (Akun 1157)
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'create' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('create')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Input Pembelian Baru
          </Button>
          <Button
            variant={activeTab === 'register' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('register')}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Register ({purchases.length})
          </Button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" /> Form Transaksi Pembelian Emas Lokal
                </CardTitle>
                <CardDescription>Pilih mode tunai direct dengan kurir atau mode tempo/kredit PO</CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg border border-border bg-surface-subtle p-1">
                <Button
                  size="sm"
                  variant={paymentMode === 'cash' ? 'primary' : 'ghost'}
                  onClick={() => setPaymentMode('cash')}
                  leftIcon={<Wallet className="h-4 w-4" />}
                >
                  💵 Tunai Direct (Transit 1159 ➔ Vault 1157)
                </Button>
                <Button
                  size="sm"
                  variant={paymentMode === 'credit' ? 'primary' : 'ghost'}
                  onClick={() => setPaymentMode('credit')}
                  leftIcon={<FileText className="h-4 w-4" />}
                >
                  📝 Tempo (PO)
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Alur Alert */}
            {paymentMode === 'cash' ? (
              <div className="mb-6 rounded-lg border border-border bg-surface-subtle p-4 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <ArrowRightLeft className="h-4 w-4" /> Alur 2-Tahap Akuntansi &amp; Kontrol Fisik Brankas
                </p>
                <p className="text-foreground-muted">
                  • <strong>Tahap 1 (Transfer Bayar)</strong>: Debet{' '}
                  <code className="text-primary">1159</code> (Emas Dalam Perjalanan Kurir) vs Kredit Kas/Bank{' '}
                  <code className="text-primary">1111</code>.
                </p>
                <p className="text-foreground-muted">
                  • <strong>Tahap 2 (Fisik Tiba di Brankas)</strong>: Klik Konfirmasi Vault ➔ Debet{' '}
                  <code className="text-primary">1157</code> vs Kredit <code className="text-primary">1159</code>.
                </p>
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-border bg-surface-subtle p-4 text-xs">
                <p className="font-bold text-sm">Mode Pembelian Kredit Supplier (Purchase Order PO)</p>
                <p className="text-foreground-muted">
                  Generate PO dan mencatat ke Hutang Usaha (Akun 2110).
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* No Nota */}
                <div className="space-y-1.5">
                  <Label>{paymentMode === 'cash' ? 'No. Nota / Kuitansi' : 'No. PO Pembelian'}</Label>
                  <Input
                    placeholder="Auto generated bila kosong"
                    value={formData.receiptNo}
                    onChange={(e) => setFormData((p) => ({ ...p, receiptNo: e.target.value }))}
                  />
                </div>

                {/* Tanggal */}
                <div className="space-y-1.5">
                  <Label>Tgl Transaksi</Label>
                  <Input
                    type="date"
                    value={formData.orderDate}
                    onChange={(e) => setFormData((p) => ({ ...p, orderDate: e.target.value }))}
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-1.5">
                  <Label>Supplier / Tempat Beli Emas</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.supplierName}
                    onChange={(e) => setFormData((p) => ({ ...p, supplierName: e.target.value }))}
                  >
                    <option value="PT Pegadaian (Persero) Jakarta">PT Pegadaian (Persero) Jakarta</option>
                    <option value="PT Antam Tbk (UBPP LM Jakarta)">PT Antam Tbk (UBPP LM Jakarta)</option>
                    <option value="PT UBS Fine Gold (Surabaya)">PT UBS Fine Gold (Surabaya)</option>
                    <option value="Toko Emas Mitra Sejahtera Jakarta">Toko Emas Mitra Sejahtera Jakarta</option>
                  </select>
                </div>

                {/* Master Barang */}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="flex items-center gap-1.5">
                    <Package className="h-4 w-4" /> Pilih Produk Dari Master Kode Barang Emas
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.itemCode}
                    onChange={(e) => handleItemSelect(e.target.value)}
                  >
                    {MASTER_ITEMS.map((it) => (
                      <option key={it.code} value={it.code}>
                        [{it.code}] {it.name} ({it.category} - {it.purity}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kurir */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Truck className="h-4 w-4" /> Nama Kurir Pengambil Emas
                  </Label>
                  <Input
                    placeholder="Nama kurir yang ditugaskan"
                    value={formData.courierName}
                    onChange={(e) => setFormData((p) => ({ ...p, courierName: e.target.value }))}
                  />
                </div>

                {/* No Surat Kuasa */}
                <div className="space-y-1.5">
                  <Label>No. Surat Kuasa / Tugas Kurir</Label>
                  <Input
                    placeholder="No. Surat Kuasa..."
                    value={formData.courierDocNo}
                    onChange={(e) => setFormData((p) => ({ ...p, courierDocNo: e.target.value }))}
                  />
                </div>

                {/* Lokasi */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> Lokasi Pengambilan
                  </Label>
                  <Input
                    placeholder="Pegadaian Cabang Senen..."
                    value={formData.pickupLocation}
                    onChange={(e) => setFormData((p) => ({ ...p, pickupLocation: e.target.value }))}
                  />
                </div>

                {/* Sumber Bayar */}
                {paymentMode === 'cash' && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4" /> Sumber Rekening Bayar Tunai
                    </Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      value={formData.paymentSourceAccount}
                      onChange={(e) => handleAccountChange(e.target.value)}
                    >
                      <option value="1111-IDR">Bank BCA IDR (Akun 1111-IDR)</option>
                      <option value="1110">Kas Utama PT TAN (Akun 1110)</option>
                      <option value="11101">Kas Kecil Operasional (Akun 11101)</option>
                    </select>
                  </div>
                )}

                {/* Gram */}
                <div className="space-y-1.5">
                  <Label>Total Berat Fisik Emas (Gram)</Label>
                  <NumberInput
                    decimalScale={4}
                    value={formData.quantityGrams}
                    onChange={(val) => setFormData((p) => ({ ...p, quantityGrams: Number(val) || 0 }))}
                  />
                </div>

                {/* Harga satuan */}
                <div className="space-y-1.5">
                  <Label>Harga Satuan Beli (IDR / Gram)</Label>
                  <NumberInput
                    value={formData.unitPriceIDR}
                    onChange={(val) => setFormData((p) => ({ ...p, unitPriceIDR: Number(val) || 0 }))}
                  />
                </div>

                {/* Bar serials */}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4" /> Multi No. Sertifikat / Nomor Seri Batangan (Pisahkan koma)
                  </Label>
                  <Input
                    placeholder="Contoh: ANT-99120, ANT-99121, ANT-99122"
                    value={formData.barCertificateNo}
                    onChange={(e) => setFormData((p) => ({ ...p, barCertificateNo: e.target.value }))}
                  />
                  {detectedBarCount > 0 && (
                    <p className="text-xs text-foreground-muted">
                      📦 <strong>{detectedBarCount} batang</strong> terdeteksi
                    </p>
                  )}
                </div>

                {/* Otorisasi */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4" /> Otorisasi TTD Direktur
                  </Label>
                  <Input
                    placeholder="Nama Direktur Utama..."
                    value={formData.ownerApprovedBy}
                    onChange={(e) => setFormData((p) => ({ ...p, ownerApprovedBy: e.target.value }))}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-border bg-surface-subtle p-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">Total Berat Fisik</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(formData.quantityGrams)} Gram</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Total Nilai Pembelian</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Otorisasi</p>
                  <p className="text-xs font-semibold flex items-center gap-1 mt-1">
                    <UserCheck className="h-4 w-4" /> {formData.ownerApprovedBy}
                  </p>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full">
                {paymentMode === 'cash'
                  ? 'Simpan & Jurnal Tahap 1 (Debet 1159 Transit Kurir)'
                  : 'Terbitkan PO Kredit (Hutang 2110)'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" /> Register Riwayat Pembelian Emas Lokal
                </CardTitle>
                <CardDescription>
                  Status kurir transit, konfirmasi serah terima fisik brankas, dan riwayat jurnal
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  className="pl-9"
                  placeholder="Cari nota, supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Nota / PO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Kurir</TableHead>
                  <TableHead>Barang &amp; Seri</TableHead>
                  <TableHead className="text-right">Berat</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableEmpty colSpan={8} message="Belum ada transaksi pembelian emas lokal." />
                ) : (
                  filtered.map((p) => {
                    const certs = (p.barCertificateNo || '')
                      .split(/[\n,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-mono font-bold">{p.receiptNo}</span>
                          <span className="block text-xs text-foreground-muted">{p.orderDate}</span>
                        </TableCell>
                        <TableCell>
                          {p.isVaultReceived ? (
                            <Badge variant="success" dot>VAULT (1157)</Badge>
                          ) : (
                            <Badge variant="warning" dot>TRANSIT (1159)</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{p.supplierName}</span>
                          <span className="block text-xs text-foreground-muted">
                            <MapPin className="inline h-3 w-3 mr-0.5" />
                            {p.pickupLocation}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Truck className="h-3 w-3" /> {p.courierName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{p.itemName}</span>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {certs.slice(0, 3).map((c, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-surface-subtle px-1 rounded border border-border"
                              >
                                #{i + 1}: {c}
                              </span>
                            ))}
                            {certs.length > 3 && (
                              <span className="text-[10px] text-foreground-muted">
                                +{certs.length - 3} lagi
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold tabular-nums">
                          {formatNumber(p.quantityGrams)} g
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold tabular-nums">
                          {formatCurrency(p.totalAmount)}
                        </TableCell>
                        <TableCell>
                          {!p.isVaultReceived ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleConfirmVault(p)}
                              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            >
                              Konfirmasi Vault
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.print()}
                              leftIcon={<Printer className="h-3.5 w-3.5" />}
                            >
                              Cetak
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
