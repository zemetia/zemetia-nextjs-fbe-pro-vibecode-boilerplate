'use client';

import { apiErrorMessage } from '@/services';
import { JOURNAL_STATUS_BADGE } from '@/lib/journal-entry';
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
import type { JournalEntryVO } from '@/types/value-objects';
import { JournalRowMenu } from './JournalRowMenu';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 6;

export interface JournalsTableProps {
  entries: JournalEntryVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
  permissions: {
    canUpdate: boolean;
    canPost: boolean;
    canVoid: boolean;
    canDelete: boolean;
  };
}

export function JournalsTable({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
  permissions,
}: JournalsTableProps) {
  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Nomor</TableHead>
            <TableHead className="w-28">Tanggal</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-10" />
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
                  message={apiErrorMessage(error, 'Daftar jurnal gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-foreground-muted py-10 text-center">
                {isFiltered
                  ? 'Tidak ada jurnal yang cocok dengan filter ini.'
                  : 'Belum ada jurnal yang dicatat.'}
              </TableCell>
            </TableRow>
          )}

          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-foreground-muted font-mono text-xs">
                <span className="block">{entry.number}</span>
                {/* Sumbernya ikut di baris, bukan dua klik jauhnya: ia yang
                    menentukan jurnal ini boleh disentuh dari layar ini atau tidak. */}
                <span className="text-foreground-subtle block">{entry.sourceLabel}</span>
              </TableCell>
              <TableCell className="text-foreground-muted">{entry.dateLabel}</TableCell>
              <TableCell>
                <span className="text-foreground font-medium">{entry.description}</span>
                <span className="text-foreground-subtle block text-xs">{entry.lineCountLabel}</span>
              </TableCell>
              <TableCell className="text-foreground text-right tabular-nums">
                {entry.totalAmountLabel}
              </TableCell>
              <TableCell>
                <Badge variant={JOURNAL_STATUS_BADGE[entry.status]} size="sm" dot>
                  {entry.statusLabel}
                </Badge>
              </TableCell>
              <TableCell>
                <JournalRowMenu entry={entry} {...permissions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

JournalsTable.displayName = 'JournalsTable';
