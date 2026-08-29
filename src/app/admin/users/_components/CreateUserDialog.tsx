'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiErrorMessage, roleService, userService } from '@/services';
import { createUserSchema } from '@/lib/validations';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const { errors, validate } = useFormErrors(() => {
    const found = zodFieldErrors(createUserSchema, { name, email, password, role_id: roleId });
    // The combobox is not part of the schema's happy path when left untouched —
    // an empty pick has to say so itself.
    return { ...found, role_id: found.role_id ?? (roleId ? undefined : 'Role wajib dipilih') };
  });

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
    mutationFn: () => userService.create({ name, email, password, roleId }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Pengguna ${user.name} berhasil dibuat`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal membuat pengguna. Coba lagi.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Pengguna</DialogTitle>
            <DialogDescription>
              Pengguna langsung bisa masuk memakai email dan password ini. Sampaikan password awal
              lewat jalur yang aman.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              label="Nama"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="mis. Rina Wijaya"
            />
            <Input
              type="email"
              label="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="off"
              placeholder="rina@tan.co.id"
            />
            <Input
              type="password"
              label="Password awal"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="new-password"
              hint="Minimal 8 karakter."
            />
            <div className="flex w-full flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Role
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <Combobox
                options={options ?? []}
                value={roleId}
                onValueChange={setRoleId}
                loading={optionsLoading}
                placeholder="Pilih role…"
                searchPlaceholder="Cari role…"
                emptyText="Role tidak ditemukan."
                aria-label="Role pengguna baru"
              />
              {optionsFailed && (
                <p className="text-xs text-destructive">
                  {apiErrorMessage(optionsError, 'Daftar role gagal dimuat. Tutup lalu buka lagi.')}
                </p>
              )}
              {errors.role_id && <p className="text-xs text-destructive">{errors.role_id}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Buat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CreateUserDialog.displayName = 'CreateUserDialog';
