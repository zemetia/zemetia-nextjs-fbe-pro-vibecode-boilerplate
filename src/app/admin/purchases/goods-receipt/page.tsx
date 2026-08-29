'use client';

import { useState } from 'react';
import {
  PackageCheck,
  Plus,
  Search,
  Printer,
  FileText,
  Warehouse,
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
import { formatNumber } from '@/lib/number';
import { useToast } from '@/hooks';

interface GoodsReceiptItem {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplierDoNumber: string;
  date: string;
  supplierName: string;
  pibNo?: string;
  sppbNo?: string;
  mawbNo?: string;
  targetVault: string;
  targetVaultName: string;
  safeBoxSlot: string;
  securitySealNo: string;
  itemDescription: string;
  barSerialNumbers: string;
  assayCertificateNo: string;
  documentWeightGram: number;
  receivedWeightGram: number;
  weightDiscrepancyGram: number;
  unitPriceIDRPerGram: number;
  totalValueIDR: number;
  status: string;
  notes: string;
  createdAt: string;
}

const LOCAL_STORAGE_KEY = 'pttan_goods_receipts_v2';

const SEED_RECEIPTS: GoodsReceiptItem[] = [
  {
    id: 'GRN-2026-001',
    grnNumber: 'GRN-2026-001',
    poNumber: 'PO-IMP-2026-001',
    supplierDoNumber: 'SJ-SUP-VALCAMBI-998811',
    date: '2026-08-28',
    supplierName: 'Valcambi SA Switzerland',
    pibNo: '001234/PIB/KPU-TP/2026',
    sppbNo: 'SPPB-009876/KPU.01/2026',
    mawbNo: 'SQ-618-99881122',
    targetVault: '1158',
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    safeBoxSlot: 'BRANKAS-01 / LACI-A1',
    securitySealNo: 'SEAL-BRINKS-99120',
    itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
    barSerialNumbers: 'VAL-99120, VAL-99121',
    assayCertificateNo: 'ASSAY-VAL-88912',
    documentWeightGram: 1000,
    receivedWeightGram: 1000,
    weightDiscrepancyGram: 0,
    unitPriceIDRPerGram: 1350000,
    totalValueIDR: 1350000000,
    status: 'RECEIVED & VERIFIED',
    notes: 'Kondisi fisik emas dan segel Certificate Assay utuh 100%.',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

function getInitialReceipts(): GoodsReceiptItem[] {
  if (typeof window === 'undefined') return SEED_RECEIPTS;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as GoodsReceiptItem[]) : SEED_RECEIPTS;
  } catch {
    return SEED_RECEIPTS;
  }
}

export default function PurchasesGoodsReceiptPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'register' | 'create'>('register');
  const [receipts, setReceipts] = useState<GoodsReceiptItem[]>(getInitialReceipts);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    grnNumber: '',
    date: '2026-08-28',
    poNumber: 'PO-IMP-2026-001',
    supplierName: 'Valcambi SA Switzerland',
    supplierDoNumber: 'SJ-SUP-VALCAMBI-998811',
    pibNo: '001234/PIB/KPU-TP/2026',
    sppbNo: 'SPPB-009876/KPU.01/2026',
    mawbNo: 'SQ-618-99881122',
    targetVault: '1158',
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    safeBoxSlot: 'BRANKAS-01 / LACI-A1',
    securitySealNo: 'SEAL-BRINKS-99120',
    itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
    barSerialNumbers: 'VAL-99120, VAL-99121',
    assayCertificateNo: 'ASSAY-VAL-88912',
    documentWeightGram: 1000,
    receivedWeightGram: 1000,
    unitPriceIDRPerGram: 1350000,
    totalValueIDR: 1350000000,
    notes: 'Kondisi fisik emas dan segel Certificate Assay utuh 100%.',
  });

  const discrepancy = Number(
    ((Number(form.receivedWeightGram) || 0) - (Number(form.documentWeightGram) || 0)).toFixed(3),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierName || !form.receivedWeightGram || !form.poNumber || !form.supplierDoNumber) {
      toast.error(
        'Mohon lengkapi Ref No. PO PT TAN, No. Surat Jalan Supplier, Supplier, dan Berat Emas.',
      );
      return;
    }

    const uniqueSuffix = `${String(receipts.length + 1).padStart(4, '0')}`;
    const grnNo = form.grnNumber.trim() || `TTB-${uniqueSuffix}`;

    const newGRN: GoodsReceiptItem = {
      id: grnNo,
      grnNumber: grnNo,
      poNumber: form.poNumber,
      supplierDoNumber: form.supplierDoNumber,
      date: form.date,
      supplierName: form.supplierName,
      pibNo: form.pibNo,
      sppbNo: form.sppbNo,
      mawbNo: form.mawbNo,
      targetVault: form.targetVault,
      targetVaultName: form.targetVaultName,
      safeBoxSlot: form.safeBoxSlot,
      securitySealNo: form.securitySealNo,
      itemDescription: form.itemDescription,
      barSerialNumbers: form.barSerialNumbers,
      assayCertificateNo: form.assayCertificateNo,
      documentWeightGram: Number(form.documentWeightGram),
      receivedWeightGram: Number(form.receivedWeightGram),
      weightDiscrepancyGram: discrepancy,
      unitPriceIDRPerGram: Number(form.unitPriceIDRPerGram),
      totalValueIDR: Number(form.totalValueIDR),
      status: 'RECEIVED & VERIFIED',
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };

    const updated = [newGRN, ...receipts];
    setReceipts(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    toast.success(`Penerimaan Barang (TTB ${newGRN.grnNumber}) Tersimpan`);

    setActiveTab('register');
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.supplierDoNumber?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Typography variant="h2" className="flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-emerald" /> Penerimaan Barang Vault (TTB / GRN)
          </Typography>
          <Typography variant="muted">
            Tanda Terima Barang Fisik Brankas, Referensi PO &amp; Surat Jalan Supplier, Komparator Timbangan, &amp; Dokumen Pabean
          </Typography>
        </div>

        <div className="flex gap-2">
          <Button
            variant={activeTab === 'register' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('register')}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Register TTB ({receipts.length})
          </Button>
          <Button
            variant={activeTab === 'create' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('create')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Buat TTB Baru
          </Button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-emerald">
              <Warehouse className="h-5 w-5" /> Formulir Tanda Terima Barang Vault (TTB)
            </CardTitle>
            <CardDescription>
              Catat fisik emas yang tiba di brankas vault, bandingkan berat timbangan dengan surat jalan, dan input segel keamanan
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Nomor TTB (GRN)</Label>
                  <Input
                    placeholder="Auto generated bila kosong"
                    value={form.grnNumber}
                    onChange={(e) => setForm({ ...form, grnNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Tanggal Terima Fisik</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Ref No. Purchase Order PT TAN</Label>
                  <Input
                    placeholder="Contoh: PO-IMP-2026-001"
                    value={form.poNumber}
                    onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Supplier Emas</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  >
                    <option value="Valcambi SA Switzerland">Valcambi SA Switzerland</option>
                    <option value="YLG Bullion Singapore Pte Ltd">YLG Bullion Singapore Pte Ltd</option>
                    <option value="PT Pegadaian (Persero) Jakarta">PT Pegadaian (Persero) Jakarta</option>
                    <option value="PT Antam Tbk (UBPP LM Jakarta)">PT Antam Tbk (UBPP LM Jakarta)</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>No. Surat Jalan (DO) Supplier</Label>
                  <Input
                    placeholder="No. SJ Supplier..."
                    value={form.supplierDoNumber}
                    onChange={(e) => setForm({ ...form, supplierDoNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vault / Brankas Tujuan</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.targetVault}
                    onChange={(e) => {
                      const val = e.target.value;
                      const name =
                        val === '1158'
                          ? 'Vault Impor 999.9 (Akun 1158)'
                          : val === '1157'
                            ? 'Vault Utama LM 999.9 (Akun 1157)'
                            : 'Vault Scrap & Leburan (Akun 1152)';
                      setForm({ ...form, targetVault: val, targetVaultName: name });
                    }}
                  >
                    <option value="1158">🏛️ Vault Impor 999.9 (Akun 1158)</option>
                    <option value="1157">🏛️ Vault Utama LM 999.9 (Akun 1157)</option>
                    <option value="1152">🏛️ Vault Scrap &amp; Leburan (Akun 1152)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Lokasi Slot / Laci Brankas</Label>
                  <Input
                    placeholder="Contoh: BRANKAS-01 / LACI-A1"
                    value={form.safeBoxSlot}
                    onChange={(e) => setForm({ ...form, safeBoxSlot: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>No. Segel Keamanan Kargo</Label>
                  <Input
                    placeholder="Contoh: SEAL-BRINKS-99120"
                    value={form.securitySealNo}
                    onChange={(e) => setForm({ ...form, securitySealNo: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>No. PIB (Pemberitahuan Impor Barang)</Label>
                  <Input
                    placeholder="Jika impor (opsional)..."
                    value={form.pibNo}
                    onChange={(e) => setForm({ ...form, pibNo: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label>Deskripsi Barang &amp; No. Seri Bar</Label>
                  <Input
                    placeholder="Contoh: Emas Batangan 999.9 Cast Bar 1kg | Seri: VAL-99120, VAL-99121"
                    value={form.itemDescription}
                    onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Berat Dokumen SJ (Gram)</Label>
                  <NumberInput
                    decimalScale={4}
                    value={form.documentWeightGram}
                    onChange={(val) => setForm({ ...form, documentWeightGram: Number(val) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Berat Aktual Timbangan Vault (Gram)</Label>
                  <NumberInput
                    decimalScale={4}
                    value={form.receivedWeightGram}
                    onChange={(val) => setForm({ ...form, receivedWeightGram: Number(val) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Selisih Timbangan (Discrepancy)</Label>
                  <div
                    className={`h-9 px-3 flex items-center rounded-md border text-sm font-mono font-bold ${
                      discrepancy === 0
                        ? 'border-emerald/30 bg-emerald/10 text-emerald'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {discrepancy >= 0 ? `+${discrepancy}` : discrepancy} g (
                    {discrepancy === 0 ? 'Cocok 100%' : 'Ada Selisih'})
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full">
                Simpan Penerimaan Barang (TTB) &amp; Posting Masuk Vault
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
                  <PackageCheck className="h-5 w-5 text-emerald" /> Daftar Tanda Terima Barang (TTB / GRN)
                </CardTitle>
                <CardDescription>
                  Daftar seluruh penerimaan fisik emas brankas vault dengan nomor dokumen pabean dan segel keamanan
                </CardDescription>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  className="pl-9"
                  placeholder="Cari TTB, PO, supplier, SJ..."
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
                  <TableHead>No. TTB (GRN)</TableHead>
                  <TableHead>Ref No. PO</TableHead>
                  <TableHead>Surat Jalan &amp; PIB</TableHead>
                  <TableHead>Tanggal Terima</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Vault Tujuan &amp; Slot</TableHead>
                  <TableHead className="text-right">Berat Terima</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableEmpty colSpan={9} message="Belum ada catatan tanda terima barang (TTB)." />
                ) : (
                  filteredReceipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-mono font-bold text-foreground">{r.grnNumber}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground-muted">{r.poNumber}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground font-semibold">{r.supplierDoNumber}</span>
                        {r.pibNo && (
                          <span className="block text-[11px] text-foreground-muted">PIB: {r.pibNo}</span>
                        )}
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{r.supplierName}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.targetVaultName}</Badge>
                        <span className="block text-[11px] text-foreground-muted">{r.safeBoxSlot}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-gold">
                        {formatNumber(r.receivedWeightGram)} g
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" dot>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.print()}
                          leftIcon={<Printer className="h-3.5 w-3.5" />}
                        >
                          Cetak TTB
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
