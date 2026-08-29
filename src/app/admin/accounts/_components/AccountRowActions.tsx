'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';

import { accountService } from '@/services';
import { useToast } from '@/hooks';
import { canHaveChildren } from '@/lib/account-code';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AccountNodeVO } from '@/types/value-objects';
import { AccountFormDialog } from './AccountFormDialog';

export interface AccountRowActionsProps {
  account: AccountNodeVO;
  /** The whole chart — the edit dialog reads the parent chain from it. */
  accounts: AccountNodeVO[];
  onAddChild: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canSetStatus: boolean;
  canDelete: boolean;
}

/**
 * Row menu for one account. Three of the four actions are conditional on the
 * node's own shape, not just on permissions — a folder cannot be deleted, an
 * account with mutations cannot grow children, and the deepest level has
 * nowhere left to nest.
 */
export function AccountRowActions({
  account,
  accounts,
  onAddChild,
  canCreate,
  canUpdate,
  canSetStatus,
  canDelete,
}: AccountRowActionsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounts'] });

  const statusMutation = useMutation({
    mutationFn: () => accountService.setActive(account.id, !account.isActive),
    onSuccess: (saved) => {
      void invalidate();
      setStatusOpen(false);
      toast.success(
        saved.isActive
          ? `Akun ${saved.code} ${saved.name} diaktifkan kembali.`
          : `Akun ${saved.code} ${saved.name} dinonaktifkan.`,
      );
    },
    onError: (error) => toast.apiError(error, 'Status akun gagal diubah.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => accountService.remove(account.id),
    onSuccess: () => {
      void invalidate();
      setDeleteOpen(false);
      toast.success(`Akun ${account.code} ${account.name} dihapus.`);
    },
    onError: (error) => toast.apiError(error, 'Akun gagal dihapus.'),
  });

  const canAddChild = canCreate && canHaveChildren(account.code) && !account.hasMutations;
  // Deleting is only ever a fix for a slip: a folder or a journalled account is
  // closed with its status instead, so the ledger keeps resolving.
  const canRemove = canDelete && !account.isHeader && !account.hasMutations;

  if (!canAddChild && !canUpdate && !canSetStatus && !canRemove) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk akun ${account.code}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canAddChild && (
            <DropdownMenuItem onSelect={onAddChild}>
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Tambah sub-akun
            </DropdownMenuItem>
          )}
          {canUpdate && (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Ubah akun
            </DropdownMenuItem>
          )}
          {canSetStatus && (
            <DropdownMenuItem onSelect={() => setStatusOpen(true)}>
              <Power className="h-4 w-4" aria-hidden="true" />
              {account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
          )}
          {canRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Hapus akun
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <AccountFormDialog
          open
          onOpenChange={setEditOpen}
          accounts={accounts}
          account={account}
        />
      )}

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        tone={account.isActive ? 'warning' : 'info'}
        title={
          account.isActive
            ? `Nonaktifkan ${account.code} ${account.name}?`
            : `Aktifkan ${account.code} ${account.name}?`
        }
        description={
          account.isActive
            ? 'Akun tidak bisa dipilih lagi untuk transaksi baru. Jurnal yang sudah tercatat tetap utuh dan tetap terbaca.'
            : 'Akun bisa dipilih lagi untuk transaksi baru.'
        }
        confirmLabel={account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        isConfirming={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={`Hapus akun ${account.code} ${account.name}?`}
        description="Akun ini belum punya turunan dan belum pernah dipakai transaksi, jadi bisa dihapus permanen. Kode-nya akan bebas dipakai akun lain."
        confirmLabel="Hapus"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

AccountRowActions.displayName = 'AccountRowActions';
