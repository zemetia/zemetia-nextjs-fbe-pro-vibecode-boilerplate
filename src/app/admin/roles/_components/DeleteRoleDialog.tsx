'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { roleService } from '@/services';
import { useToast } from '@/hooks';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RoleVO } from '@/types/value-objects';

export interface DeleteRoleDialogProps {
  role: RoleVO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({ role, open, onOpenChange }: DeleteRoleDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => roleService.remove(role.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role berhasil dihapus');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.apiError(
        error,
        'Gagal menghapus role. Pastikan tidak ada pengguna yang masih memakainya.',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus role &ldquo;{role.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            Tindakan ini tidak bisa dibatalkan. Role hanya bisa dihapus jika tidak ada pengguna yang
            memakainya.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="destructive" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

DeleteRoleDialog.displayName = 'DeleteRoleDialog';
