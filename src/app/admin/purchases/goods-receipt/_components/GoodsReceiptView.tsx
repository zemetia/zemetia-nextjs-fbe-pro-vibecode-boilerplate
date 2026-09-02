'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Ship, CheckCircle2, Ban, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  apiErrorMessage,
  metalPurchaseDeliveryService,
  metalPurchaseService,
  type MetalPurchaseDeliveryLinePayload,
  type MetalPurchaseDeliveryWritePayload,
} from '@/services';
import { toDateOnly, today } from '@/lib/date';
import { METAL_PURCHASE_DELIVERY_STATUS_BADGE } from '@/lib/metal-purchase';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CertificatesInput } from '@/components/ui/CertificatesInput';
import { Combobox } from '@/components/ui/Combobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 20;

interface LineDraft {
  purchaseItemId: string;
  productLabel: string;
  weightGram: number;
  purityPercent: number;
}

interface FormState {
  purchaseId: string;
  purchaseType: string;
  number: string;
  date: string;
  supplierDoNumber: string;
  trackingNumber: string;
  receivedByName: string;
  corNumber: string;
  pibNo: string;
  sppbNo: string;
  mawbNo: string;
  barSerialNumbers: string;
  lines: LineDraft[];
}

function emptyForm(): FormState {
  return {
    purchaseId: '',
    purchaseType: '',
    number: '',
    date: toDateOnly(today()),
    supplierDoNumber: '',
    trackingNumber: '',
    receivedByName: '',
    corNumber: '',
    pibNo: '',
    sppbNo: '',
    mawbNo: '',
    barSerialNumbers: '',
    lines: [],
  };
}

export function GoodsReceiptView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [voidTarget, setVoidTarget] = useState<{ id: string; number: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-purchase-deliveries', { page }],
    queryFn: () => metalPurchaseDeliveryService.list({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: confirmedPurchases } = useQuery({
    queryKey: ['metal-purchases', 'confirmed'],
    queryFn: () => metalPurchaseService.list({ status: 'CONFIRMED', limit: 50 }),
    enabled: isCreateOpen,
  });

  const createMutation = useMutation({
    mutationFn: (payload: MetalPurchaseDeliveryWritePayload) =>
      metalPurchaseDeliveryService.create(payload),
    onSuccess: (created) => {
      toast.success(`TTB ${created.number} berhasil dibuat sebagai draft.`);
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
      setIsCreateOpen(false);
      setForm(emptyForm());
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal membuat TTB.')),
  });

  const shipMutation = useMutation({
    mutationFn: (id: string) => metalPurchaseDeliveryService.ship(id),
    onSuccess: () => {
      toast.success('TTB ditandai berangkat — hutang usaha sudah dijurnal.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal memberangkatkan TTB.')),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => metalPurchaseDeliveryService.confirm(id),
    onSuccess: () => {
      toast.success('Barang diterima — jurnal penerimaan sudah dicatat.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal mengonfirmasi penerimaan.')),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      metalPurchaseDeliveryService.void(id, reason),
    onSuccess: () => {
      toast.success('TTB berhasil dibatalkan.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      setVoidTarget(null);
      setVoidReason('');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal membatalkan TTB.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => metalPurchaseDeliveryService.remove(id),
    onSuccess: () => {
      toast.success('Draft TTB berhasil dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Gagal menghapus draft TTB.')),
  });

  async function handlePurchaseSelect(purchaseId: string): Promise<void> {
    if (!purchaseId) {
      setForm((prev) => ({
        ...prev,
        purchaseId: '',
        purchaseType: '',
        pibNo: '',
        sppbNo: '',
        mawbNo: '',
        lines: [],
      }));
      return;
    }
    const purchaseType =
      confirmedPurchases?.items.find((purchase) => purchase.id === purchaseId)?.type ?? '';
    try {
      const detail = await metalPurchaseService.detail(purchaseId);
      setForm((prev) => ({
        ...prev,
        purchaseId,
        purchaseType,
        // Nomor kepabeanan boleh sudah terekam di PO impor — dipakai sebagai draft awal,
        // tetap bisa dikoreksi karena nomornya baru diverifikasi saat fisik tiba.
        pibNo: purchaseType === 'IMPORT' ? detail.pibNumber || '' : '',
        sppbNo: purchaseType === 'IMPORT' ? detail.sppbNumber || '' : '',
        mawbNo: purchaseType === 'IMPORT' ? detail.mawbNumber || '' : '',
        lines: detail.items.map((item) => ({
          purchaseItemId: item.id,
          productLabel: `${item.productCode} — ${item.productName}`,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
        })),
      }));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat barang PO.'));
    }
  }

  function updateLine(purchaseItemId: string, patch: Partial<LineDraft>): void {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.purchaseItemId === purchaseItemId ? { ...line, ...patch } : line,
      ),
    }));
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!form.purchaseId) {
      toast.error('Pilih dokumen PO terlebih dahulu.');
      return;
    }
    if (form.lines.length === 0) {
      toast.error('PO ini belum punya barang.');
      return;
    }

    const lines: MetalPurchaseDeliveryLinePayload[] = form.lines.map((line) => ({
      purchase_item_id: line.purchaseItemId,
      weight_gram: line.weightGram,
      purity_percent: line.purityPercent,
    }));

    createMutation.mutate({
      purchase_id: form.purchaseId,
      number: form.number || undefined,
      date: form.date,
      tracking_number: form.trackingNumber || undefined,
      received_by_name: form.receivedByName || undefined,
      cor_number: form.corNumber || undefined,
      supplier_do_number: form.supplierDoNumber || undefined,
      pib_no: form.pibNo || undefined,
      sppb_no: form.sppbNo || undefined,
      mawb_no: form.mawbNo || undefined,
      bar_serial_numbers: form.barSerialNumbers || undefined,
      lines,
      charges: [],
    });
  }

  const items = data?.items ?? [];
  const purchaseOptions = (confirmedPurchases?.items ?? []).map((purchase) => ({
    value: purchase.id,
    label: `${purchase.number} — ${purchase.partnerName} · ${purchase.typeLabel}`,
  }));
  const isImportPurchase = form.purchaseType === 'IMPORT';
  const totalWeightGramReceived =
    Math.round(form.lines.reduce((sum, line) => sum + (Number(line.weightGram) || 0), 0) * 10000) /
    10000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Typography variant="muted" className="text-xs">
          {data ? `${data.total} TTB` : ''}
        </Typography>
        {can('goods-receipts:create') && (
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm());
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Buat TTB
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isError && (
        <ErrorState
          variant="inline"
          message={apiErrorMessage(error, 'Daftar TTB gagal dimuat.')}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-foreground-subtle py-10 text-center text-sm">
                    Belum ada TTB.
                  </TableCell>
                </TableRow>
              )}
              {items.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-xs font-semibold">{delivery.number}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{delivery.purchaseNumber}</span>
                      <Badge variant={delivery.purchaseType === 'IMPORT' ? 'info' : 'secondary'} size="sm">
                        {delivery.purchaseTypeLabel}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground-muted text-xs">{delivery.dateLabel}</TableCell>
                  <TableCell>
                    <Badge variant={METAL_PURCHASE_DELIVERY_STATUS_BADGE[delivery.status]} size="sm" dot>
                      {delivery.statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {delivery.status === 'DRAFT' && can('goods-receipts:confirm') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => shipMutation.mutate(delivery.id)}
                          leftIcon={<Ship className="h-3.5 w-3.5" />}
                        >
                          Berangkatkan
                        </Button>
                      )}
                      {(delivery.status === 'DRAFT' || delivery.status === 'IN_TRANSIT') &&
                        can('goods-receipts:confirm') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmMutation.mutate(delivery.id)}
                            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          >
                            Terima
                          </Button>
                        )}
                      {delivery.isDeletable && can('goods-receipts:delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(delivery.id)}
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          Hapus
                        </Button>
                      )}
                      {delivery.isVoidable && can('goods-receipts:void') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoidTarget({ id: delivery.id, number: delivery.number })}
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>TTB Baru</DialogTitle>
            <DialogDescription>
              Pilih PO yang sudah dikonfirmasi. Berat/kadar bisa disesuaikan hasil timbang ulang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">PO Referensi</label>
              <Combobox
                options={purchaseOptions}
                value={form.purchaseId}
                onValueChange={(v) => void handlePurchaseSelect(v)}
                placeholder="Pilih PO yang sudah dikonfirmasi (Lokal atau Impor)…"
                emptyText="Belum ada PO berstatus dikonfirmasi."
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. TTB</label>
                <Input
                  value={form.number}
                  onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                  placeholder="Kosongkan untuk digenerate otomatis"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">No. Surat Jalan</label>
                <Input
                  value={form.supplierDoNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplierDoNumber: e.target.value }))}
                  placeholder="Nomor surat jalan dari supplier"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Tanggal Terima</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Nomor Resi</label>
                <Input
                  value={form.trackingNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">Diterima Oleh</label>
                <Input
                  value={form.receivedByName}
                  onChange={(e) => setForm((prev) => ({ ...prev, receivedByName: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {isImportPurchase && (
              <div className="border-info/40 bg-info/5 space-y-3 rounded-lg border p-3">
                <span className="text-foreground text-xs font-bold">
                  Dokumen Impor &amp; Kepabeanan (Customs Clearance Saat TTB)
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-foreground-subtle mb-1 block text-[11px]">
                      No. PIB (Pemberitahuan Impor)
                    </label>
                    <Input
                      value={form.pibNo}
                      onChange={(e) => setForm((prev) => ({ ...prev, pibNo: e.target.value }))}
                      placeholder="001234/PIB/KPU-TP/2026"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-foreground-subtle mb-1 block text-[11px]">
                      No. SPPB (Persetujuan Pengeluaran)
                    </label>
                    <Input
                      value={form.sppbNo}
                      onChange={(e) => setForm((prev) => ({ ...prev, sppbNo: e.target.value }))}
                      placeholder="SPPB-009876/KPU.01/2026"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-foreground-subtle mb-1 block text-[11px]">
                      No. MAWB (Master Air Waybill)
                    </label>
                    <Input
                      value={form.mawbNo}
                      onChange={(e) => setForm((prev) => ({ ...prev, mawbNo: e.target.value }))}
                      placeholder="SQ-618-99881122"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {form.lines.length > 0 && (
              <div className="border-border/60 bg-surface/40 space-y-2 rounded-lg border p-3">
                <span className="text-foreground text-xs font-bold">Barang Diterima</span>
                {form.lines.map((line) => (
                  <div
                    key={line.purchaseItemId}
                    className="border-border/40 grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="sm:col-span-6">
                      <span className="text-foreground-muted text-xs">{line.productLabel}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-foreground-subtle mb-1 block text-[11px]">Berat (g)</label>
                      <NumberInput
                        value={line.weightGram}
                        onChange={(v) => updateLine(line.purchaseItemId, { weightGram: v ?? 0 })}
                        decimalScale={4}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-foreground-subtle mb-1 block text-[11px]">Kadar (%)</label>
                      <NumberInput
                        value={line.purityPercent}
                        onChange={(v) => updateLine(line.purchaseItemId, { purityPercent: v ?? 0 })}
                        decimalScale={4}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                ))}
                <Typography variant="muted" className="text-xs">
                  Total Berat Fisik Diterima:{' '}
                  <span className="text-foreground font-semibold">
                    {totalWeightGramReceived.toLocaleString('id-ID', { maximumFractionDigits: 4 })} g
                  </span>
                </Typography>
              </div>
            )}

            {form.lines.length > 0 && (
              <CertificatesInput
                value={form.barSerialNumbers}
                onChange={(...args: unknown[]) =>
                  setForm((prev) => ({ ...prev, barSerialNumbers: String(args[2] ?? '') }))
                }
                targetWeight={totalWeightGramReceived}
                weightUnit="GRAM"
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" isLoading={createMutation.isPending}>
                Simpan Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        title={`Batalkan TTB ${voidTarget?.number ?? ''}?`}
        description="Jurnal yang sudah lahir dari TTB ini (keberangkatan dan/atau penerimaan) ikut dibatalkan."
        tone="danger"
        confirmLabel="Batalkan TTB"
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

GoodsReceiptView.displayName = 'GoodsReceiptView';
