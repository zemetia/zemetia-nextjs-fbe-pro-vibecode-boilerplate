'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2, TriangleAlert } from 'lucide-react';

import { apiErrorMessage, ledgerReportService } from '@/services';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import {
  ReportFilterBar,
  toPeriodParams,
  type ReportPeriod,
} from '../../_components/ReportFilterBar';

const COLUMN_COUNT = 7;
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Neraca saldo — saldo awal, mutasi periode, dan saldo akhir seluruh akun daun.
 *
 * Tidak dipaginasi, dan itu keputusan laporannya: totalnya harus menjumlahkan
 * persis baris yang tampil. Neraca saldo yang kakinya menghitung 200 akun
 * sementara layarnya menunjukkan 25 tidak bisa diperiksa dengan kalkulator, dan
 * diperiksa dengan kalkulator adalah satu-satunya alasan laporan ini ada.
 *
 * Penanda seimbang di atas tabel dihitung server dan bukan disimpulkan layar.
 * Kalau ia merah, yang salah ada di buku — bukan di tampilannya.
 */
export function TrialBalanceView() {
  const [period, setPeriod] = useState<ReportPeriod>({ from: undefined, to: undefined });
  const [includeEmpty, setIncludeEmpty] = useState(false);

  const filters = {
    ...toPeriodParams(period),
    include_empty: includeEmpty ? ('true' as const) : ('false' as const),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ledger-report', 'trial-balance', filters],
    queryFn: () => ledgerReportService.trialBalance(filters),
    placeholderData: keepPreviousData,
  });

  const balanced = data?.totals.isBalanced ?? true;

  return (
    <div className="space-y-4">
      <ReportFilterBar period={period} onPeriodChange={setPeriod}>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="include-empty"
            checked={includeEmpty}
            onCheckedChange={setIncludeEmpty}
            aria-label="Tampilkan akun tanpa mutasi"
          />
          <label htmlFor="include-empty" className="text-foreground text-sm">
            Tampilkan akun tanpa mutasi
          </label>
        </div>
      </ReportFilterBar>

      {data && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm',
            balanced
              ? 'border-success/25 bg-success-subtle text-success'
              : 'border-destructive/25 bg-destructive-subtle text-destructive',
          )}
        >
          {balanced ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          )}
          <span>
            {balanced
              ? `Seimbang — total debit sama dengan total kredit di ketiga pasang kolom, atas ${data.accountCountLabel}.`
              : 'Tidak seimbang. Ada jurnal terposting yang debit dan kreditnya tidak sama — periksa mutasi jurnal pada periode ini.'}
          </span>
        </div>
      )}

      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="align-bottom">
                Akun
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Saldo awal
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Mutasi periode
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Saldo akhir
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              SKELETON_ROWS.map((key) => (
                <TableRow key={key}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <ErrorState
                    variant="inline"
                    message={apiErrorMessage(error, 'Neraca saldo gagal dimuat.')}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.isEmpty && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="text-foreground-muted py-10 text-center"
                >
                  Belum ada jurnal terposting pada periode ini, jadi tidak ada akun yang bergerak.
                </TableCell>
              </TableRow>
            )}

            {data?.rows.map((row) => (
              <TableRow key={row.account.id}>
                <TableCell>
                  <span className="text-foreground-muted block font-mono text-xs">
                    {row.account.code}
                  </span>
                  <span className="text-foreground">{row.account.name}</span>
                </TableCell>
                <TableCell className="text-foreground-muted text-right tabular-nums">
                  {row.opening.debitLabel}
                </TableCell>
                <TableCell className="text-foreground-muted text-right tabular-nums">
                  {row.opening.creditLabel}
                </TableCell>
                <TableCell className="text-foreground text-right tabular-nums">
                  {row.period.debitLabel}
                </TableCell>
                <TableCell className="text-foreground text-right tabular-nums">
                  {row.period.creditLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-medium tabular-nums">
                  {row.closing.debitLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-medium tabular-nums">
                  {row.closing.creditLabel}
                </TableCell>
              </TableRow>
            ))}

            {data && !data.isEmpty && (
              <TableRow className="bg-surface-raised/60">
                <TableCell className="text-foreground font-medium">
                  Total · {data.accountCountLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.opening.debitLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.opening.creditLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.period.debitLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.period.creditLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.closing.debitLabel}
                </TableCell>
                <TableCell className="text-foreground text-right font-semibold tabular-nums">
                  {data.totals.closing.creditLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Typography variant="muted">
        Hanya jurnal berstatus diposting yang dihitung, dan hanya akun yang tidak punya turunan —
        saldo akun induk adalah jumlah anaknya, jadi memunculkannya akan menghitung angka yang sama
        dua kali.
      </Typography>
    </div>
  );
}

TrialBalanceView.displayName = 'TrialBalanceView';
