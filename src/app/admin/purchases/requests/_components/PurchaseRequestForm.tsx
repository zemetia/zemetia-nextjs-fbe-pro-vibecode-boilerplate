'use client';

import { useState, type FormEvent } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileText, Globe, Layers, Package } from 'lucide-react';

import { purchaseRequestService } from '@/services';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { formatCurrency, formatNumber } from '@/lib/number';
import { createPurchaseRequestSchema } from '@/lib/validations/purchase-request';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormActionBar } from '@/components/ui/FormActionBar';
import { Input } from '@/components/ui/Input';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Textarea } from '@/components/ui/textarea';
import { Typography } from '@/components/ui/Typography';
import { PartnerPicker } from '@/components/shared';
import type { PurchaseRequestCategory, PurchaseRequestPriority } from '@/types/value-objects';
import {
  emptyForm,
  emptyItem,
  previewTotalAmount,
  toPayload,
  type PurchaseRequestFormState,
} from './form-state';
import { PurchaseRequestItemsInput } from './PurchaseRequestItemsInput';
import { requestDetailHref, requestListHref } from './routes';

const CATEGORY_TABS: SegmentedOption<PurchaseRequestCategory>[] = [
  {
    value: 'GOLD_LOCAL',
    label: 'Emas Lokal',
    icon: <Package className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'GOLD_IMPORT',
    label: 'Emas Impor',
    icon: <Globe className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'SUPPLY',
    label: 'Non-Logam (Supplies)',
    icon: <Layers className="h-4 w-4" aria-hidden="true" />,
  },
];

const PRIORITY_TABS: SegmentedOption<PurchaseRequestPriority>[] = [
  { value: 'NORMAL', label: 'Normal' },
  {
    value: 'URGENT',
    label: 'Urgent',
    icon: <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />,
  },
];

export interface PurchaseRequestFormProps {
  requestId?: string;
  initialForm?: PurchaseRequestFormState;
}

export function PurchaseRequestForm({ requestId, initialForm }: PurchaseRequestFormProps) {
  const isEdit = requestId !== undefined;
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<PurchaseRequestFormState>(
    () => initialForm ?? emptyForm('GOLD_LOCAL'),
  );

  const { errors, validate } = useFormErrors(() =>
    zodFieldErrors(createPurchaseRequestSchema, toPayload(form)),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = toPayload(form);
      return isEdit
        ? purchaseRequestService.update(requestId, payload)
        : purchaseRequestService.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast.success(
        isEdit
          ? `Permintaan ${saved.number} berhasil diperbarui.`
          : `Permintaan ${saved.number} berhasil diajukan sebagai draft.`,
      );
      router.push(requestDetailHref(saved.id) as Route);
    },
    onError: (err) => toast.apiError(err, 'Permintaan pembelian gagal disimpan.'),
  });

  function handleCategoryChange(nextCategory: PurchaseRequestCategory) {
    if (form.category === nextCategory) return;
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      currencyCode: nextCategory === 'GOLD_IMPORT' ? 'USD' : 'IDR',
      items: [emptyItem(nextCategory)],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  const totalEstAmount = previewTotalAmount(form);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Header Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Informasi Pengajuan Permintaan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Kategori Pengadaan</span>
            <Segmented
              options={CATEGORY_TABS}
              value={form.category}
              onValueChange={handleCategoryChange}
              disabled={isEdit}
              aria-label="Kategori Pengadaan"
            />
            {isEdit && (
              <p className="text-xs text-foreground-muted">
                Kategori pengadaan tidak dapat diubah setelah draft dibuat.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DatePicker
              label="Tanggal Pengajuan"
              value={form.date}
              onChange={(d) => setForm((prev) => ({ ...prev, date: d }))}
              error={errors.date}
              required
              aria-label="Tanggal Pengajuan"
            />

            <DatePicker
              label="Tenggat Dibutuhkan"
              value={form.requiredDate}
              onChange={(d) => setForm((prev) => ({ ...prev, requiredDate: d }))}
              error={errors.required_date}
              aria-label="Tenggat Dibutuhkan"
            />

            <Input
              label="Divisi / Departemen"
              value={form.department}
              onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
              error={errors.department}
              placeholder="mis. Refineri, Workshop, Lab Assay, Umum"
              required
              aria-label="Divisi Peminta"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Prioritas Permintaan</span>
              <Segmented
                options={PRIORITY_TABS}
                value={form.priority}
                onValueChange={(val) => setForm((prev) => ({ ...prev, priority: val }))}
                aria-label="Prioritas Permintaan"
              />
            </div>

            <PartnerPicker
              role="supplier"
              origin={form.category === 'GOLD_IMPORT' ? 'OVERSEAS' : 'LOCAL'}
              value={form.suggestedPartnerId}
              onChange={(partnerId) =>
                setForm((prev) => ({ ...prev, suggestedPartnerId: partnerId }))
              }
              label="Usulan Supplier (Opsional)"
              error={errors.suggested_partner_id}
            />

            <Input
              label="Mata Uang Estimasi"
              value={form.currencyCode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))
              }
              error={errors.currency_code}
              placeholder="IDR atau USD"
              className="font-mono uppercase"
              required
              aria-label="Mata Uang"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-notes" className="text-sm font-medium text-foreground">
              Catatan Pengajuan / Justifikasi
            </label>
            <Textarea
              id="pr-notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Opsional — alasan pengadaan, peruntukan SPK, atau instruksi khusus."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Items List Input Card */}
      <Card>
        <CardContent className="pt-6">
          <PurchaseRequestItemsInput
            category={form.category}
            currencyCode={form.currencyCode}
            items={form.items}
            onChange={(nextItems) => setForm((prev) => ({ ...prev, items: nextItems }))}
            errors={errors}
          />
        </CardContent>
      </Card>

      {/* 3. Summary Card */}
      <Card className="bg-surface/50 border-gold/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Total Estimasi Anggaran Pengadaan</p>
              <p className="text-xs text-foreground-subtle">
                {form.items.length} baris barang · Non-Posting (tidak menjurnal ke GL)
              </p>
            </div>
          </div>
          <div className="text-right">
            <Typography variant="h3" className="font-mono text-gold tabular-nums">
              {form.currencyCode === 'IDR'
                ? formatCurrency(totalEstAmount)
                : `${form.currencyCode} ${formatNumber(totalEstAmount, { decimalScale: 2 })}`}
            </Typography>
          </div>
        </CardContent>
      </Card>

      {/* 4. Action Bar */}
      <FormActionBar
        submitLabel={isEdit ? 'Simpan Perubahan' : 'Ajukan Permintaan (Draft)'}
        isSubmitting={mutation.isPending}
        onCancel={() =>
          router.push((isEdit ? requestDetailHref(requestId) : requestListHref()) as Route)
        }
      />
    </form>
  );
}

PurchaseRequestForm.displayName = 'PurchaseRequestForm';
