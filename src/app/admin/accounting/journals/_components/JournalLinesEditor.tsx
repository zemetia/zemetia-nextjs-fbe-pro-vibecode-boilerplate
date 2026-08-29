'use client';

import { Plus, Trash2 } from 'lucide-react';

import { formatCurrency } from '@/lib/number';
import { cn } from '@/lib/cn';
import { JOURNAL_MONEY_SCALE } from '@/lib/journal-entry';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { AccountPicker } from '@/components/shared';
import { imbalance, newLine, sumSide, type JournalLineState } from './form-state';

const MONEY = { decimalScale: JOURNAL_MONEY_SCALE } as const;

export interface JournalLinesEditorProps {
  lines: JournalLineState[];
  onChange: (lines: JournalLineState[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Baris-baris jurnal, dengan kolom debit dan kredit berdampingan.
 *
 * Berbeda dari voucher — yang jenisnya sudah menentukan sisi, jadi nominalnya
 * satu kolom — jurnal manual justru ada supaya sisinya bisa dipilih per baris.
 * Karena itu keduanya ditampilkan, dan mengisi salah satu **mengosongkan** yang
 * lain: satu baris yang punya debit sekaligus kredit ditolak buku besar, dan
 * mencegahnya di sini jauh lebih murah daripada menerangkannya setelah simpan.
 *
 * Selisihnya dihitung terus-menerus dan ditampilkan di kaki tabel. Sebuah jurnal
 * hanya sah kalau selisihnya nol, jadi angka itu bukan hiasan — ia satu-satunya
 * hal yang perlu dipandang sebelum menekan simpan.
 */
export function JournalLinesEditor({
  lines,
  onChange,
  error,
  disabled = false,
}: JournalLinesEditorProps) {
  const totalDebit = sumSide(lines, 'debit');
  const totalCredit = sumSide(lines, 'credit');
  const difference = imbalance(lines);
  const balanced = difference === 0 && totalDebit > 0;

  function patchLine(key: string, changes: Partial<JournalLineState>): void {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="border-border bg-surface-raised/40 grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_9rem_auto] md:items-start"
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
              label={index === 0 ? 'Keterangan baris' : undefined}
              placeholder="mis. Emas 500 gr"
              value={line.memo}
              onChange={(event) => patchLine(line.key, { memo: event.target.value })}
              disabled={disabled}
              aria-label={`Keterangan baris ${index + 1}`}
            />

            <NumberInput
              label={index === 0 ? 'Debit' : undefined}
              decimalScale={JOURNAL_MONEY_SCALE}
              leftAddon={<span className="text-sm">Rp</span>}
              value={line.debit}
              // Mengisi satu sisi mengosongkan sisi lainnya — bukan memvalidasinya
              // sesudahnya. Satu baris berdiri di satu sisi, selalu.
              onChange={(debit) => patchLine(line.key, { debit, credit: undefined })}
              disabled={disabled}
              aria-label={`Debit baris ${index + 1}`}
            />

            <NumberInput
              label={index === 0 ? 'Kredit' : undefined}
              decimalScale={JOURNAL_MONEY_SCALE}
              leftAddon={<span className="text-sm">Rp</span>}
              value={line.credit}
              onChange={(credit) => patchLine(line.key, { credit, debit: undefined })}
              disabled={disabled}
              aria-label={`Kredit baris ${index + 1}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={index === 0 ? 'md:mt-7' : undefined}
              disabled={disabled || lines.length <= 2}
              onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
              title={lines.length <= 2 ? 'Jurnal minimal dua baris' : 'Hapus baris'}
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

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground-subtle text-sm">Total debit</span>
            <span className="text-foreground text-base font-medium tabular-nums">
              {formatCurrency(totalDebit, MONEY)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground-subtle text-sm">Total kredit</span>
            <span className="text-foreground text-base font-medium tabular-nums">
              {formatCurrency(totalCredit, MONEY)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground-subtle text-sm">Selisih</span>
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                balanced ? 'text-success' : 'text-destructive',
              )}
            >
              {formatCurrency(difference, MONEY)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

JournalLinesEditor.displayName = 'JournalLinesEditor';
