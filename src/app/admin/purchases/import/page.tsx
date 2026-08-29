'use client';

import { useState } from 'react';
import {
  Globe,
  Plus,
  RefreshCw,
  FileText,
  Search,
  Printer,
  ShieldCheck,
  Truck,
  DollarSign,
  Calculator,
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

interface ImportPOItem {
  id: string;
  poNumber: string;
  orderDate: string;
  supplierName: string;
  invoiceNumber: string;
  currency: string;
  paymentTerms: string;
  exchangeRate: number;
  unitMode: 'oz' | 'gram';
  quantityUnits: number;
  weightGrams: number;
  weightOz: number;
  baseAmountUSD: number;
  totalLandedCostIDR: number;
  logisticsPartner: string;
  barSerials: string;
  status: string;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEY = 'pttan_import_purchases_v3';
const OZ_TO_GRAM = 31.1034768;
const DEFAULT_RATE = 16250;

const SEED_ORDERS: ImportPOItem[] = [
  {
    id: 'IMP-0001',
    poNumber: 'PO-IMP-2026-001',
    orderDate: '2026-08-28',
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    invoiceNumber: 'INV-YLG-SG-2026-8812',
    currency: 'USD',
    paymentTerms: '100% Cash Before Delivery (Advance TT)',
    exchangeRate: DEFAULT_RATE,
    unitMode: 'oz',
    quantityUnits: 16000,
    weightGrams: Math.round(16000 * OZ_TO_GRAM * 100) / 100,
    weightOz: 16000,
    baseAmountUSD: 1300000,
    totalLandedCostIDR: 1300000 * DEFAULT_RATE,
    logisticsPartner: 'BRINKS Global Services',
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850',
    status: 'APPROVED & READY FOR TTB',
    paymentStatus: 'PAID',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

function getInitialOrders(): ImportPOItem[] {
  if (typeof window === 'undefined') return SEED_ORDERS;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ImportPOItem[]) : SEED_ORDERS;
  } catch {
    return SEED_ORDERS;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchasesImportPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [orders, setOrders] = useState<ImportPOItem[]>(getInitialOrders);
  const [unitMode, setUnitMode] = useState<'oz' | 'gram'>('oz');
  const [loadingRate, setLoadingRate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    poNumber: '',
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    orderDate: new Date().toISOString().slice(0, 10),
    currency: 'USD',
    invoiceNumber: 'INV-YLG-SG-2026-8812',
    paymentTerms: '100% Cash Before Delivery (Advance TT)',
    exchangeRate: DEFAULT_RATE,
    quantityUnits: 16000,
    baseAmountUSD: 1300000,
    logisticsPartner: 'BRINKS Global Services',
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850 (Brinks Vault Sealed)',
  });

  const totalWeightGrams = unitMode === 'oz' ? formData.quantityUnits * OZ_TO_GRAM : formData.quantityUnits;
  const totalWeightOz = unitMode === 'oz' ? formData.quantityUnits : formData.quantityUnits / OZ_TO_GRAM;
  const totalGoldAmountUSD = Number(formData.baseAmountUSD || 0);
  const effectivePricePerGramUSD = totalWeightGrams > 0 ? totalGoldAmountUSD / totalWeightGrams : 0;
  const effectivePricePerOzUSD = totalWeightOz > 0 ? totalGoldAmountUSD / totalWeightOz : 0;
  const totalLandedCostIDR = totalGoldAmountUSD * (Number(formData.exchangeRate) || DEFAULT_RATE);
  const unitLandedCostIDRPerGram = totalWeightGrams > 0 ? totalLandedCostIDR / totalWeightGrams : 0;

  const handleSyncRate = async () => {
    setLoadingRate(true);
    try {
      const res = await fetch('/api/exchange-rates');
      if (res.ok) {
        const data = await res.json() as { rate?: number };
        if (data?.rate) {
          setFormData((p) => ({ ...p, exchangeRate: data.rate! }));
          toast.success('Kurs Diperbarui', { description: `BCA e-Rate USD: Rp ${data.rate!.toLocaleString()}` });
        }
      } else {
        toast.info('Kurs Terkini', { description: `Kurs acuan: Rp ${formData.exchangeRate.toLocaleString()}` });
      }
    } catch {
      toast.info('Kurs Acuan', { description: `Kurs tersimpan: Rp ${formData.exchangeRate.toLocaleString()}` });
    } finally {
      setLoadingRate(false);
    }
  };

  const save = (updated: ImportPOItem[]) => {
    setOrders(updated);
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated)); } catch { /* noop */ }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.quantityUnits || !formData.baseAmountUSD || !formData.supplierName) {
      toast.error('Data Belum Lengkap', { description: 'Mohon lengkapi Jumlah Pesanan dan Total Nilai USD.' });
      return;
    }

    const suffix = String(orders.length + 1).padStart(4, '0');
    const poNumber = formData.poNumber.trim() || `PO-IMP-${suffix}`;

    const newPO: ImportPOItem = {
      id: `IMP-${suffix}`,
      poNumber,
      orderDate: formData.orderDate,
      supplierName: formData.supplierName,
      invoiceNumber: formData.invoiceNumber,
      currency: formData.currency,
      paymentTerms: formData.paymentTerms,
      exchangeRate: Number(formData.exchangeRate),
      unitMode,
      quantityUnits: Number(formData.quantityUnits),
      weightGrams: Math.round(totalWeightGrams * 100) / 100,
      weightOz: Math.round(totalWeightOz * 100) / 100,
      baseAmountUSD: totalGoldAmountUSD,
      totalLandedCostIDR,
      logisticsPartner: formData.logisticsPartner,
      barSerials: formData.barSerials,
      status: 'APPROVED & READY FOR TTB',
      paymentStatus: 'UNPAID',
      createdAt: new Date().toISOString(),
    };

    save([newPO, ...orders]);
    toast.success('✅ PO Impor Resmi Diterbitkan', {
      description: `PO: ${newPO.poNumber} — $${totalGoldAmountUSD.toLocaleString()} (${formatCurrency(totalLandedCostIDR)})`,
    });
    setActiveTab('register');
  };

  const filtered = orders.filter(
    (o) =>
      o.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography variant="h2" className="flex items-center gap-2">
            <Globe className="h-6 w-6" /> Pembelian LM Impor &amp; Landed Costing
          </Typography>
          <Typography variant="muted">
            Pengadaan LM Valas (YLG Singapore / LBMA), Kurs BCA e-Rate, Kargo BRINKS &amp; Bea Cukai
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'create' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('create')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Terbitkan PO Impor
          </Button>
          <Button
            variant={activeTab === 'register' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('register')}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Register PO ({orders.length})
          </Button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> Form PO Impor Logam Mulia (USD)
                </CardTitle>
                <CardDescription>
                  Kesepakatan harga all-in logam mulia impor luar negeri dengan kargo bersenjata
                </CardDescription>
              </div>
              {/* Unit Selector */}
              <div className="flex gap-1 rounded-lg border border-border bg-surface-subtle p-1">
                <Button
                  size="sm"
                  variant={unitMode === 'oz' ? 'primary' : 'ghost'}
                  onClick={() => setUnitMode('oz')}
                >
                  Troy Ounce (oz)
                </Button>
                <Button
                  size="sm"
                  variant={unitMode === 'gram' ? 'primary' : 'ghost'}
                  onClick={() => setUnitMode('gram')}
                >
                  Gram (g)
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* PO Number */}
                <div className="space-y-1.5">
                  <Label>Nomor PO Impor PT TAN</Label>
                  <Input
                    placeholder="Auto generated bila kosong"
                    value={formData.poNumber}
                    onChange={(e) => setFormData((p) => ({ ...p, poNumber: e.target.value }))}
                  />
                </div>

                {/* Tanggal */}
                <div className="space-y-1.5">
                  <Label>Tanggal Order PO</Label>
                  <Input
                    type="date"
                    value={formData.orderDate}
                    onChange={(e) => setFormData((p) => ({ ...p, orderDate: e.target.value }))}
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-1.5">
                  <Label>Supplier / Refiner Luar Negeri</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.supplierName}
                    onChange={(e) => setFormData((p) => ({ ...p, supplierName: e.target.value }))}
                  >
                    <option value="YLG Bullion Singapore Pte Ltd">YLG Bullion Singapore Pte Ltd</option>
                    <option value="Valcambi SA Switzerland">Valcambi SA Switzerland</option>
                    <option value="PAMP SA Switzerland">PAMP SA Switzerland</option>
                    <option value="Metalor Technologies Singapore">Metalor Technologies Singapore</option>
                    <option value="Singapore Precious Metals Exchange (SGPMX)">SGPMX Singapore</option>
                    <option value="Dubai Gold & Commodities Bullion">Dubai Gold &amp; Commodities Bullion</option>
                  </select>
                </div>

                {/* Invoice */}
                <div className="space-y-1.5">
                  <Label>No. Invoice / Proforma Supplier</Label>
                  <Input
                    placeholder="INV-YLG-SG-2026-8812"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  />
                </div>

                {/* Terms */}
                <div className="space-y-1.5">
                  <Label>Termin Pembayaran</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData((p) => ({ ...p, paymentTerms: e.target.value }))}
                  >
                    <option value="100% Cash Before Delivery (Advance TT)">100% Advance TT (Cash Before Delivery)</option>
                    <option value="Net 30 Days Credit">Net 30 Days Credit</option>
                    <option value="Letter of Credit (LC)">Letter of Credit (LC)</option>
                  </select>
                </div>

                {/* Kurs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Kurs BCA e-Rate USD/IDR</Label>
                    <button
                      type="button"
                      onClick={handleSyncRate}
                      disabled={loadingRate}
                      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingRate ? 'animate-spin' : ''}`} /> Sync Live
                    </button>
                  </div>
                  <NumberInput
                    value={formData.exchangeRate}
                    onChange={(val) => setFormData((p) => ({ ...p, exchangeRate: Number(val) || DEFAULT_RATE }))}
                  />
                </div>

                {/* Jumlah */}
                <div className="space-y-1.5">
                  <Label>Jumlah Pesanan ({unitMode === 'oz' ? 'Troy Oz' : 'Gram'})</Label>
                  <NumberInput
                    decimalScale={2}
                    value={formData.quantityUnits}
                    onChange={(val) => setFormData((p) => ({ ...p, quantityUnits: Number(val) || 0 }))}
                  />
                  <p className="text-xs text-foreground-muted">
                    Ekivalen: <strong>{formatNumber(Math.round(totalWeightGrams * 100) / 100)} g</strong> ({formatNumber(Math.round(totalWeightOz * 100) / 100)} oz)
                  </p>
                </div>

                {/* Total USD */}
                <div className="space-y-1.5">
                  <Label>Total Kesepakatan Nilai Beli (USD $)</Label>
                  <NumberInput
                    decimalScale={2}
                    value={formData.baseAmountUSD}
                    onChange={(val) => setFormData((p) => ({ ...p, baseAmountUSD: Number(val) || 0 }))}
                  />
                  <p className="text-xs text-foreground-muted">
                    Estimasi: <strong>${formatNumber(Math.round(effectivePricePerOzUSD * 100) / 100)}/oz</strong>{' '}
                    (${formatNumber(Math.round(effectivePricePerGramUSD * 100) / 100)}/g)
                  </p>
                </div>

                {/* Logistik */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Truck className="h-4 w-4" /> Kargo Pengamanan &amp; Pengiriman
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.logisticsPartner}
                    onChange={(e) => setFormData((p) => ({ ...p, logisticsPartner: e.target.value }))}
                  >
                    <option value="BRINKS Global Services">BRINKS Global Services (Armored Cargo)</option>
                    <option value="Malca-Amit Singapore">Malca-Amit Singapore</option>
                    <option value="Ferrari Logistics">Ferrari Logistics</option>
                    <option value="Loomis International">Loomis International</option>
                  </select>
                </div>

                {/* Bar serials */}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label>No. Seri Bar / Segel Koper (Bar Serial IDs)</Label>
                  <Input
                    placeholder="YLG-SG-998811 s/d YLG-SG-998850"
                    value={formData.barSerials}
                    onChange={(e) => setFormData((p) => ({ ...p, barSerials: e.target.value }))}
                  />
                </div>
              </div>

              {/* Landed Cost Calculator */}
              <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-3">
                <Typography variant="h4" className="flex items-center gap-2 text-sm">
                  <Calculator className="h-4 w-4" />
                  <ShieldCheck className="h-4 w-4" /> Kalkulasi Landed Cost &amp; Konversi Fisik Emas
                </Typography>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-foreground-muted">Total Berat (Gram)</p>
                    <p className="text-base font-bold tabular-nums">
                      {formatNumber(Math.round(totalWeightGrams * 100) / 100)} g
                    </p>
                    <p className="text-xs text-foreground-muted">
                      ({formatNumber(Math.round(totalWeightOz * 100) / 100)} oz)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Harga Efektif / Gram</p>
                    <p className="text-base font-bold tabular-nums">
                      ${formatNumber(Math.round(effectivePricePerGramUSD * 100) / 100)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      (${formatNumber(Math.round(effectivePricePerOzUSD * 100) / 100)}/oz)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Total Valuasi IDR</p>
                    <p className="text-base font-bold tabular-nums">{formatCurrency(totalLandedCostIDR)}</p>
                    <p className="text-xs text-foreground-muted">Kurs: Rp {formatNumber(formData.exchangeRate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Landed Cost / Gram</p>
                    <p className="text-base font-bold tabular-nums">
                      {formatCurrency(Math.round(unitLandedCostIDRPerGram))}
                    </p>
                    <p className="text-xs text-foreground-muted">BCA e-Rate Basis</p>
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full">
                🚀 Terbitkan Purchase Order Resmi (Langsung Jadi &amp; Siap TTB)
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
                  <Globe className="h-5 w-5" /> Riwayat Purchase Order LM Impor
                </CardTitle>
                <CardDescription>
                  Daftar kontrak pembelian emas impor valas, status dokumen pabean, dan progres kargo
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  className="pl-9"
                  placeholder="Cari PO, supplier, invoice..."
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
                  <TableHead>No. PO Impor</TableHead>
                  <TableHead>Supplier Refiner</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead className="text-right">Berat (g &amp; oz)</TableHead>
                  <TableHead className="text-right">Total USD</TableHead>
                  <TableHead className="text-right">Kurs</TableHead>
                  <TableHead className="text-right">Total IDR</TableHead>
                  <TableHead>Kargo</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableEmpty colSpan={9} message="Belum ada transaksi pembelian emas impor." />
                ) : (
                  filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <span className="font-mono font-bold">{o.poNumber}</span>
                        <span className="block text-xs text-foreground-muted">{o.orderDate}</span>
                      </TableCell>
                      <TableCell className="font-medium">{o.supplierName}</TableCell>
                      <TableCell className="font-mono text-xs text-foreground-muted">{o.invoiceNumber}</TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        {formatNumber(o.weightGrams)} g
                        <span className="block text-xs text-foreground-muted">({formatNumber(o.weightOz)} oz)</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        ${formatNumber(o.baseAmountUSD)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        Rp {formatNumber(o.exchangeRate)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        {formatCurrency(o.totalLandedCostIDR)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Truck className="h-3 w-3" /> {o.logisticsPartner}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.print()}
                          leftIcon={<Printer className="h-3.5 w-3.5" />}
                        >
                          Cetak PO
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
