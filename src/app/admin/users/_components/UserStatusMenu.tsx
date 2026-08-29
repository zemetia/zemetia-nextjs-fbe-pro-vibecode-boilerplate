'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { userService } from '@/services';
import { useToast } from '@/hooks';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserVO } from '@/types/value-objects';

export interface UserStatusMenuProps {
  user: UserVO;
  /** False when the viewer lacks `users:set-status` — UI hint only. */
  canSetStatus: boolean;
  /** The viewer's own account cannot be deactivated; the API rejects it too. */
  isSelf: boolean;
}

export function UserStatusMenu({ user, canSetStatus, isSelf }: UserStatusMenuProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (isActive: boolean) => userService.setActive(user.id, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(
        updated.isActive
          ? `${updated.name} diaktifkan kembali`
          : `${updated.name} dinonaktifkan`,
      );
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal mengubah status pengguna. Coba lagi.');
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={mutation.isPending}
          aria-label={`Aksi untuk ${user.name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.isActive ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={!canSetStatus || isSelf}
            onSelect={() => mutation.mutate(false)}
          >
            Nonaktifkan
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={!canSetStatus} onSelect={() => mutation.mutate(true)}>
            Aktifkan
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

UserStatusMenu.displayName = 'UserStatusMenu';
