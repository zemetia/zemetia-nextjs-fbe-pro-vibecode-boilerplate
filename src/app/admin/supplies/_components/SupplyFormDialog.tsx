'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiErrorMessage, supplyService } from '@/services';
import { useFormErrors, useToast, type FieldErrors } from '@/hooks';
import { SUPPLY_CATEGORY_OPTIONS } from '@/lib/supply';
import { Combobox } from '@/components/ui/Combobox';
import { FormModal } from '@/components/ui/FormModal';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Textarea } from '@/components/ui/textarea';
import type { SupplyCategory, SupplyVO } from '@/types/value-objects';

export interface SupplyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode. */
  supply?: SupplyVO;
}

/**
 * Dialog tambah / ubah master barang non-logam (Supply).
 * Kode barang diketik petugas karena merupakan label fisik barang di rak/pesanan (mis. HNO3-68).
 * Satuan beli adalah teks bebas (mis. "Jerigen 30 kg", "Botol 1 L", "Pcs").
 */
export function SupplyFormDialog({ open, onOpenChange, supply }: SupplyFormDialogProps) {
  const isEdit = supply !== undefined;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [code, setCode] = useState(supply?.code ?? '');
  const [name, setName] = useState(supply?.name ?? '');
  const [category, setCategory] = useState<SupplyCategory>(supply?.category ?? 'OTHER');
  const [unit, setUnit] = useState(supply?.unit ?? '');
  const [lastPriceIdr, setLastPriceIdr] = useState<number | undefined>(supply?.lastPriceIdr);
  const [notes, setNotes] = useState(supply?.notes === '—' ? '' : (supply?.notes ?? ''));

  const { errors, validate } = useFormErrors(check);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category,
        unit: unit.trim(),
        last_price_idr: lastPriceIdr,
        notes: notes.trim() || undefined,
      };

      return isEdit
        ? supplyService.update(supply.id, payload)
        : supplyService.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      toast.success(
        isEdit
          ? `Barang ${saved.code} berhasil diperbarui.`
          : `Barang ${saved.code} berhasil ditambahkan.`,
      );
      onOpenChange(false);
    },
  });

  function check(): FieldErrors {
    const next: FieldErrors = {};

    if (!code.trim()) next.code = 'Kode barang wajib diisi';
    if (!name.trim()) next.name = 'Nama barang wajib diisi';
    if (!unit.trim()) next.unit = 'Satuan barang wajib diisi (mis. Jerigen 30 kg, Pcs)';

    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Ubah Barang ${supply.code}` : 'Tambah Barang Non-Logam'}
      description="Bahan kimia, kowi lebur, sarung tangan, atau peralatan operasional non-emas."
      submitLabel={isEdit ? 'Simpan' : 'Tambah Barang'}
      isSubmitting={mutation.isPending}
      error={
        mutation.isError
          ? apiErrorMessage(mutation.error, 'Barang non-logam gagal disimpan.')
          : undefined
      }
      onSubmit={handleSubmit}
    >
      <Input
        label="Kode barang"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={errors.code}
        placeholder="mis. HNO3-68, KOWI-A5"
        className="font-mono uppercase"
        required
        autoFocus
      />

      <Input
        label="Nama barang"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        placeholder="mis. Asam Nitrat 68%, Kowi Lebur Keramik A5"
        required
      />

      <div className="flex w-full flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Kategori</span>
        <Combobox
          options={SUPPLY_CATEGORY_OPTIONS}
          value={category}
          onValueChange={(val) => setCategory(val as SupplyCategory)}
          placeholder="Pilih kategori…"
          searchPlaceholder="Cari kategori…"
          emptyText="Kategori tidak ditemukan."
          aria-label="Kategori supply"
        />
      </div>

      <Input
        label="Satuan beli"
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        error={errors.unit}
        placeholder="mis. Jerigen 30 kg, Botol 1 L, Pcs, Box"
        required
      />

      <div className="space-y-1">
        <NumberInput
          label="Harga perkiraan terakhir (Rp)"
          value={lastPriceIdr}
          onChange={setLastPriceIdr}
          placeholder="Opsional — mis. 1.250.000"
        />
        <p className="text-xs text-foreground-subtle">
          Sebagai nilai awal perkiraan harga saat barang ini diminta lewat PR.
        </p>
      </div>

      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="supply-notes" className="text-sm font-medium text-foreground">
          Catatan
        </label>
        <Textarea
          id="supply-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Opsional — spesifikasi teknis atau vendor langganan."
          rows={2}
        />
      </div>
    </FormModal>
  );
}

SupplyFormDialog.displayName = 'SupplyFormDialog';
