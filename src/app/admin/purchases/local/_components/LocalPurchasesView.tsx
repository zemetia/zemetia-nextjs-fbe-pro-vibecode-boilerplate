'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Trash2, CheckCircle2, Ban, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import {
  apiErrorMessage,
  metalPurchaseService,
  purchaseRequestService,
  type MetalPurchaseItemPayload,
  type MetalPurchaseWritePayload,
} from '@/services';
import { toDateOnly, today } from '@/lib/date';
import {
  METAL_PURCHASE_NUMBER_LABELS,
  METAL_PURCHASE_PAYMENT_TYPE_LABELS,
  METAL_PURCHASE_PRICE_SCALE,
  METAL_PURCHASE_STATUS_BADGE,
} from '@/lib/metal-purchase';
import { formatCurrency, roundTo } from '@/lib/number';
import { convertPricePerUnit, convertWeight, WEIGHT_UNIT_LABELS } from '@/lib/weight';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import { PartnerPicker } from '@/components/shared/PartnerPicker';
import { ProductPicker } from '@/components/shared/ProductPicker';
import type { PartnerVO, ProductVO, WeightUnit } from '@/types/value-objects';

const PAGE_SIZE = 20;

const PAYMENT_TYPE_OPTIONS = [
  { value: 'DP', label: METAL_PURCHASE_PAYMENT_TYPE_LABELS.DP ?? 'DP (Direct Payment)' },
  { value: 'PO', label: METAL_PURCHASE_PAYMENT_TYPE_LABELS.PO ?? 'PO (Tempo)' },
];

/**
 * Dua tombol, bukan dropdown — satuan yang sedang berlaku adalah keterangan
 * yang dibaca berkali-kali sambil mengetik, bukan pilihan yang dibuka sekali
 * lalu ditutup (sama seperti di form PO impor).
 */
const WEIGHT_UNIT_TABS = [
  { value: 'GRAM', label: WEIGHT_UNIT_LABELS.GRAM },
  { value: 'TROY_OUNCE', label: WEIGHT_UNIT_LABELS.TROY_OUNCE },
] as const satisfies readonly { value: WeightUnit; label: string }[];

interface ItemDraft {
  key: string;
  product?: ProductVO;
  /** Satuan berat baris ini — harga per satuan mengikutinya, lihat `withWeightUnit()`. */
  weightUnit: WeightUnit;
  weight?: number;
  purityPercent?: number;
  /** Harga per satu satuan `weightUnit`. */
  pricePerUnit?: number;
  /**
   * Buffer nilai dua arah, tidak pernah dikirim ke API. Nilai yang tersimpan
   * selalu turunan harga × berat; ini menampung apa yang sedang diketik, dan
   * dikembalikan ke angka turunannya saat kolomnya ditinggalkan (`commitAmount`).
   */
  amount?: number;
  /** Baris PR asal, saat draft ini datang dari "Konversi ke PO". */
  purchaseRequestItemId?: string;
}

function emptyItem(): ItemDraft {
  return { key: crypto.randomUUID(), weightUnit: 'GRAM' };
}

/** Pratinjau nilai baris — harga × berat, dalam satuan baris itu sendiri. */
function previewAmount(item: ItemDraft): number | undefined {
  if (item.weight === undefined || item.pricePerUnit === undefined) return undefined;
  return roundTo(item.weight * item.pricePerUnit, 2);
}

/**
 * Satuan baris ditukar, dan **angkanya ikut pindah**: 1.000 g adalah 32,1507 oz,
 * bukan 1.000 oz. Harganya ikut ke arah sebaliknya supaya nilai barisnya tidak
 * bergerak — yang berubah cuma dalam satuan apa kesepakatan yang sama dituliskan.
 */
function withWeightUnit(item: ItemDraft, nextUnit: WeightUnit): ItemDraft {
  if (item.weightUnit === nextUnit) return item;

  const converted: ItemDraft = {
    ...item,
    weightUnit: nextUnit,
    weight: item.weight === undefined ? undefined : convertWeight(item.weight, item.weightUnit, nextUnit),
    pricePerUnit:
      item.pricePerUnit === undefined
        ? undefined
        : convertPricePerUnit(item.pricePerUnit, item.weightUnit, nextUnit, METAL_PURCHASE_PRICE_SCALE),
  };

  return { ...converted, amount: previewAmount(converted) };
}

interface FormState {
  paymentType: 'PO' | 'DP';
  partnerId: string;
  partner?: PartnerVO;
  date: string;
  supplierInvoiceNumber: string;
  /** Kurir internal PT TAN yang dikirim mengambil barang, bila diambil (bukan diantar supplier). */
  courierName: string;
  /** Nomor surat tugas / surat kuasa kurir yang mengambil barang. */
  courierMandateNumber: string;
  /** Lokasi fisik pengambilan barang, bila diambil dari tempat supplier. */
  pickupLocation: string;
  /** PO lokal selalu 1 barang, sama seperti PO impor — array ini selalu berisi tepat satu elemen. */
  items: ItemDraft[];
  notes: string;
  /** PR asal, saat draft ini datang dari "Konversi ke PO". */
  purchaseRequestId?: string;
  purchaseRequestNumber?: string;
}

function emptyForm(): FormState {
  return {
    paymentType: 'DP',
    partnerId: '',
    date: toDateOnly(today()),
    supplierInvoiceNumber: '',
    courierName: '',
    courierMandateNumber: '',
    pickupLocation: '',
    items: [emptyItem()],
    notes: '',
  };
}

export function LocalPurchasesView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const searchParams = useSearchParams();
  const fromRequestId = searchParams.get('from_request');

  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [voidTarget, setVoidTarget] = useState<{ id: string; number: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Referensi PR **opsional** — datang otomatis dari URL saat dibuka lewat
  // "Konversi ke PO" di halaman PR, atau dipilih manual lewat picker di form.
  const [prId, setPrId] = useState<string | null>(fromRequestId);

  const { data: sourceRequest } = useQuery({
    queryKey: ['purchase-requests', prId],
    queryFn: () => purchaseRequestService.detail(prId as string),
    enabled: prId !== null,
  });

  // Daftar PR yang bisa dipilih dari picker — disetujui, kategori lokal, dan
  // masih ada sisa untuk dipesan.
  const { data: pickablePrs, isLoading: isLoadingPrOptions } = useQuery({
    queryKey: ['purchase-requests', 'pickable', 'GOLD_LOCAL'],
    queryFn: () => purchaseRequestService.list({ status: 'APPROVED', category: 'GOLD_LOCAL', limit: 50 }),
  });
  const prOptions = [
    { value: '', label: 'Tanpa referensi PR' },
    ...(pickablePrs?.items ?? [])
      .filter((pr) => pr.canConvert)
      .map((pr) => ({ value: pr.id, label: `${pr.number} — ${pr.suggestedPartnerName || 'Tanpa supplier'}` })),
  ];

  // Prefill sekali dari PR yang dikonversi, disesuaikan di badan render (bukan
  // efek) mengikuti pola "Adjusting state during rendering" React — hanya
  // baris yang belum tertutup PO ("Sisa" > 0) yang dibawa.
  const [prefilledRequestId, setPrefilledRequestId] = useState<string | null>(null);
  if (sourceRequest && prefilledRequestId !== sourceRequest.id) {
    setPrefilledRequestId(sourceRequest.id);

    const outstandingItems = sourceRequest.items.filter((item) => !item.isFulfilled);
    // PO lokal selalu 1 barang — hanya baris pertama yang dibawa; sisanya
    // (bila ada) tetap terbuka di PR untuk PO lokal berikutnya.
    const [first, ...restOutstanding] = outstandingItems;
    if (first) {
      setForm({
        ...emptyForm(),
        partnerId: sourceRequest.suggestedPartnerId ?? '',
        purchaseRequestId: sourceRequest.id,
        purchaseRequestNumber: sourceRequest.number,
        items: [
          (() => {
            const item: ItemDraft = {
              key: crypto.randomUUID(),
              // ProductPicker hanya membaca `.id` dari sini untuk menandai pilihan
              // awal — nama/kode barangnya diambil dari daftar produk yang
              // dimuatnya sendiri, bukan dari objek ini.
              product: first.productId ? ({ id: first.productId } as ProductVO) : undefined,
              weightUnit: 'GRAM',
              // Berat PR sudah dalam gram; harganya dikonversi dari satuan yang
              // diketik di PR-nya sendiri lewat faktor konversi baris itu.
              weight: first.outstandingQuantity,
              pricePerUnit: first.estUnitPrice / first.unit.conversionFactor,
              purchaseRequestItemId: first.id,
            };
            return { ...item, amount: previewAmount(item) };
          })(),
        ],
      });

      if (restOutstanding.length > 0) {
        toast.warning(
          `PR ${sourceRequest.number} punya ${outstandingItems.length} baris tersisa, tapi PO lokal hanya mendukung 1 barang — hanya baris pertama yang dibawa ke form.`,
        );
      }
    }
  }

  useEffect(() => {
    if (sourceRequest && sourceRequest.items.every((item) => item.isFulfilled)) {
      toast.error(`PR ${sourceRequest.number} sudah tidak punya sisa untuk dipesan.`);
    }
  }, [sourceRequest]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-purchases', { page, type: 'LOCAL' }],
    queryFn: () => metalPurchaseService.list({ page, limit: PAGE_SIZE, type: 'LOCAL' }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (payload: MetalPurchaseWritePayload) => metalPurchaseService.create(payload),
    onSuccess: (created) => {
      toast.success(`PO ${created.number} berhasil dibuat sebagai draft.`);
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
      setForm(emptyForm());
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal membuat PO lokal.')),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => metalPurchaseService.confirm(id),
    onSuccess: () => {
      toast.success('PO berhasil dikonfirmasi.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal mengonfirmasi PO.')),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      metalPurchaseService.void(id, reason),
    onSuccess: () => {
      toast.success('PO berhasil dibatalkan.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
      setVoidTarget(null);
      setVoidReason('');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal membatalkan PO.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => metalPurchaseService.remove(id),
    onSuccess: () => {
      toast.success('Draft PO berhasil dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal menghapus draft PO.')),
  });

  function updateItemWith(key: string, transform: (item: ItemDraft) => ItemDraft): void {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? transform(item) : item)),
    }));
  }

  function updateItem(key: string, patch: Partial<ItemDraft>): void {
    updateItemWith(key, (item) => ({ ...item, ...patch }));
  }

  /**
   * Berat, harga dan nilai baris adalah satu persamaan dengan tiga suku
   * bersama nilainya, jadi mengubah salah satunya harus menggerakkan yang
   * lain — tapi hanya saat orangnya selesai mengetik (`onBlur`).
   */
  function syncAmount(key: string): void {
    updateItemWith(key, (item) => ({ ...item, amount: previewAmount(item) }));
  }

  /** Nilai baris diketik langsung — harga per satuan yang mengikutinya. */
  function commitAmount(key: string): void {
    updateItemWith(key, (item) => {
      if (item.amount === undefined || !item.weight) return item;
      const priced = { ...item, pricePerUnit: roundTo(item.amount / item.weight, METAL_PURCHASE_PRICE_SCALE) };
      return { ...priced, amount: previewAmount(priced) };
    });
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!form.partnerId) {
      toast.error('Pilih supplier terlebih dahulu.');
      return;
    }

    const items: MetalPurchaseItemPayload[] = [];
    for (const item of form.items) {
      if (!item.product || !item.weight || !item.purityPercent || !item.pricePerUnit) {
        toast.error('Lengkapi barang sebelum menyimpan.');
        return;
      }
      items.push({
        product_id: item.product.id,
        purchase_request_item_id: item.purchaseRequestItemId,
        weight_unit: item.weightUnit,
        weight_gram: item.weight,
        purity_percent: item.purityPercent,
        price_per_unit: item.pricePerUnit,
      });
    }

    if (items.length === 0) {
      toast.error('Tambahkan barang terlebih dahulu.');
      return;
    }

    createMutation.mutate({
      type: 'LOCAL',
      payment_type: form.paymentType,
      partner_id: form.partnerId,
      date: form.date,
      supplier_invoice_number: form.supplierInvoiceNumber || undefined,
      currency_code: 'IDR',
      courier_name: form.courierName || undefined,
      courier_mandate_number: form.courierMandateNumber || undefined,
      pickup_location: form.pickupLocation || undefined,
      purchase_request_id: form.purchaseRequestId,
      items,
      charges: [],
      notes: form.notes || undefined,
    });
  }

  const items = data?.items ?? [];
  const numberLabel = METAL_PURCHASE_NUMBER_LABELS[form.paymentType] ?? 'Nomor';

  return (
    <div className="space-y-4">
      {can('local-purchases:create') && (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Typography variant="h3" className="text-base font-semibold">
                Form PO Emas Lokal
              </Typography>
              <Typography variant="muted" className="text-xs">
                {data ? `${data.total} PO lokal tersimpan` : 'Input pembelian emas lokal di atas tabel'}
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm(emptyForm())}
              >
                Reset Form
              </Button>
              <Button
                type="submit"
                form="local-purchase-form"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                isLoading={createMutation.isPending}
              >
                Simpan Draft
              </Button>
            </div>
          </div>

          <form id="local-purchase-form" onSubmit={handleSubmit} className="space-y-4">
            {form.purchaseRequestNumber && (
              <div className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-foreground">
                Dikonversi dari PR <span className="font-mono font-semibold">{form.purchaseRequestNumber}</span> —
                hanya baris yang masih bersisa yang dibawa ke sini.
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
              <div>
                <span className="text-foreground block text-xs font-semibold">Satuan Berat</span>
                <span className="text-foreground-subtle block text-[11px]">
                  Berat & harga per satuan di bawah mengikuti pilihan ini.
                </span>
              </div>
              <Segmented
                aria-label="Satuan berat"
                size="sm"
                options={WEIGHT_UNIT_TABS}
                value={form.items[0]?.weightUnit ?? 'GRAM'}
                onValueChange={(unit) => {
                  const key = form.items[0]?.key;
                  if (key) updateItemWith(key, (current) => withWeightUnit(current, unit));
                }}
              />
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">
                Referensi Purchase Request <span className="text-foreground-subtle font-normal">(opsional)</span>
              </label>
              <Combobox
                options={prOptions}
                value={form.purchaseRequestId ?? ''}
                loading={isLoadingPrOptions}
                onValueChange={(v) => {
                  if (v === '') {
                    setPrId(null);
                    setPrefilledRequestId(null);
                    setForm((prev) => ({
                      ...prev,
                      purchaseRequestId: undefined,
                      purchaseRequestNumber: undefined,
                      items: prev.items.map((item) => ({ ...item, purchaseRequestItemId: undefined })),
                    }));
                    return;
                  }
                  setPrId(v);
                }}
                className="text-xs"
              />
              {form.purchaseRequestNumber && (
                <Typography variant="muted" className="mt-1 text-[11px]">
                  Terisi dari PR {form.purchaseRequestNumber} — hanya baris yang masih bersisa yang dibawa.
                </Typography>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Cara Bayar</label>
                <Combobox
                  options={PAYMENT_TYPE_OPTIONS}
                  value={form.paymentType}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, paymentType: v as 'PO' | 'DP' }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Tanggal</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  {numberLabel} <span className="text-foreground-subtle font-normal">(otomatis saat disimpan)</span>
                </label>
                <Input value="" disabled placeholder={numberLabel} className="h-9 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. Invoice Supplier</label>
                <Input
                  value={form.supplierInvoiceNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Lokasi Pengambilan <span className="text-foreground-subtle font-normal">(opsional)</span>
                </label>
                <Input
                  value={form.pickupLocation}
                  onChange={(e) => setForm((prev) => ({ ...prev, pickupLocation: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: Toko Emas ABC, Jl. Pasar Baru No. 12"
                />
              </div>
            </div>

            <PartnerPicker
              role="supplier"
              origin="LOCAL"
              value={form.partnerId}
              onChange={(id, partner) => setForm((prev) => ({ ...prev, partnerId: id, partner }))}
              canCreate
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Nama Kurir Pengambilan <span className="text-foreground-subtle font-normal">(opsional)</span>
                </label>
                <Input
                  value={form.courierName}
                  onChange={(e) => setForm((prev) => ({ ...prev, courierName: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: Bpk. Budi (Kurir Internal PT TAN)"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  No. Surat Tugas / Surat Kuasa <span className="text-foreground-subtle font-normal">(opsional)</span>
                </label>
                <Input
                  value={form.courierMandateNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, courierMandateNumber: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: ST-2026-0801"
                />
              </div>
            </div>

            <div className="border-border/60 bg-surface/40 space-y-3 rounded-lg border p-3">
              {form.items.map((item) => {
                const purityLocked = item.product?.purityLocked === true;
                const unitLabel = WEIGHT_UNIT_LABELS[item.weightUnit];
                const otherUnit: WeightUnit = item.weightUnit === 'GRAM' ? 'TROY_OUNCE' : 'GRAM';
                const priceOtherUnit =
                  item.pricePerUnit === undefined
                    ? undefined
                    : convertPricePerUnit(item.pricePerUnit, item.weightUnit, otherUnit, METAL_PURCHASE_PRICE_SCALE);

                return (
                  <div key={item.key} className="border-border/40 space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className={purityLocked ? 'sm:col-span-6' : 'sm:col-span-4'}>
                        <ProductPicker
                          value={item.product?.id ?? ''}
                          onChange={(product) =>
                            updateItem(item.key, {
                              product,
                              purityPercent: product.defaultPurityPercent ?? item.purityPercent,
                            })
                          }
                          label="Produk"
                        />
                      </div>

                      <div className={purityLocked ? 'sm:col-span-6' : 'sm:col-span-4'}>
                        <label className="text-foreground-subtle mb-1 block text-[11px]">Berat ({unitLabel})</label>
                        <NumberInput
                          value={item.weight}
                          onChange={(v) => updateItem(item.key, { weight: v })}
                          onBlur={() => syncAmount(item.key)}
                          decimalScale={4}
                          rightAddon={<span className="text-xs">{unitLabel}</span>}
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* Kadar tidak ditanyakan sama sekali untuk produk berkadar tetap
                          (mis. batangan LBMA 99,99%) — nilainya sudah terisi otomatis
                          dari master produk saat dipilih di atas. */}
                      {!purityLocked && (
                        <div className="sm:col-span-4">
                          <label className="text-foreground-subtle mb-1 block text-[11px]">Kadar (%)</label>
                          <NumberInput
                            value={item.purityPercent}
                            onChange={(v) => updateItem(item.key, { purityPercent: v })}
                            decimalScale={4}
                            className="h-9 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className="text-foreground-subtle mb-1 block text-[11px]">
                          Harga per {unitLabel} (IDR)
                        </label>
                        <NumberInput
                          value={item.pricePerUnit}
                          onChange={(v) => updateItem(item.key, { pricePerUnit: v })}
                          onBlur={() => syncAmount(item.key)}
                          decimalScale={4}
                          className="h-9 text-xs"
                          hint={
                            priceOtherUnit !== undefined
                              ? `≈ ${formatCurrency(priceOtherUnit)}/${WEIGHT_UNIT_LABELS[otherUnit]}`
                              : undefined
                          }
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <label className="text-foreground-subtle mb-1 block text-[11px]">
                          Total Pembelian (IDR)
                        </label>
                        <NumberInput
                          value={item.amount}
                          onChange={(v) => updateItem(item.key, { amount: v })}
                          onBlur={() => commitAmount(item.key)}
                          decimalScale={2}
                          className="h-9 text-xs"
                          hint="Boleh diisi langsung — harga per satuan menyesuaikan, dan sebaliknya."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">Catatan</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
          </form>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isError && (
        <ErrorState
          variant="inline"
          message={apiErrorMessage(error, 'Daftar PO lokal gagal dimuat.')}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead>Ref PR</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Cara Bayar</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-foreground-subtle py-10 text-center text-sm">
                    Belum ada PO lokal.
                  </TableCell>
                </TableRow>
              )}
              {items.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <span className="text-foreground-subtle block text-[10px]">
                      {METAL_PURCHASE_NUMBER_LABELS[purchase.paymentType] ?? 'Nomor'}
                    </span>
                    <span className="font-mono text-xs font-semibold">{purchase.number}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {purchase.purchaseRequestNumber ? (
                      <Badge variant="info" size="sm">
                        {purchase.purchaseRequestNumber}
                      </Badge>
                    ) : (
                      <span className="text-foreground-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{purchase.partnerName}</TableCell>
                  <TableCell className="text-foreground-muted text-xs">{purchase.dateLabel}</TableCell>
                  <TableCell className="text-xs">{purchase.paymentTypeLabel}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {purchase.goodsAmountLabel}
                  </TableCell>
                  <TableCell>
                    <Badge variant={METAL_PURCHASE_STATUS_BADGE[purchase.status]} size="sm" dot>
                      {purchase.statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 p-0 text-foreground-muted hover:text-foreground hover:bg-surface-raised cursor-pointer mx-auto"
                          aria-label={`Aksi untuk ${purchase.number}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[1100]">
                        {purchase.isEditable && can('local-purchases:confirm') && (
                          <DropdownMenuItem
                            onClick={() => confirmMutation.mutate(purchase.id)}
                            className="flex items-center gap-2 text-emerald-500 focus:text-emerald-500 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Konfirmasi</span>
                          </DropdownMenuItem>
                        )}
                        {purchase.isEditable && can('local-purchases:delete') && (
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(purchase.id)}
                            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Hapus draft</span>
                          </DropdownMenuItem>
                        )}
                        {purchase.isVoidable && can('local-purchases:void') && (
                          <DropdownMenuItem
                            onClick={() => setVoidTarget({ id: purchase.id, number: purchase.number })}
                            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Ban className="h-4 w-4" />
                            <span>Batalkan (Void)</span>
                          </DropdownMenuItem>
                        )}
                        {!purchase.isEditable && !purchase.isVoidable && (
                          <DropdownMenuItem disabled>
                            <span className="text-foreground-subtle text-xs">Tidak ada aksi</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Typography variant="muted" className="text-xs">
            Halaman {data.page} dari {data.totalPages}
          </Typography>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data.hasPrevPage} onClick={() => setPage((p) => p - 1)}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={!data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        title={`Batalkan PO ${voidTarget?.number ?? ''}?`}
        description="Jelaskan alasan pembatalan. PO yang sudah dikonfirmasi tetap tersimpan sebagai catatan, hanya berubah status."
        tone="danger"
        confirmLabel="Batalkan PO"
        isConfirming={voidMutation.isPending}
        confirmDisabled={voidReason.trim().length < 5}
        onConfirm={() => voidTarget && voidMutation.mutate({ id: voidTarget.id, reason: voidReason })}
      >
        <Input
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          placeholder="Alasan pembatalan (minimal 5 karakter)…"
          className="text-xs"
        />
      </ConfirmDialog>
    </div>
  );
}

LocalPurchasesView.displayName = 'LocalPurchasesView';
