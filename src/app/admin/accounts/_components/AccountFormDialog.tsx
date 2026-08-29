'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accountService, apiErrorMessage, flattenAccounts } from '@/services';
import { useFormErrors, useToast, type FieldErrors } from '@/hooks';
import {
  ACCOUNT_MAX_CHILDREN,
  canHaveChildren,
  childCodePadding,
  childCodePrefix,
  nextChildOrdinal,
  parseAccountCode,
} from '@/lib/account-code';
import { accountTypeFromCode, ACCOUNT_TYPE_LABELS } from '@/lib/account';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/Combobox';
import { FormModal } from '@/components/ui/FormModal';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Textarea } from '@/components/ui/textarea';
import { Typography } from '@/components/ui/Typography';
import type { AccountNodeVO } from '@/types/value-objects';

export interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The whole chart — the parent picker and the slot check both read from it. */
  accounts: AccountNodeVO[];
  /** Present in edit mode. */
  account?: AccountNodeVO;
  /** Pre-selected parent when the dialog is opened from a row's "add child". */
  defaultParentId?: string;
}

/**
 * Add or rename one node of the chart of accounts.
 *
 * Five fields, one concern, no repeatable rows — a modal by the surface rules
 * in LAYOUT/03-form-pages.md. There is no separate "create folder" flow: a node
 * becomes a folder the moment something is created under it, so this same
 * dialog opens with the parent pre-filled from any row's "Tambah sub-akun".
 *
 * The code is not typed. The digits the parent contributes are rendered as a
 * locked prefix and only the one digit that decides the position among its
 * siblings is editable — which is exactly what the API accepts.
 */
export function AccountFormDialog({
  open,
  onOpenChange,
  accounts,
  account,
  defaultParentId,
}: AccountFormDialogProps) {
  const isEdit = account !== undefined;
  const toast = useToast();
  const queryClient = useQueryClient();

  const flat = flattenAccounts(accounts);

  const [parentId, setParentId] = useState(defaultParentId ?? '');
  const [ordinal, setOrdinal] = useState<number | undefined>(undefined);
  const [name, setName] = useState(account?.name ?? '');
  const [description, setDescription] = useState(account?.description ?? '');
  const [isTan, setIsTan] = useState(account?.isTan ?? false);

  const parent = flat.find((node) => node.id === parentId);
  const siblings = parent?.children ?? [];
  const usedOrdinals = siblings
    .map((child) => parseAccountCode(child.code)?.at(-1))
    .filter((slot): slot is number => slot !== undefined);
  const suggestedOrdinal = parent ? nextChildOrdinal(parent.code, siblings.map((c) => c.code)) : null;

  // Adjust-state-during-render: switching parent re-seeds the suggested slot and
  // inherits the parent's ownership flag. A `useEffect` would be a second render
  // pass and is banned by the project's lint rules.
  const [lastParentId, setLastParentId] = useState(parentId);
  if (!isEdit && parentId !== lastParentId) {
    setLastParentId(parentId);
    setOrdinal(suggestedOrdinal ?? undefined);
    if (parent) setIsTan(parent.isTan);
  }

  const effectiveOrdinal = ordinal ?? suggestedOrdinal ?? undefined;
  const prefix = parent ? childCodePrefix(parent.code) : '';
  const padding = parent ? childCodePadding(parent.code) : '';
  const previewCode =
    parent && effectiveOrdinal !== undefined ? `${prefix}${effectiveOrdinal}${padding}` : '';
  const previewType = previewCode ? accountTypeFromCode(previewCode) : null;

  // Declared here, not with the other state: the check reads the derived code
  // above and runs during render, so everything it touches has to exist first.
  const { errors, validate } = useFormErrors(check);

  const parentOptions = flat
    .filter((node) => canHaveChildren(node.code) && node.isActive && !node.hasMutations)
    .map((node) => ({
      value: node.id,
      // Non-breaking spaces: cmdk searches the label text, and real spaces at
      // the start would be collapsed away by the renderer.
      label: `${'  '.repeat(node.level - 1)}${node.code} — ${node.name}`,
    }));

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? accountService.update(account.id, {
            name: name.trim(),
            description: description.trim(),
            is_tan: isTan,
          })
        : accountService.create({
            parent_id: parentId,
            ordinal: effectiveOrdinal,
            name: name.trim(),
            description: description.trim() || undefined,
            is_tan: isTan,
          }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(
        isEdit
          ? `Akun ${saved.code} berhasil diperbarui.`
          : `Akun ${saved.code} ${saved.name} berhasil dibuat.`,
      );
      onOpenChange(false);
    },
  });

  function check(): FieldErrors {
    const next: FieldErrors = {};

    if (!isEdit) {
      if (!parentId) next.parentId = 'Induk akun wajib dipilih';
      else if (suggestedOrdinal === null && effectiveOrdinal === undefined) {
        next.ordinal = `Induk ini sudah punya ${ACCOUNT_MAX_CHILDREN} turunan`;
      }

      if (effectiveOrdinal === undefined) next.ordinal = next.ordinal ?? 'Urutan kode wajib diisi';
      else if (effectiveOrdinal < 1 || effectiveOrdinal > ACCOUNT_MAX_CHILDREN) {
        next.ordinal = `Urutan kode hanya boleh 1 sampai ${ACCOUNT_MAX_CHILDREN}`;
      } else if (usedOrdinals.includes(effectiveOrdinal)) {
        next.ordinal = `Kode ${previewCode} sudah dipakai akun lain`;
      }
    }

    if (!name.trim()) next.name = 'Nama akun wajib diisi';

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
      title={isEdit ? `Ubah Akun ${account.code}` : 'Tambah Akun'}
      description={
        isEdit
          ? 'Kode dan induk akun mengikuti posisinya di bagan dan tidak bisa diubah di sini.'
          : 'Pilih induknya, lalu kode akun dibuat otomatis. Akun yang dipilih sebagai induk otomatis menjadi folder.'
      }
      submitLabel={isEdit ? 'Simpan' : 'Tambah Akun'}
      isSubmitting={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error, 'Akun gagal disimpan.') : undefined}
      onSubmit={handleSubmit}
    >
      {isEdit ? (
        <div className="rounded-md border border-border bg-surface-raised px-3 py-2">
          <Typography variant="muted" className="text-xs">
            Kode akun
          </Typography>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {account.code} · {account.typeLabel}
          </p>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="account-parent" className="text-sm font-medium text-foreground">
              Induk akun
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Combobox
              options={parentOptions}
              value={parentId}
              onValueChange={setParentId}
              placeholder="Pilih folder induk…"
              searchPlaceholder="Cari kode atau nama akun…"
              emptyText="Tidak ada folder yang cocok."
              aria-label="Induk akun"
              className="font-mono"
            />
            {errors.parentId ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.parentId}
              </p>
            ) : (
              <p className="text-xs text-foreground-subtle">
                Hanya akun yang belum dipakai transaksi dan belum di level terdalam yang bisa jadi
                induk.
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Kode akun</span>
            <div className="flex items-stretch">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-surface-raised px-3 font-mono text-sm tabular-nums text-foreground-muted">
                {prefix || '—'}
              </span>
              <div className="w-16">
                <NumberInput
                  value={effectiveOrdinal ?? null}
                  onChange={setOrdinal}
                  disabled={!parent}
                  aria-label="Urutan kode akun"
                  className="rounded-none text-center font-mono"
                />
              </div>
              <span className="flex h-9 items-center rounded-r-md border border-l-0 border-input bg-surface-raised px-3 font-mono text-sm tabular-nums text-foreground-subtle">
                {padding || '—'}
              </span>
            </div>
            {errors.ordinal ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.ordinal}
              </p>
            ) : (
              <p className="text-xs text-foreground-subtle">
                {previewCode
                  ? `Kode akun: ${previewCode}${previewType ? ` · ${ACCOUNT_TYPE_LABELS[previewType]}` : ''}. Hanya angka di tengah yang bisa diubah — bagian depan mengikuti induknya.`
                  : 'Pilih induk akun lebih dulu.'}
              </p>
            )}
          </div>
        </>
      )}

      <Input
        label="Nama akun"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        placeholder="mis. Bank BCA"
        required
        autoFocus={isEdit}
      />

      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="account-description" className="text-sm font-medium text-foreground">
          Keterangan
        </label>
        <Textarea
          id="account-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Opsional — dipakai saat akun ini mudah tertukar dengan akun lain."
          rows={2}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
        <Checkbox
          checked={isTan}
          onCheckedChange={(checked) => setIsTan(checked === true)}
          aria-label="Milik PT TAN Export"
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Milik PT TAN Export</span>
          <span className="block text-xs text-foreground-subtle">
            Menandai akun yang khusus dipakai PT TAN Export, supaya bisa disaring terpisah di bagan
            dan laporan.
          </span>
        </span>
      </label>
    </FormModal>
  );
}

AccountFormDialog.displayName = 'AccountFormDialog';
