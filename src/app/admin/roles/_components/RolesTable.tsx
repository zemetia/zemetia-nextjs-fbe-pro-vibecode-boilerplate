'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Search } from 'lucide-react';

import { apiErrorMessage, roleService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleFormDialog } from './RoleFormDialog';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import type { RoleVO } from '@/types/value-objects';

const SKELETON_ROWS = ['a', 'b', 'c', 'd'];

type FormState = { mode: 'create' } | { mode: 'edit'; role: RoleVO } | null;

export function RolesTable() {
  const [q, setQ] = useState('');
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleVO | null>(null);

  // Debounced — satu request per jeda ketik, bukan per karakter (rate limit per IP).
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['roles', { q: debouncedQ }],
    queryFn: () => roleService.list({ q: debouncedQ, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari role…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Cari role"
          />
        </div>
        <Button onClick={() => setFormState({ mode: 'create' })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
          Buat Role
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Izin</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              SKELETON_ROWS.map((key) => (
                <TableRow key={key}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={5}>
                  <ErrorState
                    variant="inline"
                    message={apiErrorMessage(error, 'Daftar role gagal dimuat.')}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.isEmpty && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-foreground-muted">
                  Belum ada role.
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/roles/${role.id}`} className="hover:underline">
                    {role.name}
                  </Link>
                  {role.isSystem && (
                    <Badge variant="secondary" className="ml-2">
                      Sistem
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-foreground-muted">
                  {role.description || '—'}
                </TableCell>
                <TableCell>{role.userCount}</TableCell>
                <TableCell>{role.permissionCount}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk role ${role.name}`}>
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/roles/${role.id}`}>Kelola izin</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={role.isSystem}
                        onSelect={() => setFormState({ mode: 'edit', role })}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={role.isSystem || role.userCount > 0}
                        onSelect={() => setDeleteTarget(role)}
                      >
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {formState && (
        <RoleFormDialog
          mode={formState.mode}
          role={formState.mode === 'edit' ? formState.role : undefined}
          open
          onOpenChange={(open) => !open && setFormState(null)}
        />
      )}
      {deleteTarget && (
        <DeleteRoleDialog role={deleteTarget} open onOpenChange={(open) => !open && setDeleteTarget(null)} />
      )}
    </div>
  );
}

RolesTable.displayName = 'RolesTable';
