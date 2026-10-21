'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Trash2, CheckCircle2, Ban, RefreshCw, Calculator, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import {
  apiErrorMessage,
  exchangeRateService,
  metalPurchaseService,
  purchaseRequestService,
  type MetalPurchaseItemPayload,
  type MetalPurchaseWritePayload,
} from '@/services';
import { toDateOnly, today } from '@/lib/date';
import { METAL_PURCHASE_PRICE_SCALE, METAL_PURCHASE_STATUS_BADGE } from '@/lib/metal-purchase';
import { formatCurrency, roundTo } from '@/lib/number';
import { convertPricePerUnit, convertWeight, toGram, WEIGHT_UNIT_LABELS } from '@/lib/weight';
import { cn } from '@/lib/cn';
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

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'SGD', label: 'SGD' },
];

/**
 * Dua tombol, bukan dropdown — satuan yang sedang berlaku adalah keterangan
 * yang dibaca berkali-kali sambil mengetik, bukan pilihan yang dibuka sekali
 * lalu ditutup (pola sama dengan `PurchaseItemsInput` di app referensi).
 */
const WEIGHT_UNIT_TABS = [
  { value: 'GRAM', label: WEIGHT_UNIT_LABELS.GRAM },
  { value: 'TROY_OUNCE', label: WEIGHT_UNIT_LABELS.TROY_OUNCE },
] as const satisfies readonly { value: WeightUnit; label: string }[];

interface ItemDraft {
  key: string;
  product?: ProductVO;
  weight?: number;
  purityPercent?: number;
  /** Harga per satu satuan `FormState.weightUnit`. */
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
  return { key: crypto.randomUUID() };
}

/** Pratinjau nilai baris — harga × berat, dalam satuan berlaku dokumen ini. */
function previewAmount(item: ItemDraft): number | undefined {
  if (item.weight === undefined || item.pricePerUnit === undefined) return undefined;
  return roundTo(item.weight * item.pricePerUnit, 2);
}

/**
 * PO impor selalu 1 barang (batangan LBMA per kesepakatan) — satuan berat
 * (gram/oz) karena itu satu toggle dokumen-level, bukan per-baris. Menukarnya
 * memindahkan **angkanya ikut pindah**: 1.000 g adalah 32,1507 oz, bukan
 * 1.000 oz. Harganya ikut ke arah sebaliknya supaya nilai kesepakatannya
 * tidak bergerak — yang berubah cuma dalam satuan apa itu dituliskan.
 */
function withWeightUnit(form: FormState, nextUnit: WeightUnit): FormState {
  if (form.weightUnit === nextUnit) return form;

  const converted: ItemDraft = {
    ...form.item,
    weight: form.item.weight === undefined ? undefined : convertWeight(form.item.weight, form.weightUnit, nextUnit),
    pricePerUnit:
      form.item.pricePerUnit === undefined
        ? undefined
        : convertPricePerUnit(form.item.pricePerUnit, form.weightUnit, nextUnit, METAL_PURCHASE_PRICE_SCALE),
  };

  return { ...form, weightUnit: nextUnit, item: { ...converted, amount: previewAmount(converted) } };
}

interface FormState {
  partnerId: string;
  partner?: PartnerVO;
  date: string;
  supplierInvoiceNumber: string;
  currency: 'USD' | 'SGD';
  exchangeRate?: number;
  /** `true` setelah user mengetik kursnya sendiri — sinkronisasi BCA otomatis berhenti menimpa. */
  exchangeRateTouched: boolean;
  courierName: string;
  mawbNumber: string;
  courierMandateNumber: string;
  /** Satuan berat dokumen — PO impor selalu 1 barang, jadi satu toggle untuk seluruh dokumen. */
  weightUnit: WeightUnit;
  item: ItemDraft;
  notes: string;
  /** PR asal, saat draft ini datang dari "Konversi ke PO". */
  purchaseRequestId?: string;
  purchaseRequestNumber?: string;
}

function emptyForm(): FormState {
  return {
    partnerId: '',
    date: toDateOnly(today()),
    supplierInvoiceNumber: '',
    currency: 'USD',
    exchangeRateTouched: false,
    courierName: '',
    mawbNumber: '',
    courierMandateNumber: '',
    weightUnit: 'GRAM',
    item: emptyItem(),
    notes: '',
  };
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function ImportPurchasesView() {
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
  // Tidak ada PO impor yang diblokir hanya karena tidak punya PR.
  const [prId, setPrId] = useState<string | null>(fromRequestId);

  const { data: sourceRequest } = useQuery({
    queryKey: ['purchase-requests', prId],
    queryFn: () => purchaseRequestService.detail(prId as string),
    enabled: prId !== null,
  });

  // Daftar PR yang bisa dipilih dari picker — disetujui, kategori impor, dan
  // masih ada sisa untuk dipesan.
  const { data: pickablePrs, isLoading: isLoadingPrOptions } = useQuery({
    queryKey: ['purchase-requests', 'pickable', 'GOLD_IMPORT'],
    queryFn: () => purchaseRequestService.list({ status: 'APPROVED', category: 'GOLD_IMPORT', limit: 50 }),
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

    const [source, ...rest] = sourceRequest.items.filter((item) => !item.isFulfilled);
    if (source) {
      // PO impor selalu 1 barang — hanya baris pertama yang belum tertutup
      // yang dibawa ke sini; sisanya tetap di PR untuk dikonversi terpisah.
      if (rest.length > 0) {
        toast.warning(
          `PR ${sourceRequest.number} punya ${rest.length + 1} baris tersisa — hanya baris pertama yang dibawa karena PO impor cuma 1 barang. Sisanya tetap di PR.`,
        );
      }
      const item: ItemDraft = {
        key: crypto.randomUUID(),
        // ProductPicker hanya membaca `.id` dari sini untuk menandai pilihan
        // awal — nama/kode barangnya diambil dari daftar produk yang
        // dimuatnya sendiri, bukan dari objek ini.
        product: source.productId ? ({ id: source.productId } as ProductVO) : undefined,
        // Berat PR sudah dalam gram; harganya dikonversi dari satuan yang
        // diketik di PR-nya sendiri lewat faktor konversi baris itu.
        weight: source.outstandingQuantity,
        pricePerUnit: source.estUnitPrice / source.unit.conversionFactor,
        purchaseRequestItemId: source.id,
      };
      setForm({
        ...emptyForm(),
        partnerId: sourceRequest.suggestedPartnerId ?? '',
        currency:
          sourceRequest.currencyCode === 'IDR' ? 'USD' : (sourceRequest.currencyCode as 'USD' | 'SGD'),
        purchaseRequestId: sourceRequest.id,
        purchaseRequestNumber: sourceRequest.number,
        item: { ...item, amount: previewAmount(item) },
      });
    }
  }

  useEffect(() => {
    if (sourceRequest && sourceRequest.items.every((item) => item.isFulfilled)) {
      toast.error(`PR ${sourceRequest.number} sudah tidak punya sisa untuk dipesan.`);
    }
  }, [sourceRequest]);

  // Kurs BCA e-Rate otomatis, mengikuti mata uang PO — sinkron ulang setiap
  // ganti mata uang, berhenti begitu user mengetik kursnya sendiri
  // (`exchangeRateTouched`). Sama seperti `@/lib/exchange-rate`: saran
  // tampilan, bukan bukti — yang mengikat adalah angka yang tersimpan di
  // dokumennya sendiri.
  const {
    data: fxQuote,
    isFetching: isFetchingRate,
    refetch: refetchRate,
  } = useQuery({
    queryKey: ['exchange-rate', form.currency],
    queryFn: () => exchangeRateService.quote(form.currency, 'IDR'),
    staleTime: 60_000,
  });

  // Dibandingkan langsung ke `form.exchangeRate` (bukan key terpisah yang
  // diingat sendiri) — form yang di-reset (submit sukses, ganti referensi PR)
  // mengosongkan `exchangeRate` lagi walau mata uang & kursnya sama, dan
  // perbandingan tidak langsung akan menganggap itu "sudah pernah diterapkan"
  // lalu diam-diam membiarkan field itu kosong.
  if (fxQuote && !form.exchangeRateTouched && form.exchangeRate !== fxQuote.rate) {
    setForm((prev) => ({ ...prev, exchangeRate: fxQuote.rate }));
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-purchases', { page, type: 'IMPORT' }],
    queryFn: () => metalPurchaseService.list({ page, limit: PAGE_SIZE, type: 'IMPORT' }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (payload: MetalPurchaseWritePayload) => metalPurchaseService.create(payload),
    onSuccess: (created) => {
      toast.success(`PO ${created.number} berhasil dibuat.`);
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
      setForm(emptyForm());
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal membuat PO impor.')),
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
      toast.success('PO berhasil dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal menghapus PO.')),
  });

  function updateItemWith(transform: (item: ItemDraft) => ItemDraft): void {
    setForm((prev) => ({ ...prev, item: transform(prev.item) }));
  }

  function updateItem(patch: Partial<ItemDraft>): void {
    updateItemWith((item) => ({ ...item, ...patch }));
  }

  /**
   * Berat, harga dan nilai barang adalah satu persamaan dengan tiga suku
   * bersama nilainya, jadi mengubah salah satunya harus menggerakkan yang
   * lain — tapi hanya saat orangnya selesai mengetik (`onBlur`). Menurunkan
   * di `onChange` menganggap satu digit yang baru separuh diketik sudah
   * jawaban akhir, dan nilai turunan akan memicu penurunan balik sehingga
   * kedua field saling mengejar.
   */
  function syncAmount(): void {
    updateItemWith((item) => ({ ...item, amount: previewAmount(item) }));
  }

  /** Nilai barang diketik langsung — harga per satuan yang mengikutinya. */
  function commitAmount(): void {
    updateItemWith((item) => {
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
    if (!form.exchangeRate || form.exchangeRate <= 0) {
      toast.error('Kurs ke rupiah wajib diisi untuk PO impor.');
      return;
    }

    const item = form.item;
    if (!item.product || !item.weight || !item.purityPercent || !item.pricePerUnit) {
      toast.error('Lengkapi barang sebelum menyimpan.');
      return;
    }

    const items: MetalPurchaseItemPayload[] = [
      {
        product_id: item.product.id,
        purchase_request_item_id: item.purchaseRequestItemId,
        weight_unit: form.weightUnit,
        weight_gram: item.weight,
        purity_percent: item.purityPercent,
        price_per_unit: item.pricePerUnit,
      },
    ];

    createMutation.mutate({
      type: 'IMPORT',
      // Import tidak punya jalur "Direct Purchase" — dengan atau tanpa PR,
      // cara bayarnya selalu PO.
      payment_type: 'PO',
      partner_id: form.partnerId,
      date: form.date,
      supplier_invoice_number: form.supplierInvoiceNumber || undefined,
      currency_code: form.currency,
      exchange_rate: form.exchangeRate,
      courier_name: form.courierName || undefined,
      mawb_number: form.mawbNumber || undefined,
      courier_mandate_number: form.courierMandateNumber || undefined,
      purchase_request_id: form.purchaseRequestId,
      items,
      charges: [],
      notes: form.notes || undefined,
    });
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {can('import-purchases:create') && (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Typography variant="h3" className="text-base font-semibold">
                Form PO Emas Impor
              </Typography>
              <Typography variant="muted" className="text-xs">
                {data ? `${data.total} PO impor tersimpan` : 'Input pembelian emas impor di atas tabel'}
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
                form="import-purchase-form"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                isLoading={createMutation.isPending}
              >
                Simpan PO
              </Button>
            </div>
          </div>

          <form id="import-purchase-form" onSubmit={handleSubmit} className="space-y-4">
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
                      item: { ...prev.item, purchaseRequestItemId: undefined },
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Tgl PO Impor</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. Invoice Supplier</label>
                <Input
                  value={form.supplierInvoiceNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: INV-YLG-SG-2026-8812"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Mata Uang</label>
                <Combobox
                  options={CURRENCY_OPTIONS}
                  value={form.currency}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      currency: v as 'USD' | 'SGD',
                      exchangeRateTouched: false,
                    }))
                  }
                  className="text-xs"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-foreground block text-xs font-semibold">Kurs {form.currency} ke IDR</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, exchangeRateTouched: false }));
                      void refetchRate();
                    }}
                    className="text-gold-dark hover:text-gold flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className={cn('h-3 w-3', isFetchingRate && 'animate-spin')} aria-hidden="true" />
                    Sync BCA
                  </button>
                </div>
                <NumberInput
                  value={form.exchangeRate}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, exchangeRate: v, exchangeRateTouched: true }))
                  }
                  placeholder="Contoh: 16250"
                  className="h-9 text-xs"
                />
                {fxQuote && (
                  <Typography variant="muted" className="mt-1 text-[11px]">
                    {fxQuote.source} · {fxQuote.asOf.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </Typography>
                )}
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Kargo Pengamanan & Pengiriman</label>
                <Input
                  value={form.courierName}
                  onChange={(e) => setForm((prev) => ({ ...prev, courierName: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: Brinks / YLG Logistics"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. MAWB</label>
                <Input
                  value={form.mawbNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, mawbNumber: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: 618-12345678"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. Surat Kuasa Kurir</label>
                <Input
                  value={form.courierMandateNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, courierMandateNumber: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Contoh: SK-KURIR-2026-0801"
                />
              </div>
            </div>

            <PartnerPicker
              role="supplier"
              origin="OVERSEAS"
              value={form.partnerId}
              onChange={(id, partner) => setForm((prev) => ({ ...prev, partnerId: id, partner }))}
              canCreate
            />

            <div className="border-border/60 bg-surface/40 space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-end gap-3">
                <Segmented
                  aria-label="Satuan berat dokumen"
                  size="sm"
                  options={WEIGHT_UNIT_TABS}
                  value={form.weightUnit}
                  onValueChange={(unit) => setForm((prev) => withWeightUnit(prev, unit))}
                />
              </div>

              {(() => {
                const item = form.item;
                const purityLocked = item.product?.purityLocked === true;
                const unitLabel = WEIGHT_UNIT_LABELS[form.weightUnit];
                const otherUnit: WeightUnit = form.weightUnit === 'GRAM' ? 'TROY_OUNCE' : 'GRAM';
                const priceOtherUnit =
                  item.pricePerUnit === undefined
                    ? undefined
                    : convertPricePerUnit(item.pricePerUnit, form.weightUnit, otherUnit, METAL_PURCHASE_PRICE_SCALE);

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className={purityLocked ? 'sm:col-span-6' : 'sm:col-span-4'}>
                        <ProductPicker
                          value={item.product?.id ?? ''}
                          onChange={(product) =>
                            updateItem({
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
                          onChange={(v) => updateItem({ weight: v })}
                          onBlur={syncAmount}
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
                            onChange={(v) => updateItem({ purityPercent: v })}
                            decimalScale={4}
                            className="h-9 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className="text-foreground-subtle mb-1 block text-[11px]">
                          Harga per {unitLabel} ({form.currency})
                        </label>
                        <NumberInput
                          value={item.pricePerUnit}
                          onChange={(v) => updateItem({ pricePerUnit: v })}
                          onBlur={syncAmount}
                          decimalScale={4}
                          className="h-9 text-xs"
                          hint={
                            priceOtherUnit !== undefined
                              ? `≈ ${formatAmount(priceOtherUnit, form.currency)}/${WEIGHT_UNIT_LABELS[otherUnit]}`
                              : undefined
                          }
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <label className="text-foreground-subtle mb-1 block text-[11px]">
                          Total Kesepakatan ({form.currency})
                        </label>
                        <NumberInput
                          value={item.amount}
                          onChange={(v) => updateItem({ amount: v })}
                          onBlur={commitAmount}
                          decimalScale={2}
                          className="h-9 text-xs"
                          hint="Boleh diisi langsung — harga per satuan menyesuaikan, dan sebaliknya."
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {(() => {
              const item = form.item;
              if (item.amount === undefined) return null;
              const totalValue = item.amount;

              const weightGramTotal = item.weight === undefined ? 0 : toGram(item.weight, form.weightUnit);
              const totalLandedCostIdr = form.exchangeRate ? totalValue * form.exchangeRate : undefined;
              const hppPerGram =
                totalLandedCostIdr !== undefined && weightGramTotal
                  ? totalLandedCostIdr / weightGramTotal
                  : undefined;

              return (
                <div className="rounded-lg border border-gold/40 bg-surface/60 p-4">
                  <div className="text-gold-light mb-3 flex items-center gap-2 text-sm font-bold">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                    Rincian Struktur Harga Beli Emas Impor (Buku PT TAN)
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <div className="stat-lbl">1. Nilai Total Beli ({form.currency})</div>
                      <div className="text-gold-light text-lg font-extrabold">
                        {formatAmount(totalValue, form.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-lbl">2. Kurs Acuan Transaksi</div>
                      <div className="text-foreground text-lg font-bold">
                        {formatCurrency(form.exchangeRate ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-lbl">3. Total Landed Cost (IDR)</div>
                      <div className="text-emerald-light text-lg font-extrabold">
                        {formatCurrency(totalLandedCostIdr ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-lbl">4. Estimasi HPP / Gram</div>
                      <div className="text-sky-light text-lg font-extrabold">
                        {formatCurrency(Math.round(hppPerGram ?? 0))} / g
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
          message={apiErrorMessage(error, 'Daftar PO impor gagal dimuat.')}
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
                    Belum ada PO impor.
                  </TableCell>
                </TableRow>
              )}
              {items.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-xs font-semibold">{purchase.number}</TableCell>
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
                    {formatAmount(purchase.goodsAmount, purchase.currencyCode)}
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
                        {purchase.isEditable && can('import-purchases:confirm') && (
                          <DropdownMenuItem
                            onClick={() => confirmMutation.mutate(purchase.id)}
                            className="flex items-center gap-2 text-emerald-500 focus:text-emerald-500 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Konfirmasi</span>
                          </DropdownMenuItem>
                        )}
                        {purchase.isEditable && can('import-purchases:delete') && (
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(purchase.id)}
                            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Hapus draft</span>
                          </DropdownMenuItem>
                        )}
                        {purchase.isVoidable && can('import-purchases:void') && (
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

ImportPurchasesView.displayName = 'ImportPurchasesView';
