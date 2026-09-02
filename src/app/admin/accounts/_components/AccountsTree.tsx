'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ChevronDown, ChevronRight, FolderTree, Plus, Search } from 'lucide-react';

import { accountService, apiErrorMessage } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { cn } from '@/lib/cn';
import { ACCOUNT_TYPE_OPTIONS } from '@/lib/account';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CoaTable as Table,
  CoaTableBody as TableBody,
  CoaTableCell as TableCell,
  CoaTableHead as TableHead,
  CoaTableHeader as TableHeader,
  CoaTableRow as TableRow,
} from '@/components/ui/CoaTable';
import type { AccountNodeVO, AccountType } from '@/types/value-objects';
import { AccountFormDialog } from './AccountFormDialog';
import { AccountRowActions } from './AccountRowActions';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f'];
const COLUMN_COUNT = 6;

/** Depth at which the tree stops being open by default — classes and groups. */
const DEFAULT_OPEN_UNTIL_LEVEL = 2;

const TYPE_OPTIONS = [{ value: '', label: 'Semua jenis' }, ...ACCOUNT_TYPE_OPTIONS];

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
];

const OWNER_OPTIONS = [
  { value: '', label: 'Semua kepemilikan' },
  { value: 'true', label: 'Milik PT TAN Export' },
  { value: 'false', label: 'Bukan PT TAN Export' },
];

function parseBoolean(value: string): boolean | undefined {
  return value === '' ? undefined : value === 'true';
}

/**
 * Bagan akun as a tree table.
 *
 * Rows are flattened depth-first and indented by `level`, rather than nested in
 * markup: one `<Table>` keeps the columns aligned across every depth, which a
 * nested table cannot do.
 *
 * Expansion is stored as *overrides* on top of a depth rule instead of as the
 * full open set, so a freshly loaded chart already shows its classes and groups
 * without an effect that reaches into the query result.
 */
export function AccountsTree() {
  const { data: session } = useSession();

  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [createParentId, setCreateParentId] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  // UI convenience only — every endpoint re-checks with requirePermission().
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  // Debounced: the chart endpoint is rate limited per IP like every other one.
  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ || undefined,
    type: (type || undefined) as AccountType | undefined,
    is_active: parseBoolean(status),
    is_tan: parseBoolean(owner),
  };
  const isFiltered = Object.values(filters).some((value) => value !== undefined);

  // Changing the saringan hands back a different chart, so the rows the user
  // collapsed under the previous one no longer mean anything — keeping those
  // overrides would hide the matches the new filter was meant to surface.
  const nextExpansionKey = JSON.stringify(filters);
  const [expansionKey, setExpansionKey] = useState(nextExpansionKey);
  if (expansionKey !== nextExpansionKey) {
    setExpansionKey(nextExpansionKey);
    setOverrides({});
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounts', filters],
    queryFn: () => accountService.tree(filters),
    placeholderData: keepPreviousData,
  });

  // A filtered chart is already narrow, so it opens all the way down by default
  // — but that is only the *default*: an override always wins, otherwise the
  // chevrons would be inert for as long as a saringan is active.
  const isOpen = (node: AccountNodeVO) =>
    overrides[node.id] ?? (isFiltered || node.level <= DEFAULT_OPEN_UNTIL_LEVEL);

  const toggle = (node: AccountNodeVO) =>
    setOverrides((prev) => ({ ...prev, [node.id]: !isOpen(node) }));

  function visibleRows(nodes: readonly AccountNodeVO[]): AccountNodeVO[] {
    return nodes.flatMap((node) =>
      isOpen(node) ? [node, ...visibleRows(node.children)] : [node],
    );
  }

  /**
   * Whether the row has anything left to unfold *here*. Not `isHeader`: that
   * counts the account's real children, while a saringan hands back only the
   * matching ones — a header whose children were all filtered out would keep a
   * chevron that expands nothing.
   */
  const isExpandable = (node: AccountNodeVO) => node.children.length > 0;

  const rows = visibleRows(data?.items ?? []);

  function openCreate(parentId?: string) {
    setCreateParentId(parentId);
    setCreateOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari kode atau nama akun…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
            aria-label="Cari akun"
          />
        </div>

        <div className="w-44">
          <Combobox
            options={TYPE_OPTIONS}
            value={type}
            onValueChange={setType}
            placeholder="Semua jenis"
            searchPlaceholder="Cari jenis…"
            aria-label="Saring menurut jenis akun"
          />
        </div>

        <div className="w-40">
          <Combobox
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={setStatus}
            placeholder="Semua status"
            searchPlaceholder="Cari status…"
            aria-label="Saring menurut status akun"
          />
        </div>

        <div className="w-52">
          <Combobox
            options={OWNER_OPTIONS}
            value={owner}
            onValueChange={setOwner}
            placeholder="Semua kepemilikan"
            searchPlaceholder="Cari kepemilikan…"
            aria-label="Saring menurut kepemilikan akun"
          />
        </div>

        {can('accounts:create') && (
          <Button
            className="ml-auto"
            onClick={() => openCreate(undefined)}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Tambah Akun
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Kode</TableHead>
              <TableHead>Nama Akun</TableHead>
              <TableHead className="w-40">Jenis</TableHead>
              <TableHead className="w-24">Saldo Normal</TableHead>
              <TableHead className="w-44 text-right">Saldo</TableHead>
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
                    message={apiErrorMessage(error, 'Bagan akun gagal dimuat.')}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.isEmpty && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
                  <FolderTree
                    className="mx-auto mb-2 h-6 w-6 text-foreground-subtle"
                    aria-hidden="true"
                  />
                  <p className="text-foreground-muted">
                    {isFiltered
                      ? 'Tidak ada akun yang cocok dengan saringan ini.'
                      : 'Bagan akun masih kosong. Jalankan seed untuk memasang kerangka akunnya.'}
                  </p>
                </TableCell>
              </TableRow>
            )}

            {rows.map((node) => {
              const expandable = isExpandable(node);
              const open = expandable && isOpen(node);

              return (
                <TableRow key={node.id} className={cn(!node.isActive && 'opacity-60')}>
                  <TableCell className="font-mono text-sm tabular-nums">{node.code}</TableCell>

                  <TableCell>
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${(node.level - 1) * 20}px` }}
                    >
                      {expandable ? (
                        <button
                          type="button"
                          onClick={() => toggle(node)}
                          aria-expanded={open}
                          aria-label={`${open ? 'Tutup' : 'Buka'} ${node.name}`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground-subtle transition-colors hover:bg-primary-subtle hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                      )}

                      <span
                        className={cn(
                          'truncate',
                          node.isHeader ? 'font-semibold text-foreground' : 'text-foreground',
                        )}
                      >
                        {node.name}
                      </span>

                      {node.isHeader && (
                        <Badge variant="secondary" size="sm">
                          {node.childCount} akun
                        </Badge>
                      )}
                      {node.isTan && (
                        <Badge variant="brand" size="sm">
                          TAN
                        </Badge>
                      )}
                      {!node.isActive && (
                        <Badge variant="secondary" size="sm" dot>
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-foreground-muted">{node.typeLabel}</TableCell>

                  <TableCell className="text-foreground-muted">{node.normalBalanceLabel}</TableCell>

                  <TableCell className="text-right font-medium tabular-nums">
                    {node.balanceLabel}
                  </TableCell>

                  <TableCell>
                    <AccountRowActions
                      account={node}
                      accounts={data?.items ?? []}
                      onAddChild={() => openCreate(node.id)}
                      canCreate={can('accounts:create')}
                      canUpdate={can('accounts:update')}
                      canSetStatus={can('accounts:set-status')}
                      canDelete={can('accounts:delete')}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {createOpen && (
        <AccountFormDialog
          open
          onOpenChange={setCreateOpen}
          accounts={data?.items ?? []}
          defaultParentId={createParentId}
        />
      )}
    </div>
  );
}

AccountsTree.displayName = 'AccountsTree';
