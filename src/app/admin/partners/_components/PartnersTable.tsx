'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Search } from 'lucide-react';

import { apiErrorMessage, partnerService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { PARTNER_ORIGIN_OPTIONS, PARTNER_VERIFICATION_STATE_OPTIONS } from '@/lib/partner';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
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
import type { PartnerOrigin, PartnerVerificationState } from '@/types/value-objects';
import { PartnerRowMenu } from './PartnerRowMenu';
import { PartnerVerificationBadge } from './PartnerVerificationBadge';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 8;
const PAGE_SIZE = 20;

const ALL = 'all';

type RoleFilter = typeof ALL | 'supplier' | 'customer';

const ROLE_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua peran' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
];

/**
 * Origin is a fact about the partner, not about a role, so the filter stands on
 * its own and combines freely with the role filter — "supplier lokal", "customer
 * overseas", or either one alone.
 */
const ORIGIN_FILTER_OPTIONS = [{ value: ALL, label: 'Semua asal' }, ...PARTNER_ORIGIN_OPTIONS];

/**
 * Termasuk "Verifikasi kedaluwarsa", yang bukan nilai kolom mana pun — server
 * menerjemahkannya jadi kondisi tanggal. Itulah filter yang sebenarnya dicari
 * orang: daftar mitra yang datanya harus diperbarui.
 */
const VERIFICATION_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua verifikasi' },
  ...PARTNER_VERIFICATION_STATE_OPTIONS,
];

const STATUS_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua status' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
];

export function PartnersTable() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>(ALL);
  const [origin, setOrigin] = useState(ALL);
  const [verification, setVerification] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const router = useRouter();
  const { data: session } = useSession();

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);
  const canViewDetail = can('partners:detail');

  // Debounced so typing a partner name costs one request, not ten — the API is
  // rate limited per IP.
  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    role: role === ALL ? undefined : role,
    origin: origin === ALL ? undefined : (origin as PartnerOrigin),
    verification:
      verification === ALL ? undefined : (verification as PartnerVerificationState),
    is_active: status === ALL ? undefined : status === 'true',
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['partners', { ...filters, page }],
    queryFn: () => partnerService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  /** Any filter change invalidates the current page number. */
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari kode, nama, atau email…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari mitra"
          />
        </div>

        <Combobox
          options={ROLE_FILTER_OPTIONS}
          value={role}
          onValueChange={(value) => {
            setRole(value as RoleFilter);
            resetPage();
          }}
          className="w-full sm:w-40"
          placeholder="Semua peran"
          searchPlaceholder="Cari peran…"
          emptyText="Peran tidak ditemukan."
          aria-label="Filter peran"
        />

        <Combobox
          options={ORIGIN_FILTER_OPTIONS}
          value={origin}
          onValueChange={(value) => {
            setOrigin(value);
            resetPage();
          }}
          className="w-full sm:w-40"
          placeholder="Semua asal"
          searchPlaceholder="Cari asal…"
          emptyText="Asal tidak ditemukan."
          aria-label="Filter asal mitra"
        />

        <Combobox
          options={VERIFICATION_FILTER_OPTIONS}
          value={verification}
          onValueChange={(value) => {
            setVerification(value);
            resetPage();
          }}
          className="w-full sm:w-52"
          placeholder="Semua verifikasi"
          searchPlaceholder="Cari status verifikasi…"
          emptyText="Status verifikasi tidak ditemukan."
          aria-label="Filter verifikasi"
        />

        <Combobox
          options={STATUS_FILTER_OPTIONS}
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          className="w-full sm:w-40"
          placeholder="Semua status"
          searchPlaceholder="Cari status…"
          emptyText="Status tidak ditemukan."
          aria-label="Filter status"
        />

        {can('partners:create') && (
          <Button
            className="ml-auto"
            onClick={() => router.push('/admin/partners/new')}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Tambah Mitra
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="w-44">Peran</TableHead>
              <TableHead className="w-28">Asal</TableHead>
              <TableHead>Negara</TableHead>
              <TableHead className="w-24">Mata uang</TableHead>
              <TableHead className="w-28">Status</TableHead>
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
                    message={apiErrorMessage(error, 'Daftar mitra gagal dimuat.')}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.isEmpty && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-10 text-center text-foreground-muted"
                >
                  {q || role !== ALL || origin !== ALL || verification !== ALL || status !== ALL
                    ? 'Tidak ada mitra yang cocok dengan filter ini.'
                    : 'Belum ada mitra terdaftar.'}
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((partner) => (
              <TableRow key={partner.id}>
                <TableCell className="font-mono text-xs text-foreground-muted">
                  {partner.code}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {canViewDetail ? (
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {partner.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{partner.name}</span>
                    )}
                    {/* Hanya yang butuh perhatian yang memasang tanda: yang belum
                        pernah diverifikasi adalah mayoritas, dan menandainya
                        semua akan membuat kolom ini jadi bising tanpa isi. */}
                    {partner.verificationState !== 'UNVERIFIED' && (
                      <PartnerVerificationBadge state={partner.verificationState} iconOnly />
                    )}
                  </span>
                  <span className="block text-xs text-foreground-subtle">{partner.email}</span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {partner.isSupplier && (
                      <Badge variant="secondary" size="sm">
                        Supplier
                      </Badge>
                    )}
                    {partner.isCustomer && (
                      <Badge variant="secondary" size="sm">
                        Customer
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-foreground-subtle">
                    {partner.typeLabel}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={partner.isOverseas ? 'brand' : 'secondary'} size="sm">
                    {partner.originLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground-muted">{partner.countryName}</TableCell>
                <TableCell className="text-foreground-muted">{partner.currencyCode}</TableCell>
                <TableCell>
                  <Badge variant={partner.isActive ? 'success' : 'secondary'} size="sm" dot>
                    {partner.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PartnerRowMenu
                    partner={partner}
                    canUpdate={can('partners:update')}
                    canSetStatus={can('partners:set-status')}
                    canViewDetail={canViewDetail}
                  />
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
            {formatNumber(data.total)} partner
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

PartnersTable.displayName = 'PartnersTable';
