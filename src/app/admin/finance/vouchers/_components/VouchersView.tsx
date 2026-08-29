'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Search } from 'lucide-react';

import { cashVoucherService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import {
  VOUCHER_CATEGORY_OPTIONS,
  VOUCHER_KIND_LABELS,
  VOUCHER_STATUS_OPTIONS,
} from '@/lib/cash-voucher';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Typography } from '@/components/ui/Typography';
import type {
  VoucherCategory,
  VoucherDirection,
  VoucherFund,
  VoucherKind,
  VoucherStatus,
} from '@/types/value-objects';
import { VouchersTable } from './VouchersTable';

const PAGE_SIZE = 20;
const ALL = 'all';

const STATUS_FILTER_OPTIONS = [{ value: ALL, label: 'Semua status' }, ...VOUCHER_STATUS_OPTIONS];
const CATEGORY_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua kategori' },
  ...VOUCHER_CATEGORY_OPTIONS,
];

/**
 * The four field abbreviations as one tab strip.
 *
 * The list is deliberately shared rather than split into four pages: finance
 * works by day, not by document type — "what moved through the cash box today"
 * is a far more common question than "every BKK this month". Each tab is just a
 * pair of filters over the same table.
 */
const KIND_TABS: readonly {
  value: VoucherKind | typeof ALL;
  fund?: VoucherFund;
  direction?: VoucherDirection;
}[] = [
  { value: ALL },
  { value: 'BKM', fund: 'CASH', direction: 'IN' },
  { value: 'BKK', fund: 'CASH', direction: 'OUT' },
  { value: 'BBM', fund: 'BANK', direction: 'IN' },
  { value: 'BBK', fund: 'BANK', direction: 'OUT' },
  { value: 'BM', fund: 'MEMORIAL' },
];

const KIND_TAB_OPTIONS = KIND_TABS.map((tab) => ({
  value: tab.value,
  label: tab.value === ALL ? 'Semua' : tab.value,
}));

export function VouchersView() {
  const router = useRouter();
  const { data: session } = useSession();

  const [kind, setKind] = useState<VoucherKind | typeof ALL>(ALL);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [page, setPage] = useState(1);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  // Debounced so typing a payee name costs one request, not ten — the API is
  // rate limited per IP.
  const debouncedQ = useDebouncedValue(q, 300);

  const tab = KIND_TABS.find((item) => item.value === kind);

  const filters = {
    q: debouncedQ,
    ...(tab?.fund ? { fund: tab.fund } : {}),
    ...(tab?.direction ? { direction: tab.direction } : {}),
    status: status === ALL ? undefined : (status as VoucherStatus),
    category: category === ALL ? undefined : (category as VoucherCategory),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cash-vouchers', { ...filters, page }],
    queryFn: () => cashVoucherService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  /** Any filter change invalidates the current page number. */
  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Segmented
          options={KIND_TAB_OPTIONS}
          value={kind}
          onValueChange={(value) => {
            setKind(value as VoucherKind | typeof ALL);
            resetPage();
          }}
          aria-label="Jenis voucher"
        />
        {kind !== ALL && (
          <Typography variant="muted">{VOUCHER_KIND_LABELS[kind as VoucherKind]}</Typography>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari nomor, pihak, keperluan, atau no. referensi…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari voucher"
          />
        </div>

        <Combobox
          options={STATUS_FILTER_OPTIONS}
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          className="w-full sm:w-48"
          placeholder="Semua status"
          searchPlaceholder="Cari status…"
          emptyText="Status tidak ditemukan."
          aria-label="Filter status"
        />

        <Combobox
          options={CATEGORY_FILTER_OPTIONS}
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            resetPage();
          }}
          className="w-full sm:w-48"
          placeholder="Semua kategori"
          searchPlaceholder="Cari kategori…"
          emptyText="Kategori tidak ditemukan."
          aria-label="Filter kategori"
        />

        {can('cash-vouchers:create') && (
          <Button
            className="ml-auto"
            onClick={() => router.push('/admin/finance/vouchers/new')}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Buat Voucher
          </Button>
        )}
      </div>

      <VouchersTable
        vouchers={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={q !== '' || status !== ALL || category !== ALL || kind !== ALL}
        permissions={{
          canUpdate: can('cash-vouchers:update'),
          canDelete: can('cash-vouchers:delete'),
          canSubmit: can('cash-vouchers:submit'),
          canApprove: can('cash-vouchers:approve'),
          canPost: can('cash-vouchers:post'),
          canVoid: can('cash-vouchers:void'),
        }}
      />

      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="muted">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
            {formatNumber(data.total)} dokumen
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

VouchersView.displayName = 'VouchersView';
