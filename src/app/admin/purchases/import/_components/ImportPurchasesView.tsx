'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Trash2, CheckCircle2, Ban } from 'lucide-react';
import { toast } from 'sonner';

import {
  apiErrorMessage,
  metalPurchaseService,
  type MetalPurchaseItemPayload,
  type MetalPurchaseWritePayload,
} from '@/services';
import { toDateOnly, today } from '@/lib/date';
import {
  METAL_PURCHASE_PAYMENT_TYPE_LABELS,
  METAL_PURCHASE_STATUS_BADGE,
} from '@/lib/metal-purchase';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import { PartnerPicker } from '@/components/shared/PartnerPicker';
import { ProductPicker } from '@/components/shared/ProductPicker';
import type { PartnerVO, ProductVO } from '@/types/value-objects';

const PAGE_SIZE = 20;

const PAYMENT_TYPE_OPTIONS = [
  { value: 'PO', label: METAL_PURCHASE_PAYMENT_TYPE_LABELS.PO ?? 'PO (Tempo)' },
  { value: 'DP', label: METAL_PURCHASE_PAYMENT_TYPE_LABELS.DP ?? 'DP (Direct Payment)' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'SGD', label: 'SGD' },
];

interface ItemDraft {
  key: string;
  product?: ProductVO;
  weightGram?: number;
  purityPercent?: number;
  pricePerUnit?: number;
}

function emptyItem(): ItemDraft {
  return { key: crypto.randomUUID() };
}

interface FormState {
  paymentType: 'PO' | 'DP';
  partnerId: string;
  partner?: PartnerVO;
  date: string;
  supplierInvoiceNumber: string;
  currency: 'USD' | 'SGD';
  exchangeRate?: number;
  courierName: string;
  items: ItemDraft[];
  notes: string;
}

function emptyForm(): FormState {
  return {
    paymentType: 'PO',
    partnerId: '',
    date: toDateOnly(today()),
    supplierInvoiceNumber: '',
    currency: 'USD',
    courierName: '',
    items: [emptyItem()],
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

  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [voidTarget, setVoidTarget] = useState<{ id: string; number: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-purchases', { page, type: 'IMPORT' }],
    queryFn: () => metalPurchaseService.list({ page, limit: PAGE_SIZE, type: 'IMPORT' }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (payload: MetalPurchaseWritePayload) => metalPurchaseService.create(payload),
    onSuccess: (created) => {
      toast.success(`PO ${created.number} berhasil dibuat sebagai draft.`);
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
      toast.success('Draft PO berhasil dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal menghapus draft PO.')),
  });

  function updateItem(key: string, patch: Partial<ItemDraft>): void {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(key: string): void {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.key !== key) }));
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

    const items: MetalPurchaseItemPayload[] = [];
    for (const item of form.items) {
      if (!item.product || !item.weightGram || !item.purityPercent || !item.pricePerUnit) {
        toast.error('Lengkapi seluruh baris barang sebelum menyimpan.');
        return;
      }
      items.push({
        product_id: item.product.id,
        weight_unit: 'GRAM',
        weight_gram: item.weightGram,
        purity_percent: item.purityPercent,
        price_per_unit: item.pricePerUnit,
      });
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal satu barang.');
      return;
    }

    createMutation.mutate({
      type: 'IMPORT',
      payment_type: form.paymentType,
      partner_id: form.partnerId,
      date: form.date,
      supplier_invoice_number: form.supplierInvoiceNumber || undefined,
      currency_code: form.currency,
      exchange_rate: form.exchangeRate,
      courier_name: form.courierName || undefined,
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
                Simpan Draft
              </Button>
            </div>
          </div>

          <form id="import-purchase-form" onSubmit={handleSubmit} className="space-y-4">
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
                  onValueChange={(v) => setForm((prev) => ({ ...prev, currency: v as 'USD' | 'SGD' }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Kurs {form.currency} ke IDR</label>
                <NumberInput
                  value={form.exchangeRate}
                  onChange={(v) => setForm((prev) => ({ ...prev, exchangeRate: v }))}
                  placeholder="Contoh: 16250"
                  className="h-9 text-xs"
                />
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

            <PartnerPicker
              role="supplier"
              origin="OVERSEAS"
              value={form.partnerId}
              onChange={(id, partner) => setForm((prev) => ({ ...prev, partnerId: id, partner }))}
              canCreate
            />

            <div className="border-border/60 bg-surface/40 space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-bold">Barang</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Tambah Baris
                </Button>
              </div>

              {form.items.map((item) => (
                <div key={item.key} className="border-border/40 grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-12">
                  <div className="sm:col-span-4">
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
                  <div className="sm:col-span-2">
                    <label className="text-foreground-subtle mb-1 block text-[11px]">Berat (g)</label>
                    <NumberInput
                      value={item.weightGram}
                      onChange={(v) => updateItem(item.key, { weightGram: v })}
                      decimalScale={4}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-foreground-subtle mb-1 block text-[11px]">Kadar (%)</label>
                    <NumberInput
                      value={item.purityPercent}
                      onChange={(v) => updateItem(item.key, { purityPercent: v })}
                      decimalScale={4}
                      disabled={item.product?.purityLocked}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-foreground-subtle mb-1 block text-[11px]">
                      Harga/{form.currency === 'USD' ? 'oz' : 'gram'}
                    </label>
                    <NumberInput
                      value={item.pricePerUnit}
                      onChange={(v) => updateItem(item.key, { pricePerUnit: v })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.key)}
                      disabled={form.items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
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
                <TableHead>Supplier</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Cara Bayar</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-foreground-subtle py-10 text-center text-sm">
                    Belum ada PO impor.
                  </TableCell>
                </TableRow>
              )}
              {items.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-xs font-semibold">{purchase.number}</TableCell>
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
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {purchase.isEditable && can('import-purchases:confirm') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmMutation.mutate(purchase.id)}
                          leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        >
                          Konfirmasi
                        </Button>
                      )}
                      {purchase.isEditable && can('import-purchases:delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(purchase.id)}
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          Hapus
                        </Button>
                      )}
                      {purchase.isVoidable && can('import-purchases:void') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoidTarget({ id: purchase.id, number: purchase.number })}
                          leftIcon={<Ban className="h-3.5 w-3.5" />}
                        >
                          Batalkan
                        </Button>
                      )}
                    </div>
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
