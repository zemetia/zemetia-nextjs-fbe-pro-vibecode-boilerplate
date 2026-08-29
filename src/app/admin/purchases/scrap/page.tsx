'use client';

import { useState } from 'react';
import {
  Flame,
  Scale,
  Plus,
  Search,
  Printer,
  FileText,
  Sparkles,
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
import { useToast } from '@/hooks';

interface ScrapPurchaseItem {
  id: string;
  receiptNo: string;
  spkMeltingNo: string;
  date: string;
  supplierName: string;
  itemDescription: string;
  grossWeight: number;
  xrfPurity: number;
  pricePerFineGram: number;
  estimatedFineGold: number;
  totalAmount: number;
  paymentMethod: string;
  targetVault: string;
  targetVaultName: string;
  creditAccount: string;
  creditAccountName: string;
  status: string;
  createdAt: string;
}

const LOCAL_STORAGE_KEY = 'pttan_scrap_purchases_v2';

const SEED_SCRAP: ScrapPurchaseItem[] = [
  {
    id: 'SCR-202608-0001',
    receiptNo: 'NOTA-SCRAP-001',
    spkMeltingNo: 'SPK-MLT-001',
    date: '2026-08-28',
    supplierName: 'Toko Emas Sumber Rejeki Cikini',
    itemDescription: 'Pecahan Kalung & Cincin Emas Tua 750 (18K)',
    grossWeight: 250.5,
    xrfPurity: 75.2,
    pricePerFineGram: 1340000,
    estimatedFineGold: 188.38,
    totalAmount: 252429200,
    paymentMethod: 'CASH',
    targetVault: '1152',
    targetVaultName: 'Vault Pecahan Scrap & Leburan (Akun 1152)',
    creditAccount: '1110',
    creditAccountName: 'Kas Utama / Tunai (Akun 1110)',
    status: 'RECEIVED & STORED IN SCRAP VAULT',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

function getInitialScrapPurchases(): ScrapPurchaseItem[] {
  if (typeof window === 'undefined') return SEED_SCRAP;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ScrapPurchaseItem[]) : SEED_SCRAP;
  } catch {
    return SEED_SCRAP;
  }
}

export default function PurchasesScrapPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'create' | 'register' | 'melting-spk'>('create');
  const [scrapPurchases, setScrapPurchases] = useState<ScrapPurchaseItem[]>(getInitialScrapPurchases);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    receiptNo: '',
    spkMeltingNo: '',
    date: '2026-08-28',
    supplierName: 'Toko Emas Sumber Rejeki Cikini',
    itemDescription: 'Pecahan Kalung & Cincin Emas Tua 750 (18K)',
    grossWeight: 250.5,
    xrfPurity: 75.2,
    pricePerFineGram: 1340000,
    paymentMethod: 'CASH', // CASH, BANK_BCA, TEMPO
    targetVault: '1152', // 1152 (Vault Scrap) or 11502 (WIP Lebur)
    notes: 'Kadar diuji dengan alat XRF Spectrometer Lab QC',
  });

  const estimatedFineGold = Number(
    (((Number(formData.grossWeight) || 0) * (Number(formData.xrfPurity) || 0)) / 100).toFixed(2),
  );
  const totalAmount = Math.round(estimatedFineGold * (Number(formData.pricePerFineGram) || 0));

  const getCreditAccountInfo = (method: string) => {
    if (method === 'BANK_BCA') {
      return { code: '1111-IDR', name: 'Bank BCA IDR (Rekening Operasional)' };
    }
    if (method === 'TEMPO') {
      return { code: '2110', name: 'Hutang Usaha (Trade Payables)' };
    }
    return { code: '1110', name: 'Kas Utama / Tunai (Akun 1110)' };
  };

  const getTargetVaultName = (vaultCode: string) => {
    if (vaultCode === '11502') return 'Vault Emas WIP Leburan (Akun 11502)';
    if (vaultCode === '1157') return 'Vault Utama LM 999.9 (Akun 1157)';
    return 'Vault Pecahan Scrap & Leburan (Akun 1152)';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName || !formData.grossWeight || !formData.xrfPurity || !formData.pricePerFineGram) {
      toast.error('Mohon lengkapi Supplier, Berat Kotor, Kadar XRF, dan Harga Beli.');
      return;
    }

    const uniqueSuffix = `${scrapPurchases.length + 1}`.padStart(4, '0');
    const receiptNo = formData.receiptNo.trim() || `NOTA-SCRAP-${uniqueSuffix}`;
    const spkMeltingNo = formData.spkMeltingNo.trim() || `SPK-MLT-${uniqueSuffix}`;
    const creditAcc = getCreditAccountInfo(formData.paymentMethod);
    const targetVaultName = getTargetVaultName(formData.targetVault);

    const newScrap: ScrapPurchaseItem = {
      id: `SCR-${uniqueSuffix}`,
      receiptNo,
      spkMeltingNo,
      date: formData.date,
      supplierName: formData.supplierName,
      itemDescription: formData.itemDescription,
      grossWeight: Number(formData.grossWeight),
      xrfPurity: Number(formData.xrfPurity),
      pricePerFineGram: Number(formData.pricePerFineGram),
      estimatedFineGold,
      totalAmount,
      paymentMethod: formData.paymentMethod,
      targetVault: formData.targetVault,
      targetVaultName,
      creditAccount: creditAcc.code,
      creditAccountName: creditAcc.name,
      status:
        formData.targetVault === '11502'
          ? 'IN MELTING PROCESS (WIP)'
          : 'RECEIVED & STORED IN SCRAP VAULT',
      createdAt: new Date().toISOString(),
    };

    const updated = [newScrap, ...scrapPurchases];
    setScrapPurchases(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    toast.success(`Nota Scrap (${newScrap.receiptNo}) Tersimpan`);

    setActiveTab('register');
  };

  const filteredPurchases = scrapPurchases.filter(
    (p) =>
      p.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.spkMeltingNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.itemDescription?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography variant="h2" className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-rose-500" /> Pembelian Pecahan Scrap &amp; SPK Lebur
          </Typography>
          <Typography variant="muted">
            Pengujian Kadar XRF Spectrometer, Kalkulasi Fine Gold Murni, SPK Peleburan, &amp; Mutasi Vault 1152
          </Typography>
        </div>

        <div className="flex gap-2">
          <Button
            variant={activeTab === 'create' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('create')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Input Beli Scrap
          </Button>
          <Button
            variant={activeTab === 'register' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('register')}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Register Nota ({scrapPurchases.length})
          </Button>
          <Button
            variant={activeTab === 'melting-spk' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('melting-spk')}
            leftIcon={<Layers className="h-4 w-4" />}
          >
            Alur Lebur
          </Button>
        </div>
      </div>

      {activeTab === 'create' && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <Scale className="h-5 w-5" /> Form Input Pembelian Emas Scrap &amp; Uji Spektrometer
            </CardTitle>
            <CardDescription>
              Timbang berat kotor, masukkan hasil assay XRF %, dan sistem menghitung fine gold murni serta auto jurnal
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>No. Nota Pembelian Scrap</Label>
                  <Input
                    placeholder="Auto generated bila kosong"
                    value={formData.receiptNo}
                    onChange={(e) => setFormData({ ...formData, receiptNo: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Tanggal Transaksi</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Toko / Supplier Scrap Emas</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  >
                    <option value="Toko Emas Sumber Rejeki Cikini">Toko Emas Sumber Rejeki Cikini</option>
                    <option value="Toko Emas Mitra Sejahtera Jakarta">Toko Emas Mitra Sejahtera Jakarta</option>
                    <option value="Toko Emas Bintang Terang Surabaya">Toko Emas Bintang Terang Surabaya</option>
                    <option value="Perorangan / Individu">Perorangan / Individu</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label>Deskripsi Barang Scrap</Label>
                  <Input
                    placeholder="Contoh: Pecahan Kalung & Cincin 750 (18K)"
                    value={formData.itemDescription}
                    onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Berat Kotor Scrap (Gross Gram)</Label>
                  <NumberInput
                    decimalScale={4}
                    value={formData.grossWeight}
                    onChange={(val) => setFormData({ ...formData, grossWeight: Number(val) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Hasil Uji Kadar XRF Spectrometer (%)</Label>
                  <NumberInput
                    decimalScale={2}
                    value={formData.xrfPurity}
                    onChange={(val) => setFormData({ ...formData, xrfPurity: Number(val) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Harga Beli Fine Gold / Gram (IDR)</Label>
                  <NumberInput
                    value={formData.pricePerFineGram}
                    onChange={(val) => setFormData({ ...formData, pricePerFineGram: Number(val) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Metode Pembayaran</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="CASH">💵 Kas Tunai / Kas Utama (Akun 1110)</option>
                    <option value="BANK_BCA">🏦 Transfer Bank BCA IDR (Akun 1111-IDR)</option>
                    <option value="TEMPO">⏳ Hutang Usaha / Tempo (Akun 2110)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tujuan Alur Masuk Brankas</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.targetVault}
                    onChange={(e) => setFormData({ ...formData, targetVault: e.target.value })}
                  >
                    <option value="1152">🏛️ Simpan di Vault Pecahan Scrap (Akun 1152)</option>
                    <option value="11502">⚗️ Langsung Terbitkan SPK Lebur Ke WIP (Akun 11502)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>No. SPK Lebur</Label>
                  <Input
                    placeholder="Auto generated..."
                    value={formData.spkMeltingNo}
                    onChange={(e) => setFormData({ ...formData, spkMeltingNo: e.target.value })}
                  />
                </div>
              </div>

              {/* Real-time Calculation Summary Card */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
                <Typography variant="h4" className="text-rose-400 flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4" /> Kalkulasi Otomatis Konversi Kadar &amp; Penjurnalan SAK EMKM:
                </Typography>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted">Estimasi Emas Murni</p>
                    <p className="text-lg font-bold text-gold tabular-nums">
                      {formatNumber(estimatedFineGold)} Gram
                    </p>
                    <p className="text-[11px] text-foreground-subtle">
                      {formData.xrfPurity}% dari {formData.grossWeight}g
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Total Nilai Pembelian</p>
                    <p className="text-lg font-bold text-emerald tabular-nums">
                      {formatCurrency(totalAmount)}
                    </p>
                    <p className="text-[11px] text-foreground-subtle">
                      @{formatCurrency(formData.pricePerFineGram)} / g murni
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Akun Debet Jurnal</p>
                    <p className="text-xs font-bold text-sky mt-1">{getTargetVaultName(formData.targetVault)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Akun Kredit Jurnal</p>
                    <p className="text-xs font-bold text-amber-300 mt-1">
                      {getCreditAccountInfo(formData.paymentMethod).name}
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full">
                Simpan Nota Pembelian Scrap &amp; Auto-Jurnal Persediaan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'register' && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gold" /> Register Nota Pembelian Scrap
                </CardTitle>
                <CardDescription>
                  Daftar transaksi pembelian pecahan scrap perhiasan lengkap dengan hasil uji kadar XRF dan status vault
                </CardDescription>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  className="pl-9"
                  placeholder="Cari nota, supplier, SPK..."
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
                  <TableHead>No. Nota</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Supplier / Toko</TableHead>
                  <TableHead>Deskripsi Scrap</TableHead>
                  <TableHead className="text-right">Berat Kotor</TableHead>
                  <TableHead className="text-right">Kadar XRF</TableHead>
                  <TableHead className="text-right">Fine Gold</TableHead>
                  <TableHead className="text-right">Total Bayar</TableHead>
                  <TableHead>Vault Tujuan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.length === 0 ? (
                  <TableEmpty colSpan={10} message="Belum ada catatan pembelian scrap emas." />
                ) : (
                  filteredPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-mono font-bold text-foreground">{p.receiptNo}</span>
                      </TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{p.supplierName}</span>
                      </TableCell>
                      <TableCell>{p.itemDescription}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatNumber(p.grossWeight)} g
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-400">
                        {p.xrfPurity}%
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-gold">
                        {formatNumber(p.estimatedFineGold)} g
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald">
                        {formatCurrency(p.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.targetVault === '11502' ? 'WIP Lebur' : 'Vault Scrap'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.print()}
                          leftIcon={<Printer className="h-3.5 w-3.5" />}
                        >
                          Cetak
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

      {activeTab === 'melting-spk' && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-gold">
              <Flame className="h-5 w-5" /> Alur Peleburan Scrap Workshop PT TAN
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-sm text-foreground-muted">
            <p>
              1. <strong>Penerimaan &amp; Pengujian XRF:</strong> Pecahan perhiasan scrap ditimbang berat kotornya dan diuji kadar kemurniannya menggunakan mesin XRF Spectrometer.
            </p>
            <p>
              2. <strong>Penerbitan SPK Lebur:</strong> Emas scrap dari Vault Scrap (<code className="font-mono text-foreground">1152</code>) dipindahkan ke Vault WIP Leburan (<code className="font-mono text-foreground">11502</code>).
            </p>
            <p>
              3. <strong>Peleburan (Smelting) &amp; Granulasi:</strong> Emas dilebur di workshop in-house menjadi Granul Murni 999.9 atau Batangan Lokal.
            </p>
            <p>
              4. <strong>Settlement Hasil Leburan:</strong> Hasil granul murni masuk ke <strong>Vault Utama LM 999.9 (Akun 1157)</strong>, dan selisih susut lebur dibukukan ke <strong>Beban Susut Lebur (Akun 5120)</strong>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
