'use client';

import { Plus, Trash2 } from 'lucide-react';

import { formatCurrency } from '@/lib/number';
import { MONEY_SCALE, VOUCHER_FUND_LABELS } from '@/lib/cash-voucher';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Typography } from '@/components/ui/Typography';
import { AccountPicker } from '@/components/shared';
import { newFund, type VoucherFundState } from './form-state';
import type { VoucherFund } from '@/types/value-objects';

export interface VoucherFundsEditorProps {
  funds: VoucherFundState[];
  onChange: (funds: VoucherFundState[]) => void;
  fund: VoucherFund;
  /** Σ of the detail rows — what the paying side has to add up to. */
  target: number;
  /** True for cheques and bilyet giro, where the account is the clearing one. */
  deferred?: boolean;
  error?: string;
  disabled?: boolean;
}

/**
 * Which accounts paid, and how much from each.
 *
 * This used to be one picker, and that was right until a single agreed payment
 * left two bank accounts on the same day — a payment recorded twice gets two
 * document numbers and two rows in every report. So the fund side is rows, like
 * the detail side, and the two sums have to meet.
 *
 * The mismatch is shown here rather than left to the API: the clerk is looking at
 * both numbers already, and a rejection on save would name a total they would
 * then have to re-derive by hand.
 */
export function VoucherFundsEditor({
  funds,
  onChange,
  fund,
  target,
  deferred = false,
  error,
  disabled = false,
}: VoucherFundsEditorProps) {
  const total = funds.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const difference = total - target;
  const accountLabel = fund === 'MEMORIAL' ? 'Akun lawan' : `Akun ${VOUCHER_FUND_LABELS[fund].toLowerCase()}`;

  function patchFund(key: string, changes: Partial<VoucherFundState>): void {
    onChange(funds.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-foreground text-sm font-medium">
          {accountLabel}
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </span>
        <Typography variant="muted">
          {deferred
            ? 'Pilih akun giro/cek yang belum cair — bukan rekening bank. Uangnya baru keluar saat instrumennya cair.'
            : 'Dari rekening mana uangnya keluar. Boleh lebih dari satu — totalnya harus sama dengan total rincian.'}
        </Typography>
      </div>

      <div className="space-y-3">
        {funds.map((row, index) => (
          <div
            key={row.key}
            className="border-border bg-surface-raised/40 grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto] md:items-start"
          >
            <AccountPicker
              value={row.accountId}
              onChange={(accountId) => patchFund(row.key, { accountId })}
              // Kas, bank, dan akun giro beredar semuanya aset — mempersempitnya
              // ke sana menahan pilihan yang pasti ditolak buku besar nanti.
              types={['ASSET']}
              placeholder="Pilih rekening…"
              disabled={disabled}
              aria-label={`Akun kas/bank baris ${index + 1}`}
            />

            <Input
              placeholder="mis. transfer pertama"
              value={row.note}
              onChange={(event) => patchFund(row.key, { note: event.target.value })}
              disabled={disabled}
              aria-label={`Keterangan akun kas/bank baris ${index + 1}`}
            />

            <NumberInput
              decimalScale={MONEY_SCALE}
              leftAddon={<span className="text-sm">Rp</span>}
              value={row.amount}
              onChange={(amount) => patchFund(row.key, { amount })}
              disabled={disabled}
              aria-label={`Nominal akun kas/bank baris ${index + 1}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || funds.length === 1}
              onClick={() => onChange(funds.filter((item) => item.key !== row.key))}
              title={funds.length === 1 ? 'Minimal satu rekening' : 'Hapus rekening'}
              aria-label={`Hapus akun kas/bank baris ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...funds, newFund()])}
          leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Tambah Rekening
        </Button>

        <div className="text-right">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground-subtle text-sm">Total dibayar</span>
            <span className="text-foreground text-lg font-medium tabular-nums">
              {formatCurrency(total, { decimalScale: MONEY_SCALE })}
            </span>
          </div>
          {difference !== 0 && (
            <p className="text-destructive text-xs">
              {difference > 0 ? 'Lebih' : 'Kurang'}{' '}
              {formatCurrency(Math.abs(difference), { decimalScale: MONEY_SCALE })} dari total
              rincian.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

VoucherFundsEditor.displayName = 'VoucherFundsEditor';
