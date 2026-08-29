'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { apiErrorMessage, journalEntryService } from '@/services';
import { JOURNAL_STATUS_BADGE } from '@/lib/journal-entry';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { JournalRowMenu } from './JournalRowMenu';

/** Sepasang label/nilai. `—` sudah datang dari VO, jadi kolom kosong tidak pernah lolos. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground-subtle text-xs">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

export interface JournalDetailViewProps {
  entryId: string;
}

/**
 * Wajah baca sebuah jurnal: apa isinya, lalu siapa yang menyentuhnya — urutan
 * yang dipakai orang saat memeriksanya.
 *
 * Kaki tabel menampilkan total debit dan total kredit **berdampingan**, bukan
 * satu angka "nilai jurnal". Keduanya memang selalu sama — buku besar menolak
 * yang tidak — dan justru karena itu menampilkannya berdua membuat sifat yang
 * dijaga sistem bisa diperiksa mata, bukan cuma dipercaya.
 *
 * Menu aksinya sama persis dengan yang dipakai baris daftar, jadi sebuah jurnal
 * tidak pernah bisa diposting dari satu layar tapi tidak dari layar lainnya.
 */
export function JournalDetailView({ entryId }: JournalDetailViewProps) {
  const { data: session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['journal-entries', 'detail', entryId],
    queryFn: () => journalEntryService.detail(entryId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data jurnal gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{data.number}</Typography>
            <Badge variant={JOURNAL_STATUS_BADGE[data.status]} size="sm" dot>
              {data.statusLabel}
            </Badge>
          </div>
          <Typography variant="muted">
            {data.sourceLabel} · {data.dateLabel}
          </Typography>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-foreground block text-lg font-semibold tabular-nums">
              {data.totalAmountLabel}
            </span>
            <span className="text-foreground-subtle block text-xs">{data.lineCountLabel}</span>
          </div>

          <JournalRowMenu
            entry={data}
            canUpdate={can('journal-entries:update')}
            canPost={can('journal-entries:post')}
            canVoid={can('journal-entries:void')}
            canDelete={can('journal-entries:delete')}
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Keterangan</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography>{data.description}</Typography>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Baris Jurnal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-border overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-foreground-subtle text-right tabular-nums">
                      {line.lineNo}
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground-muted block font-mono text-xs">
                        {line.accountCode}
                      </span>
                      <span className="text-foreground">{line.accountName}</span>
                    </TableCell>
                    <TableCell className="text-foreground-muted text-sm">{line.memo}</TableCell>
                    <TableCell className="text-foreground text-right tabular-nums">
                      {line.debitLabel}
                    </TableCell>
                    <TableCell className="text-foreground text-right tabular-nums">
                      {line.creditLabel}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className="bg-surface-raised/60">
                  <TableCell colSpan={3} className="text-foreground text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-foreground text-right font-semibold tabular-nums">
                    {data.totalDebitLabel}
                  </TableCell>
                  <TableCell className="text-foreground text-right font-semibold tabular-nums">
                    {data.totalCreditLabel}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Jejak</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dibuat oleh" value={data.createdByName} />
          <Field label="Diposting oleh" value={data.postedByName} />
          <Field label="Tanggal posting" value={data.postedAtLabel} />
          <Field label="Dibatalkan oleh" value={data.voidedByName} />
          {data.status === 'VOID' && (
            <>
              <Field label="Tanggal pembatalan" value={data.voidedAtLabel} />
              <Field label="Alasan pembatalan" value={data.voidReason} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

JournalDetailView.displayName = 'JournalDetailView';
