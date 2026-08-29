'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiErrorMessage, roleService, userService } from '@/services';
import { useToast } from '@/hooks';
import { Combobox } from '@/components/ui/Combobox';
import type { UserVO } from '@/types/value-objects';

export interface UserRoleComboboxProps {
  user: UserVO;
  /** True when the viewer lacks `users:assign-role` — UI hint only. */
  disabled?: boolean;
}

export function UserRoleCombobox({ user, disabled = false }: UserRoleComboboxProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data: options,
    isLoading: optionsLoading,
    isError: optionsFailed,
    error: optionsError,
  } = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () => roleService.listOptions(),
  });

  const mutation = useMutation({
    mutationFn: (roleId: string) => userService.assignRole(user.id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Role ${user.name} diperbarui`);
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal mengubah role. Coba lagi.');
    },
  });

  return (
    <Combobox
      options={options ?? []}
      value={user.roleId}
      onValueChange={(value) => value !== user.roleId && mutation.mutate(value)}
      disabled={disabled}
      loading={optionsLoading || mutation.isPending}
      placeholder="Pilih role…"
      searchPlaceholder="Cari role…"
      emptyText={
        optionsFailed
          ? apiErrorMessage(optionsError, 'Daftar role gagal dimuat.')
          : 'Role tidak ditemukan.'
      }
      aria-label={`Role untuk ${user.name}`}
      className="w-48"
    />
  );
}

UserRoleCombobox.displayName = 'UserRoleCombobox';
