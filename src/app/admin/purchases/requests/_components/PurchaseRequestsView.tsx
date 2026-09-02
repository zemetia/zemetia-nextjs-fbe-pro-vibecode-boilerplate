'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Clock, FileText, Plus, Search, ShoppingCart } from 'lucide-react';

import { purchaseRequestService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import {
  PURCHASE_REQUEST_CATEGORY_OPTIONS,
  PURCHASE_REQUEST_PRIORITY_OPTIONS,
  PURCHASE_REQUEST_STATUS_OPTIONS,
} from '@/lib/purchase-request';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import type {
  PurchaseRequestCategory,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
} from '@/types/value-objects';
import { PurchaseRequestForm } from './PurchaseRequestForm';
import { PurchaseRequestsTable } from './PurchaseRequestsTable';

const PAGE_SIZE = 20;
const ALL = 'all';

const CATEGORY_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua kategori' },
  ...PURCHASE_REQUEST_CATEGORY_OPTIONS,
];

const STATUS_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua status' },
  ...PURCHASE_REQUEST_STATUS_OPTIONS,
];

const PRIORITY_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua prioritas' },
  ...PURCHASE_REQUEST_PRIORITY_OPTIONS,
];

export function PurchaseRequestsView() {
  const { data: session } = useSession();

  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [page, setPage] = useState(1);
  // Mode legacy: form input ditampilkan inline di halaman yang sama.
  const [showForm, setShowForm] = useState(false);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    category: category === ALL ? undefined : (category as PurchaseRequestCategory),
    status: status === ALL ? undefined : (status as PurchaseRequestStatus),
    priority: priority === ALL ? undefined : (priority as PurchaseRequestPriority),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchase-requests', { ...filters, page }],
    queryFn: () => purchaseRequestService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  // KPI calculations from current items list
  const totalCount = data?.total ?? 0;
  const draftCount = data?.items.filter((item) => item.status === 'DRAFT').length ?? 0;
  const approvedReadyCount =
    data?.items.filter((item) => item.status === 'APPROVED' && !item.isFulfilled).length ?? 0;
  const fulfilledCount = data?.items.filter((item) => item.isFulfilled).length ?? 0;

  return (
    <div className="space-y-6">
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Total Permintaan</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatNumber(totalCount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground-muted">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Draft Menunggu Approval</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatNumber(draftCount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Disetujui Siap PO</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatNumber(approvedReadyCount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Selesai Terpenuhi</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatNumber(fulfilledCount)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
              aria-hidden="true"
            />
            <Input
              placeholder="Cari nomor PR atau divisi…"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Cari PR"
            />
          </div>

          <div className="w-48">
            <Combobox
              options={CATEGORY_FILTER_OPTIONS}
              value={category}
              onValueChange={(val) => {
                setCategory(val);
                setPage(1);
              }}
              aria-label="Filter kategori"
            />
          </div>

          <div className="w-40">
            <Combobox
              options={STATUS_FILTER_OPTIONS}
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
              aria-label="Filter status"
            />
          </div>

          <div className="w-40">
            <Combobox
              options={PRIORITY_FILTER_OPTIONS}
              value={priority}
              onValueChange={(val) => {
                setPriority(val);
                setPage(1);
              }}
              aria-label="Filter prioritas"
            />
          </div>
        </div>

        {can('purchase-requests:create') && (
          <Button
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setShowForm((visible) => !visible)}
          >
            {showForm ? 'Tutup Form' : 'Buat Permintaan'}
          </Button>
        )}
      </div>

      {/* Form input inline (mode legacy) */}
      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <PurchaseRequestForm
              onSaved={() => {
                setShowForm(false);
                void refetch();
              }}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <PurchaseRequestsTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        can={can}
      />

      {/* Pagination */}
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

PurchaseRequestsView.displayName = 'PurchaseRequestsView';
