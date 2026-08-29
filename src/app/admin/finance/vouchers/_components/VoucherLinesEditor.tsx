'use client';

import { Plus, Trash2 } from 'lucide-react';

import { formatCurrency } from '@/lib/number';
import { MONEY_SCALE } from '@/lib/cash-voucher';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { AccountPicker } from '@/components/shared';
import { newLine, type VoucherLineState } from './form-state';

export interface VoucherLinesEditorProps {
  lines: VoucherLineState[];
  onChange: (lines: VoucherLineState[]) => void;
  total: number;
  error?: string;
  disabled?: boolean;
}

/**
 * The voucher's detail rows.
 *
 * There is no debit/credit column, by design: the voucher type already says which
 * side these rows land on, and asking a second time would let a BKK be booked as
 * if money had come in. Amounts are therefore always positive.
 *
 * The last row cannot be removed — a voucher with no rows has no total and no
 * journal, so the floor is enforced here rather than discovered at submit.
 */
export function VoucherLinesEditor({
  lines,
  onChange,
  total,
  error,
  disabled = false,
}: VoucherLinesEditorProps) {
  function patchLine(key: string, changes: Partial<VoucherLineState>): void {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="border-border bg-surface-raised/40 grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto] md:items-start"
          >
            <AccountPicker
              value={line.accountId}
              onChange={(accountId) => patchLine(line.key, { accountId })}
              label={index === 0 ? 'Akun' : undefined}
              required={index === 0}
              placeholder="Pilih akun…"
              disabled={disabled}
              aria-label={`Akun baris ${index + 1}`}
            />

            <Input
              label={index === 0 ? 'Keterangan' : undefined}
              placeholder="mis. Emas 500 gr"
              value={line.description}
              onChange={(event) => patchLine(line.key, { description: event.target.value })}
              disabled={disabled}
              aria-label={`Keterangan baris ${index + 1}`}
            />

            <NumberInput
              label={index === 0 ? 'Nominal' : undefined}
              decimalScale={MONEY_SCALE}
              leftAddon={<span className="text-sm">Rp</span>}
              value={line.amount}
              onChange={(amount) => patchLine(line.key, { amount })}
              disabled={disabled}
              aria-label={`Nominal baris ${index + 1}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={index === 0 ? 'md:mt-7' : undefined}
              disabled={disabled || lines.length === 1}
              onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
              title={lines.length === 1 ? 'Minimal satu baris' : 'Hapus baris'}
              aria-label={`Hapus baris ${index + 1}`}
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
          onClick={() => onChange([...lines, newLine()])}
          leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Tambah Baris
        </Button>

        <div className="flex items-baseline gap-2">
          <span className="text-foreground-subtle text-sm">Total</span>
          <span className="text-foreground text-lg font-medium tabular-nums">
            {formatCurrency(total, { decimalScale: MONEY_SCALE })}
          </span>
        </div>
      </div>
    </div>
  );
}

VoucherLinesEditor.displayName = 'VoucherLinesEditor';
