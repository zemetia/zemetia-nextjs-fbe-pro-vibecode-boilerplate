'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Search } from 'lucide-react';

import { productionOrderService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { PRODUCTION_ORDER_STATUS_OPTIONS } from '@/lib/production';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import type { ProductionOrderStatus } from '@/types/value-objects';
import { ProductionOrdersTable } from './ProductionOrdersTable';

const PAGE_SIZE = 20;
const ALL = 'all';

const STATUS_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua status' },
  ...PRODUCTION_ORDER_STATUS_OPTIONS,
];

export function ProductionOrdersView() {
  const router = useRouter();
  const { data: session } = useSession();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    status: status === ALL ? undefined : (status as ProductionOrderStatus),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['production-orders', { ...filters, page }],
    queryFn: () => productionOrderService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari nomor SPK atau model…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari SPK produksi"
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
          aria-label="Filter status"
        />

        {can('production-orders:create') && (
          <Button
            className="ml-auto"
            onClick={() => router.push('/admin/production/new')}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Buat SPK
          </Button>
        )}
      </div>

      <ProductionOrdersTable
        orders={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={q !== '' || status !== ALL}
        permissions={{
          canUpdate: can('production-orders:update'),
          canDelete: can('production-orders:delete'),
          canRelease: can('production-orders:release'),
          canClose: can('production-orders:close'),
          canVoid: can('production-orders:void'),
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

ProductionOrdersView.displayName = 'ProductionOrdersView';
