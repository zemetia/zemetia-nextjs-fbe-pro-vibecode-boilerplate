'use client';

import Link from 'next/link';
import type { Route } from 'next';

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
import type { ApprovalKind, ApprovalRequestVO, ApprovalStatus } from '@/types/value-objects';
import { ApprovalRowActions } from './ApprovalRowActions';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 6;

/** Status memilih nada badge — yang ditolak tidak boleh terbaca netral. */
const STATUS_VARIANT: Record<ApprovalStatus, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

export interface ApprovalsTableProps {
  requests: ApprovalRequestVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
  /** Petunjuk UI — endpointnya memeriksa ulang tiap keputusan. */
  canDecideKind: (kind: ApprovalKind) => boolean;
  currentUserId?: string;
}

export function ApprovalsTable({
  requests,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
  canDecideKind,
  currentUserId,
}: ApprovalsTableProps) {
  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Dokumen</TableHead>
            <TableHead>Perihal</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead className="w-40">Pengaju</TableHead>
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
                  message={apiErrorMessage(error, 'Daftar konfirmasi gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-foreground-muted py-10 text-center">
                {isFiltered
                  ? 'Tidak ada permintaan yang cocok dengan filter ini.'
                  : 'Tidak ada permintaan yang menunggu konfirmasi.'}
              </TableCell>
            </TableRow>
          )}

          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="text-foreground-muted font-mono text-xs">
                {/* Nomor dokumennya yang ditampilkan besar, bukan nomor permintaan:
                    nomor antrean tidak menolong siapa pun mengenali dokumen. */}
                {request.subject?.href ? (
                  <Link
                    href={request.subject.href as Route}
                    className="text-primary block font-medium hover:underline"
                  >
                    {request.subject.number}
                  </Link>
                ) : (
                  <span className="text-foreground block font-medium">
                    {request.subject?.number ?? request.number}
                  </span>
                )}
                <span className="text-foreground-subtle block">{request.moduleLabel}</span>
              </TableCell>

              <TableCell>
                {request.isSubjectMissing ? (
                  <span className="text-foreground-muted text-sm italic">
                    Dokumennya sudah tidak ada — permintaan ini tinggal ditutup.
                  </span>
                ) : (
                  <>
                    <span className="text-foreground font-medium">{request.subject?.title}</span>
                    <span className="text-foreground-subtle block text-xs">
                      {request.kindLabel} · {request.subject?.subtitle} ·{' '}
                      {request.subject?.dateLabel}
                    </span>
                  </>
                )}
              </TableCell>

              <TableCell className="text-right tabular-nums">
                <span className="text-foreground block">
                  {request.subject?.amountIdrLabel ?? '—'}
                </span>
                <span className="text-foreground-subtle block text-xs">
                  {request.subject?.weightGramLabel ?? '—'}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-foreground text-sm">{request.requestedByName}</span>
                <span className="text-foreground-subtle block text-xs">
                  {request.requestedAtLabel}
                </span>
              </TableCell>

              <TableCell>
                <Badge variant={STATUS_VARIANT[request.status]} size="sm" dot>
                  {request.statusLabel}
                </Badge>
                {!request.isPending && request.decidedByName !== '—' && (
                  <span className="text-foreground-subtle mt-1 block text-xs">
                    {request.decidedByName}
                  </span>
                )}
              </TableCell>

              <TableCell>
                <ApprovalRowActions
                  request={request}
                  canDecide={canDecideKind(request.kind)}
                  isRequester={
                    currentUserId !== undefined && currentUserId === request.requestedById
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

ApprovalsTable.displayName = 'ApprovalsTable';
