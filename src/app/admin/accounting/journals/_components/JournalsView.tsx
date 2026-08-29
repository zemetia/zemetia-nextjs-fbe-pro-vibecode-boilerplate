'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Search } from 'lucide-react';

import { journalEntryService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { JOURNAL_SOURCE_OPTIONS, JOURNAL_STATUS_OPTIONS } from '@/lib/journal-entry';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import { AccountPicker } from '@/components/shared';
import type { JournalSource, JournalStatus } from '@/types/value-objects';
import { JournalsTable } from './JournalsTable';

const PAGE_SIZE = 20;
const ALL = 'all';

const STATUS_FILTER_OPTIONS = [{ value: ALL, label: 'Semua status' }, ...JOURNAL_STATUS_OPTIONS];
const SOURCE_FILTER_OPTIONS = [{ value: ALL, label: 'Semua sumber' }, ...JOURNAL_SOURCE_OPTIONS];

/**
 * Mutasi jurnal umum — seluruh jurnal dari **semua** modul, bukan hanya yang
 * diketik manual.
 *
 * Satu daftar, bukan dua, karena pertanyaan yang dibawa orang ke layar ini
 * hampir selalu "apa saja yang masuk buku hari ini", bukan "jurnal apa yang
 * saya ketik sendiri". Filter sumber menyediakan yang kedua kalau memang itu
 * yang dicari.
 *
 * Filter akun ada di sini dan bukan cuma di buku besar, karena "jurnal apa saja
 * yang menyentuh kas bulan ini" dijawab dari daftar, sementara buku besar
 * menjawab "berapa saldonya sesudah masing-masing".
 */
export function JournalsView() {
  const router = useRouter();
  const { data: session } = useSession();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [accountId, setAccountId] = useState('');
  const [page, setPage] = useState(1);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  // Ditunda supaya mengetik nomor nota berbiaya satu permintaan, bukan sepuluh —
  // API-nya dibatasi laju per IP.
  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    status: status === ALL ? undefined : (status as JournalStatus),
    source: source === ALL ? undefined : (source as JournalSource),
    ...(accountId === '' ? {} : { account_id: accountId }),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['journal-entries', { ...filters, page }],
    queryFn: () => journalEntryService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  /** Perubahan filter apa pun membatalkan nomor halaman yang sedang dilihat. */
  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari nomor jurnal atau keterangan…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari jurnal"
          />
        </div>

        <Combobox
          options={STATUS_FILTER_OPTIONS}
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          className="w-full sm:w-44"
          placeholder="Semua status"
          searchPlaceholder="Cari status…"
          emptyText="Status tidak ditemukan."
          aria-label="Filter status jurnal"
        />

        <Combobox
          options={SOURCE_FILTER_OPTIONS}
          value={source}
          onValueChange={(value) => {
            setSource(value);
            resetPage();
          }}
          className="w-full sm:w-48"
          placeholder="Semua sumber"
          searchPlaceholder="Cari sumber…"
          emptyText="Sumber tidak ditemukan."
          aria-label="Filter sumber jurnal"
        />

        <AccountPicker
          value={accountId}
          onChange={(value) => {
            setAccountId(value);
            resetPage();
          }}
          placeholder="Semua akun"
          className="flex w-full flex-col gap-1.5 sm:w-64"
          aria-label="Filter akun"
        />

        {can('journal-entries:create') && (
          <Button
            className="ml-auto"
            onClick={() => router.push('/admin/accounting/journals/new')}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Jurnal Manual
          </Button>
        )}
      </div>

      <JournalsTable
        entries={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={q !== '' || status !== ALL || source !== ALL || accountId !== ''}
        permissions={{
          canUpdate: can('journal-entries:update'),
          canPost: can('journal-entries:post'),
          canVoid: can('journal-entries:void'),
          canDelete: can('journal-entries:delete'),
        }}
      />

      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="muted">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
            {formatNumber(data.total)} jurnal
          </Typography>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasPrevPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

JournalsView.displayName = 'JournalsView';
