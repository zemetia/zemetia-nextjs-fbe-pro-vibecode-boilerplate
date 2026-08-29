import { cn } from '@/lib/cn';
import { Typography } from '@/components/ui/Typography';

export interface MoneyTotalVO {
  currencyCode: string;
  amount: number;
  amountLabel: string;
}

export interface MetalTotalVO {
  metal: string;
  metalLabel: string;
  fineWeightGram: number;
  fineWeightGramLabel: string;
}

/**
 * Baris ringkasan sebuah laporan.
 *
 * Nilainya **daftar, bukan satu angka** — berat dipisah per logam dan uang
 * dipisah per mata uang, karena 1.000 g emas + 500 g perak dan USD + IDR adalah
 * dua penjumlahan yang tidak pernah punya arti. Kartunya karena itu menampung
 * beberapa baris nilai, bukan satu angka besar.
 */
export interface ReportStatProps {
  label: string;
  /** Baris nilai. Kosong tampil sebagai "—", bukan sebagai kartu kosong. */
  values: string[];
  hint?: string;
  /** Menandai angka yang perlu ditindaklanjuti — dipakai ember lewat tempo. */
  tone?: 'default' | 'danger';
  className?: string;
}

export function ReportStat({
  label,
  values,
  hint,
  tone = 'default',
  className,
}: ReportStatProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <Typography variant="muted" className="text-xs">
        {label}
      </Typography>

      <div className="mt-1 space-y-0.5">
        {values.length === 0 ? (
          <span className="text-lg font-semibold text-foreground-subtle tabular-nums">—</span>
        ) : (
          values.map((value) => (
            <span
              key={value}
              className={cn(
                'block text-lg font-semibold tabular-nums',
                tone === 'danger' ? 'text-destructive' : 'text-foreground',
              )}
            >
              {value}
            </span>
          ))
        )}
      </div>

      {hint && (
        <Typography variant="muted" className="mt-1 block text-xs">
          {hint}
        </Typography>
      )}
    </div>
  );
}

ReportStat.displayName = 'ReportStat';

/** Label uang per mata uang — dipakai langsung sebagai `values`. */
export function moneyValues(totals: readonly MoneyTotalVO[]): string[] {
  return totals.map((total) => total.amountLabel);
}

/** "Emas 1.234,5000 g murni" per logam. Berat murni yang ditampilkan, bukan kotor. */
export function fineWeightValues(totals: readonly MetalTotalVO[]): string[] {
  return totals.map((total) => `${total.metalLabel} ${total.fineWeightGramLabel}`);
}
