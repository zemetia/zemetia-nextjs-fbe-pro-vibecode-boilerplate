'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';

import { apiErrorMessage, partnerService } from '@/services';
import { PARTNER_ORIGIN_LABELS } from '@/lib/partner';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import type { PartnerOrigin, PartnerVO } from '@/types/value-objects';
import { PartnerQuickAddDialog } from './PartnerQuickAddDialog';

/** One page is plenty for a picker — the combobox filters what it already holds. */
const OPTIONS_LIMIT = 30;

/**
 * Which side of the trade the document is on — the same partner row can be
 * offered here as a supplier and there as a customer, and nothing but this
 * decides which.
 */
export type PartnerPickerRole = 'supplier' | 'customer';

export interface PartnerPickerProps {
  role: PartnerPickerRole;
  /** The only origin this document accepts — the list never shows another. */
  origin: PartnerOrigin;
  value: string;
  /**
   * Barisnya ikut diserahkan, bukan hanya id-nya: form yang menurunkan sesuatu
   * dari mitranya (mata uang dokumen impor) sudah punya jawabannya di daftar
   * yang sedang tampil, dan menariknya lagi lewat detail hanya menambah satu
   * request untuk data yang sudah dipegang. `undefined` saat pilihan dikosongkan.
   */
  onChange: (partnerId: string, partner: PartnerVO | undefined) => void;
  label?: string;
  error?: string;
  /** Hides the "+" for a role that may not register partners. */
  canCreate?: boolean;
  disabled?: boolean;
}

/**
 * Partner field for a transaction form: a searchable picker already filtered to
 * the role and origin this document deals with, plus the two escape hatches a
 * clerk needs mid-entry — register a partner that is missing, or re-read the
 * list after someone else added one.
 *
 * Shared rather than co-located because both the purchase and the sales form
 * need exactly this control; the only difference between them is `role`.
 */
export function PartnerPicker({
  role,
  origin,
  value,
  onChange,
  label,
  error,
  canCreate = false,
  disabled = false,
}: PartnerPickerProps) {
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, isFetching, isError, error: queryError, refetch } = useQuery({
    queryKey: ['partners', 'options', role, origin],
    queryFn: () =>
      partnerService.list({ role, origin, is_active: true, limit: OPTIONS_LIMIT }),
  });

  const fieldLabel = label ?? (role === 'supplier' ? 'Supplier' : 'Buyer');

  const partners = data?.items ?? [];

  const options = partners.map((partner) => ({
    value: partner.id,
    label: `${partner.code} — ${partner.name}`,
  }));

  function handleChange(partnerId: string): void {
    onChange(
      partnerId,
      partners.find((partner) => partner.id === partnerId),
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {fieldLabel}
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      </span>

      <div className="flex items-center gap-2">
        <Combobox
          options={options}
          value={value}
          onValueChange={handleChange}
          loading={isLoading}
          disabled={disabled}
          placeholder={`Pilih ${fieldLabel.toLowerCase()}…`}
          searchPlaceholder="Cari kode atau nama…"
          emptyText={`Belum ada mitra ${PARTNER_ORIGIN_LABELS[origin].toLowerCase()}.`}
          aria-label={fieldLabel}
          className="flex-1"
        />

        {canCreate && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={disabled}
            onClick={() => setAddOpen(true)}
            title="Tambah mitra baru"
            aria-label="Tambah mitra baru"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled || isFetching}
          onClick={() => void refetch()}
          title="Muat ulang daftar mitra"
          aria-label="Muat ulang daftar mitra"
        >
          <RefreshCw
            className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            aria-hidden="true"
          />
        </Button>
      </div>

      {isError && (
        <p className="text-xs text-destructive">
          {apiErrorMessage(queryError, 'Daftar mitra gagal dimuat.')}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {canCreate && (
        <PartnerQuickAddDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          role={role}
          origin={origin}
          onCreated={(partner) => {
            void refetch();
            // Mitra yang baru dibuat belum ada di daftar yang sedang dipegang —
            // barisnya diserahkan dari respons pembuatannya, supaya mata uang
            // dokumen tetap terisi tanpa menunggu daftarnya termuat ulang.
            onChange(partner.id, partner);
          }}
        />
      )}
    </div>
  );
}

PartnerPicker.displayName = 'PartnerPicker';
