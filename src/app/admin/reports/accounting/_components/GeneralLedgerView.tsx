'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiErrorMessage, ledgerReportService } from '@/services';
import { formatNumber } from '@/lib/number';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';
import { AccountPicker } from '@/components/shared';
import {
  ReportFilterBar,
  toPeriodParams,
  type ReportPeriod,
} from '../../_components/ReportFilterBar';
import { ReportStat } from '../../_components/ReportSummary';

const PAGE_SIZE = 50;
const COLUMN_COUNT = 6;
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Buku besar satu akun.
 *
 * Akunnya dipilih lebih dulu dan laporannya tidak memuat apa pun sebelum itu —
 * buku besar tanpa subjek bukan laporan yang kebetulan kosong, ia pertanyaan
 * yang belum lengkap. Yang tampil sebelum akun dipilih karena itu ajakan
 * memilih, bukan tabel nol baris yang terbaca seperti "tidak ada data".
 *
 * Saldo berjalannya berjalan **maju**: baris paling atas adalah yang paling
 * lama. Ini kebalikan dari daftar jurnal, dan disengaja — sebuah kolom saldo
 * berjalan yang barisnya menurun menurut waktu menghitung mundur dari transaksi
 * terakhir ke transaksi pertama, dan itu bug yang hidup bertahun-tahun di
 * laporan versi sebelumnya.
 */
export function GeneralLedgerView() {
  const [accountId, setAccountId] = useState('');
  const [period, setPeriod] = useState<ReportPeriod>({ from: undefined, to: undefined });
  const [page, setPage] = useState(1);

  const filters = { account_id: accountId, ...toPeriodParams(period) };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ledger-report', 'general-ledger', { ...filters, page }],
    queryFn: () => ledgerReportService.generalLedger({ ...filters, page, limit: PAGE_SIZE }),
    enabled: accountId !== '',
    placeholderData: keepPreviousData,
  });

  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <ReportFilterBar
        period={period}
        onPeriodChange={(next) => {
          setPeriod(next);
          resetPage();
        }}
      >
        <AccountPicker
          value={accountId}
          onChange={(value) => {
            setAccountId(value);
            resetPage();
          }}
          label="Akun"
          required
          placeholder="Pilih akun…"
          className="flex w-full flex-col gap-1.5 sm:w-80"
          aria-label="Akun buku besar"
        />
      </ReportFilterBar>

      {accountId === '' ? (
        <div className="border-border text-foreground-muted rounded-lg border border-dashed p-10 text-center">
          Pilih akun lebih dulu — buku besar selalu tentang satu akun.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportStat
              label="Saldo awal"
              values={data ? [data.openingBalanceLabel] : []}
              hint={
                period.from
                  ? 'Saldo sebelum tanggal awal periode.'
                  : 'Periode tidak dibatasi, jadi saldo awalnya nol.'
              }
            />
            <ReportStat label="Mutasi debit" values={data ? [data.period.debitLabel || '—'] : []} />
            <ReportStat
              label="Mutasi kredit"
              values={data ? [data.period.creditLabel || '—'] : []}
            />
            <ReportStat
              label="Saldo akhir"
              values={data ? [data.closingBalanceLabel] : []}
              hint={data ? `Saldo normal ${data.account.normalBalanceLabel.toLowerCase()}.` : ''}
            />
          </div>

          <div className="border-border overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Tanggal</TableHead>
                  <TableHead className="w-40">Nomor</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Baris saldo awal halaman ini, bukan saldo awal periode — halaman 3
                    yang memulai saldonya dari awal periode akan menampilkan kolom
                    saldo yang tidak nyambung dengan halaman sebelumnya. */}
                {data && (
                  <TableRow className="bg-surface-raised/60">
                    <TableCell colSpan={5} className="text-foreground-muted text-sm">
                      {data.page === 1 ? 'Saldo awal periode' : 'Saldo sampai halaman sebelumnya'}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-medium tabular-nums">
                      {data.pageOpeningBalanceLabel}
                    </TableCell>
                  </TableRow>
                )}

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
                        message={apiErrorMessage(error, 'Buku besar gagal dimuat.')}
                        onRetry={() => void refetch()}
                      />
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && !isError && data?.rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="text-foreground-muted py-10 text-center"
                    >
                      Akun ini tidak punya mutasi terposting dalam periode yang dipilih.
                    </TableCell>
                  </TableRow>
                )}

                {data?.rows.map((row) => (
                  <TableRow key={row.lineId}>
                    <TableCell className="text-foreground-muted">{row.dateLabel}</TableCell>
                    <TableCell className="text-foreground-muted font-mono text-xs">
                      <span className="block">{row.number}</span>
                      <span className="text-foreground-subtle block">{row.sourceLabel}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground">{row.description}</span>
                      {row.memo !== '—' && (
                        <span className="text-foreground-subtle block text-xs">{row.memo}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground text-right tabular-nums">
                      {row.debitLabel}
                    </TableCell>
                    <TableCell className="text-foreground text-right tabular-nums">
                      {row.creditLabel}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-medium tabular-nums">
                      {row.runningBalanceLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data && !data.isEmpty && (
            <div className="flex items-center justify-between gap-3">
              <Typography variant="muted">
                Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
                {data.totalLabel}
              </Typography>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

GeneralLedgerView.displayName = 'GeneralLedgerView';
