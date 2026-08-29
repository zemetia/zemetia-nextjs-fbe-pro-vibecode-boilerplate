'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Search } from 'lucide-react';

import { approvalService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { APPROVAL_KIND_OPTIONS, APPROVAL_KIND_PERMISSION, APPROVAL_STATUS_OPTIONS } from '@/lib/approval';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Typography } from '@/components/ui/Typography';
import type { ApprovalKind, ApprovalStatus } from '@/types/value-objects';
import { ApprovalsTable } from './ApprovalsTable';

const PAGE_SIZE = 20;
const ALL = 'all';

const KIND_FILTER_OPTIONS = [{ value: ALL, label: 'Semua jenis' }, ...APPROVAL_KIND_OPTIONS];
const STATUS_FILTER_OPTIONS = [{ value: ALL, label: 'Semua status' }, ...APPROVAL_STATUS_OPTIONS];

/**
 * Dua tab, bukan satu daftar dengan filter tersembunyi: "yang harus saya putuskan"
 * dan "yang saya ajukan" adalah dua pertanyaan berbeda dari dua orang berbeda,
 * dan yang memegang kedua wewenang tetap ingin memisahkannya.
 */
const SCOPE_TABS = [
  { value: 'inbox', label: 'Masuk' },
  { value: 'mine', label: 'Pengajuan Saya' },
] as const;

type Scope = (typeof SCOPE_TABS)[number]['value'];

export interface ApprovalsViewProps {
  /** True bila pemegang sesi punya `approvals:list` — antrean seluruh perusahaan. */
  canDecide: boolean;
}

export function ApprovalsView({ canDecide }: ApprovalsViewProps) {
  const { data: session } = useSession();

  const [scope, setScope] = useState<Scope>(canDecide ? 'inbox' : 'mine');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(ALL);
  // Menunggu lebih dulu: yang membuka halaman ini datang untuk memutuskan, dan
  // riwayat keputusan lama tidak boleh mendorongnya ke halaman kedua.
  const [status, setStatus] = useState<string>('PENDING');
  const [page, setPage] = useState(1);

  const permissions = new Set(session?.user.permissions ?? []);

  /**
   * Izin memutuskan datang dari modul dokumennya, bukan dari `approvals:*` —
   * jadi tombol Setujui hanya muncul untuk baris yang izin confirm-nya memang
   * dipegang. Ini petunjuk UI saja; endpointnya memeriksa ulang.
   */
  const canDecideKind = (value: ApprovalKind) =>
    permissions.has(APPROVAL_KIND_PERMISSION[value] as PermissionKey);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    kind: kind === ALL ? undefined : (kind as ApprovalKind),
    status: status === ALL ? undefined : (status as ApprovalStatus),
    mine: scope === 'mine' ? true : undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['approvals', { ...filters, page }],
    queryFn: () => approvalService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {canDecide && (
        <Segmented
          options={SCOPE_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={scope}
          onValueChange={(value) => {
            setScope(value as Scope);
            resetPage();
          }}
          aria-label="Cakupan daftar"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari nomor dokumen, nomor permintaan, atau pengaju…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari permintaan konfirmasi"
          />
        </div>

        <Combobox
          options={KIND_FILTER_OPTIONS}
          value={kind}
          onValueChange={(value) => {
            setKind(value);
            resetPage();
          }}
          className="w-full sm:w-56"
          placeholder="Semua jenis"
          searchPlaceholder="Cari jenis…"
          emptyText="Jenis tidak ditemukan."
          aria-label="Filter jenis konfirmasi"
        />

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
          aria-label="Filter status"
        />
      </div>

      <ApprovalsTable
        requests={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={q !== '' || kind !== ALL || status !== 'PENDING'}
        canDecideKind={canDecideKind}
        currentUserId={session?.user.id}
      />

      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="muted">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
            {formatNumber(data.total)} permintaan
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

ApprovalsView.displayName = 'ApprovalsView';
