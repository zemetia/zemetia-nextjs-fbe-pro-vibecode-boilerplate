'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { roleService } from '@/services';
import { useToast } from '@/hooks';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import type { PermissionGroupVO, PermissionModuleVO } from '@/types/value-objects';

export interface PermissionMatrixProps {
  roleId: string;
  initialPermissionKeys: string[];
  modules: PermissionModuleVO[];
  isSystemRole: boolean;
}

export function PermissionMatrix({
  roleId,
  initialPermissionKeys,
  modules,
  isSystemRole,
}: PermissionMatrixProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermissionKeys));
  const [search, setSearch] = useState('');

  const filteredModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return modules;
    return modules
      .map((module) => ({
        ...module,
        groups: module.groups
          .map((group) => ({
            ...group,
            permissions: group.permissions.filter(
              (permission) =>
                module.moduleLabel.toLowerCase().includes(term) ||
                group.resourceLabel.toLowerCase().includes(term) ||
                permission.label.toLowerCase().includes(term) ||
                permission.key.toLowerCase().includes(term) ||
                permission.endpoint.toLowerCase().includes(term) ||
                permission.description.toLowerCase().includes(term),
            ),
          }))
          .filter((group) => group.permissions.length > 0),
      }))
      .filter((module) => module.groups.length > 0);
  }, [modules, search]);

  const initialSet = useMemo(() => new Set(initialPermissionKeys), [initialPermissionKeys]);
  const dirty = useMemo(() => {
    if (selected.size !== initialSet.size) return true;
    for (const key of selected) {
      if (!initialSet.has(key)) return true;
    }
    return false;
  }, [selected, initialSet]);

  const changeCount = useMemo(() => {
    let count = 0;
    for (const key of selected) if (!initialSet.has(key)) count += 1;
    for (const key of initialSet) if (!selected.has(key)) count += 1;
    return count;
  }, [selected, initialSet]);

  const mutation = useMutation({
    mutationFn: (keys: string[]) => roleService.replacePermissions(roleId, keys),
    onSuccess: (keys) => {
      setSelected(new Set(keys));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Perubahan izin disimpan');
    },
    onError: (error) => {
      toast.apiError(error, 'Gagal menyimpan perubahan izin. Coba lagi.');
    },
  });

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleGroup(group: PermissionGroupVO, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const permission of group.permissions) {
        if (checked) next.add(permission.key);
        else next.delete(permission.key);
      }
      return next;
    });
  }

  function handleDiscard() {
    setSelected(new Set(initialPermissionKeys));
  }

  function handleSave() {
    mutation.mutate(Array.from(selected));
  }

  return (
    <div className="space-y-4">
      {isSystemRole && (
        <Badge variant="secondary" className="w-fit">
          Role sistem — hanya bisa dilihat
        </Badge>
      )}

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <Input
          placeholder="Cari izin atau endpoint…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Cari izin"
        />
      </div>

      <div className="max-h-[28rem] space-y-6 overflow-y-auto rounded-lg border border-border p-4">
        {filteredModules.map((module) => (
          <section key={module.module} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              {module.moduleLabel}
            </h3>

            <div className="divide-y divide-border rounded-lg border border-border">
              {module.groups.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const selectedInGroup = groupKeys.filter((key) => selected.has(key)).length;
                const groupChecked: boolean | 'indeterminate' =
                  selectedInGroup === 0
                    ? false
                    : selectedInGroup === groupKeys.length
                      ? true
                      : 'indeterminate';

                return (
                  <div key={group.resource} className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Checkbox
                        checked={groupChecked}
                        disabled={isSystemRole}
                        onCheckedChange={(checked) => toggleGroup(group, checked === true)}
                        aria-label={`Pilih semua izin ${group.resourceLabel}`}
                      />
                      <span className="font-medium text-foreground">{group.resourceLabel}</span>
                      <Badge variant="outline" size="sm">
                        {selectedInGroup}/{groupKeys.length}
                      </Badge>
                    </div>

                    <div className="grid gap-2 pl-7 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{permission.label}</p>
                            <p className="truncate text-xs text-foreground-muted">
                              {permission.description}
                            </p>
                            <p className="truncate font-mono text-xs text-foreground-subtle">
                              {permission.endpoint}
                            </p>
                          </div>
                          <Switch
                            checked={selected.has(permission.key)}
                            disabled={isSystemRole}
                            onCheckedChange={(checked) => toggle(permission.key, checked)}
                            aria-label={`Aktifkan izin ${permission.key}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {filteredModules.length === 0 && (
          <p className="p-8 text-center text-sm text-foreground-muted">Tidak ada izin yang cocok.</p>
        )}
      </div>

      {dirty && !isSystemRole && (
        <div
          className={cn(
            'sticky bottom-0 flex items-center justify-between gap-4 rounded-lg border border-border',
            'bg-surface-raised px-4 py-3 shadow-lg',
          )}
        >
          <span className="text-sm text-foreground-muted">
            {changeCount} perubahan belum disimpan
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={mutation.isPending}>
              Batalkan
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={mutation.isPending}>
              Simpan Perubahan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

PermissionMatrix.displayName = 'PermissionMatrix';
