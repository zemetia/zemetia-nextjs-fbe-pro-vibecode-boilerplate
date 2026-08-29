'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Plus, Search } from 'lucide-react';

import { apiErrorMessage, userService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateUserDialog } from './CreateUserDialog';
import { UserRoleCombobox } from './UserRoleCombobox';
import { UserStatusMenu } from './UserStatusMenu';

const SKELETON_ROWS = ['a', 'b', 'c', 'd'];
const COLUMN_COUNT = 5;

export function UsersTable() {
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: session } = useSession();

  // UI convenience only — every endpoint re-checks with requirePermission().
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  // Debounced so typing "supervisor" costs one request, not ten — the API is
  // rate limited per IP.
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', { q: debouncedQ }],
    queryFn: () => userService.list({ q: debouncedQ, limit: 50 }),
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
            placeholder="Cari nama atau email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Cari pengguna"
          />
        </div>
        {can('users:create') && (
          <Button
            onClick={() => setCreateOpen(true)}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Tambah Pengguna
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-56">Role</TableHead>
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
                    message={apiErrorMessage(error, 'Daftar pengguna gagal dimuat.')}
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
                  Tidak ada pengguna.
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      {user.image && <AvatarImage src={user.image} alt="" />}
                      <AvatarFallback>{user.initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-foreground-muted">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? 'success' : 'secondary'} size="sm" dot>
                    {user.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <UserRoleCombobox user={user} disabled={!can('users:assign-role')} />
                </TableCell>
                <TableCell>
                  <UserStatusMenu
                    user={user}
                    canSetStatus={can('users:set-status')}
                    isSelf={user.id === session?.user.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {createOpen && <CreateUserDialog open onOpenChange={setCreateOpen} />}
    </div>
  );
}

UsersTable.displayName = 'UsersTable';
