'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { apiErrorMessage } from '@/services';
import { Badge } from '@/components/ui/Badge';
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
import type { MetalLotForm, MetalLotVO } from '@/types/value-objects';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Columns per form. One table serves all four because the lot, its remainder and
 * its history are identical everywhere — only the identity column differs, which
 * is exactly what a column set is for.
 */
const IDENTITY_HEADER: Record<MetalLotForm, string> = {
  BAR: 'Nomor seri',
  GRANULE: 'Barang',
  JEWELRY: 'Karat',
  SCRAP: 'Identitas',
  BAL: 'Tahap',
};

export interface MetalLotsTableProps {
  form: MetalLotForm;
  /** Logam yang sedang dilihat — hanya dipakai untuk kalimat saat daftarnya kosong. */
  metalLabel: string;
  lots: MetalLotVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
}

export function MetalLotsTable({
  form,
  metalLabel,
  lots,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
}: MetalLotsTableProps) {
  const columnCount = 7;

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Kode lot</TableHead>
            <TableHead>{IDENTITY_HEADER[form]}</TableHead>
            <TableHead className="w-24 text-right">Kadar</TableHead>
            <TableHead className="text-right">Berat kotor</TableHead>
            <TableHead className="text-right">Sisa kotor</TableHead>
            <TableHead className="text-right">Sisa murni</TableHead>
            <TableHead className="w-28">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            SKELETON_ROWS.map((key) => (
              <TableRow key={key}>
                <TableCell colSpan={columnCount}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {isError && (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <ErrorState
                  variant="inline"
                  message={apiErrorMessage(error, 'Daftar lot gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && lots.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-10 text-center text-foreground-muted">
                {isFiltered
                  ? 'Tidak ada lot yang cocok dengan filter ini.'
                  : `Belum ada lot ${metalLabel.toLowerCase()} di bentuk ini. Stok lahir saat dokumen pembelian dikonfirmasi.`}
              </TableCell>
            </TableRow>
          )}

          {lots.map((lot) => (
            <TableRow key={lot.id}>
              <TableCell>
                <Link
                  href={`/admin/inventory/lots/${lot.id}`}
                  className="font-mono text-xs font-medium text-primary hover:underline"
                >
                  {lot.code}
                </Link>
              </TableCell>

              <TableCell>
                {form === 'BAR' && (
                  <>
                    <span className="font-mono text-sm text-foreground">{lot.serialNumber}</span>
                    <span className="block text-xs text-foreground-subtle">{lot.refinerName}</span>
                  </>
                )}
                {form === 'JEWELRY' && (
                  <span className="font-medium text-foreground">{lot.karatLabel}</span>
                )}
                {form === 'SCRAP' && (
                  <span className="font-mono text-xs text-foreground-muted">
                    {lot.identityLabel}
                  </span>
                )}
                {form === 'BAL' && (
                  <Badge variant={lot.balStage === 'SEALED' ? 'success' : 'warning'} size="sm" dot>
                    {lot.balStageLabel}
                  </Badge>
                )}
              </TableCell>

              <TableCell className="text-right text-foreground-muted tabular-nums">
                <span className="inline-flex items-center gap-1">
                  {lot.isPurityEstimated && (
                    <TriangleAlert
                      className="h-3.5 w-3.5 text-warning"
                      aria-label="Kadar masih taksiran"
                    />
                  )}
                  {lot.purityPercentLabel}
                </span>
              </TableCell>

              <TableCell className="text-right text-foreground-muted tabular-nums">
                {lot.grossWeightGramLabel}
              </TableCell>
              <TableCell className="text-right text-foreground-muted tabular-nums">
                {lot.remainingGrossWeightGramLabel}
              </TableCell>
              <TableCell className="text-right font-medium text-foreground tabular-nums">
                {lot.remainingFineWeightGramLabel}
              </TableCell>

              <TableCell>
                <Badge variant={lot.isDepleted ? 'secondary' : 'success'} size="sm" dot>
                  {lot.isDepleted ? 'Habis' : 'Ada'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

MetalLotsTable.displayName = 'MetalLotsTable';
