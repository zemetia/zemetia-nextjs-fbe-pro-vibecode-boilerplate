'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  apiErrorMessage,
  productionOrderService,
  type ProductionOrderWritePayload,
} from '@/services';
import { useFormErrors, useToast, type FieldErrors } from '@/hooks';
import { fromDateOnly, toDateOnly, today } from '@/lib/date';
import { formatNumber } from '@/lib/number';
import { KARAT_OPTIONS, purityFromKarat } from '@/lib/metal-lot';
import { materialPlan } from '@/lib/production';
import { Combobox } from '@/components/ui/Combobox';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormActionBar } from '@/components/ui/FormActionBar';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Typography } from '@/components/ui/Typography';
import { Textarea } from '@/components/ui/textarea';

const WEIGHT_SCALE = 4;
const DEFAULT_LOSS_TOLERANCE = 2;

export interface ProductionOrderFormState {
  date: string;
  targetDate: string | undefined;
  modelName: string;
  karat: string;
  targetGrossWeightGram: number | undefined;
  targetPieceCount: number | undefined;
  locationName: string;
  lossTolerancePercent: number | undefined;
  notes: string;
}

export function emptyFormState(): ProductionOrderFormState {
  return {
    date: toDateOnly(today()),
    targetDate: undefined,
    modelName: '',
    karat: '',
    targetGrossWeightGram: undefined,
    targetPieceCount: undefined,
    locationName: '',
    lossTolerancePercent: DEFAULT_LOSS_TOLERANCE,
    notes: '',
  };
}

export interface ProductionOrderFormProps {
  orderId?: string;
  orderNumber?: string;
  initialForm?: ProductionOrderFormState;
}

export function ProductionOrderForm({
  orderId,
  orderNumber,
  initialForm,
}: ProductionOrderFormProps) {
  const isEdit = orderId !== undefined;
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState<ProductionOrderFormState>(initialForm ?? emptyFormState());

  const { errors, validate } = useFormErrors(check);

  const karat = form.karat === '' ? undefined : Number(form.karat);
  const purityPercent = karat === undefined ? undefined : purityFromKarat(karat);
  const plan =
    purityPercent === undefined || form.targetGrossWeightGram === undefined
      ? undefined
      : materialPlan(form.targetGrossWeightGram, purityPercent);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ProductionOrderWritePayload = {
        date: form.date,
        ...(form.targetDate ? { target_date: form.targetDate } : {}),
        model_name: form.modelName,
        karat: Number(form.karat),
        target_gross_weight_gram: form.targetGrossWeightGram ?? 0,
        ...(form.targetPieceCount === undefined
          ? {}
          : { target_piece_count: form.targetPieceCount }),
        location_name: form.locationName,
        ...(form.lossTolerancePercent === undefined
          ? {}
          : { loss_tolerance_percent: form.lossTolerancePercent }),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };

      return isEdit
        ? productionOrderService.update(orderId, payload)
        : productionOrderService.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success(
        isEdit ? `SPK ${saved.number} berhasil diperbarui.` : `SPK ${saved.number} dibuat sebagai draft.`,
      );
      router.push(`/admin/production/${saved.id}`);
    },
  });

  function check(): FieldErrors {
    const next: FieldErrors = {};

    if (!form.date) next.date = 'Tanggal SPK wajib diisi';
    if (!form.modelName) next.modelName = 'Model perhiasan wajib diisi';
    if (form.karat === '') next.karat = 'Karat wajib dipilih';

    if (form.targetGrossWeightGram === undefined || form.targetGrossWeightGram <= 0) {
      next.targetGrossWeightGram = 'Berat kotor target harus lebih besar dari nol';
    }

    if (form.targetDate && form.targetDate < form.date) {
      next.targetDate = 'Target selesai tidak boleh lebih awal dari tanggal SPK';
    }

    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  function set<K extends keyof ProductionOrderFormState>(
    key: K,
    value: ProductionOrderFormState[K],
  ): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          label="Tanggal SPK"
          value={fromDateOnly(form.date) ?? null}
          onChange={(value) => set('date', value ? toDateOnly(value) : '')}
          error={errors.date}
          required
        />

        <DatePicker
          label="Target selesai"
          value={fromDateOnly(form.targetDate) ?? null}
          onChange={(value) => set('targetDate', value ? toDateOnly(value) : undefined)}
          error={errors.targetDate}
          hint="Opsional — dipakai untuk memantau SPK yang lewat tenggat."
          clearable
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Model perhiasan"
          value={form.modelName}
          onChange={(e) => set('modelName', e.target.value)}
          error={errors.modelName}
          placeholder="Nama atau model perhiasan..."
          required
        />

        <div className="flex w-full flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Karat <span className="text-destructive">*</span>
          </span>
          <Combobox
            options={KARAT_OPTIONS}
            value={form.karat}
            onValueChange={(value) => set('karat', value)}
            placeholder="Pilih karat…"
            searchPlaceholder="Cari karat…"
            emptyText="Karat tidak ditemukan."
            aria-label="Karat"
          />
          {errors.karat && <span className="text-xs text-destructive">{errors.karat}</span>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput
          label="Berat kotor target"
          value={form.targetGrossWeightGram ?? null}
          onChange={(value) => set('targetGrossWeightGram', value)}
          decimalScale={WEIGHT_SCALE}
          error={errors.targetGrossWeightGram}
          hint="Gram, termasuk alloy."
          required
        />

        <NumberInput
          label="Jumlah keping"
          value={form.targetPieceCount ?? null}
          onChange={(value) => set('targetPieceCount', value)}
          hint="Opsional."
        />

        <NumberInput
          label="Toleransi susut"
          value={form.lossTolerancePercent ?? null}
          onChange={(value) => set('lossTolerancePercent', value)}
          decimalScale={2}
          hint="Persen. Di atas ini, penutupan SPK menuntut penjelasan."
        />
      </div>

      <Input
        label="Lokasi produksi"
        value={form.locationName}
        onChange={(e) => set('locationName', e.target.value)}
        error={errors.locationName}
        placeholder="Lokasi pengerjaan produksi..."
      />

      {plan && purityPercent !== undefined && (
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <Typography variant="small" className="font-medium">
            Bahan yang dituntut rencana ini
          </Typography>
          <dl className="mt-2 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-foreground-subtle">Emas murni</dt>
              <dd className="text-sm text-foreground tabular-nums">
                {formatNumber(plan.fineNeededGram, { decimalScale: WEIGHT_SCALE })} g
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Alloy</dt>
              <dd className="text-sm text-foreground tabular-nums">
                {formatNumber(plan.alloyNeededGram, { decimalScale: WEIGHT_SCALE })} g
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Kadar</dt>
              <dd className="text-sm text-foreground tabular-nums">
                {formatNumber(purityPercent, { decimalScale: 2 })}%
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="spk-notes" className="text-sm font-medium text-foreground">
          Catatan
        </label>
        <Textarea
          id="spk-notes"
          value={form.notes}
          onChange={(event) => set('notes', event.target.value)}
          placeholder="Opsional — mis. permintaan khusus finishing, urutan pengerjaan."
          rows={3}
        />
      </div>

      {mutation.isError && (
        <ErrorState
          variant="inline"
          message={apiErrorMessage(mutation.error, 'SPK gagal disimpan.')}
        />
      )}

      <FormActionBar
        onCancel={() => router.push('/admin/production')}
        submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
        isSubmitting={mutation.isPending}
      >
        <Typography variant="muted">
          {isEdit
            ? `Mengubah draft ${orderNumber ?? ''}`.trim()
            : 'Nomor SPK dibuat otomatis saat disimpan.'}
        </Typography>
      </FormActionBar>
    </form>
  );
}

ProductionOrderForm.displayName = 'ProductionOrderForm';
