'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { roleService } from '@/services';
import { createRoleSchema, updateRoleSchema } from '@/lib/validations';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RoleVO } from '@/types/value-objects';

export interface RoleFormDialogProps {
  mode: 'create' | 'edit';
  role?: RoleVO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleFormDialog({ mode, role, open, onOpenChange }: RoleFormDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const { errors, validate } = useFormErrors(() =>
    zodFieldErrors(mode === 'create' ? createRoleSchema : updateRoleSchema, {
      name,
      description: description || undefined,
    }),
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'edit' && role) {
        return roleService.update(role.id, { name, description: description || undefined });
      }
      return roleService.create({ name, description: description || undefined });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
      if (mode === 'create') {
        // Buat role langsung menyambung ke pengaturan izinnya — bukan dua langkah terpisah.
        toast.success(`Role ${created.name} dibuat — lanjut atur izinnya`);
        router.push(`/admin/roles/${created.id}`);
        return;
      }
      toast.success('Role berhasil diperbarui');
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal menyimpan role. Coba lagi.');
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
            <DialogTitle>{mode === 'create' ? 'Buat Role' : 'Edit Role'}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Isi nama role, lalu kamu langsung diarahkan ke pengaturan izinnya.'
                : 'Ubah nama atau deskripsi role ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              label="Nama"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="mis. Editor Konten"
            />
            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="role-description">
                Deskripsi
              </label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Untuk apa role ini digunakan?"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {mode === 'create' ? 'Buat & Atur Izin' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

RoleFormDialog.displayName = 'RoleFormDialog';
