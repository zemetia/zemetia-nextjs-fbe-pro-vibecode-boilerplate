'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, permissionService, roleService } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import { PermissionMatrix } from './PermissionMatrix';

export interface RoleDetailViewProps {
  roleId: string;
}

export function RoleDetailView({ roleId }: RoleDetailViewProps) {
  const roleQuery = useQuery({
    queryKey: ['roles', roleId],
    queryFn: () => roleService.get(roleId),
  });
  const permissionsQuery = useQuery({
    queryKey: ['permissions', 'catalog'],
    queryFn: () => permissionService.listCatalog(),
  });

  if (roleQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!roleQuery.data) {
    return (
      <ErrorState
        title="Role tidak bisa ditampilkan"
        message={apiErrorMessage(roleQuery.error, 'Role ini tidak ditemukan atau sudah dihapus.')}
        onRetry={() => void roleQuery.refetch()}
      />
    );
  }
  if (!permissionsQuery.data) {
    return (
      <ErrorState
        title="Katalog izin gagal dimuat"
        message={apiErrorMessage(
          permissionsQuery.error,
          'Katalog izin tidak bisa dimuat. Coba lagi beberapa saat lagi.',
        )}
        onRetry={() => void permissionsQuery.refetch()}
      />
    );
  }

  const role = roleQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Typography variant="h2">{role.name}</Typography>
        {role.isSystem && <Badge variant="secondary">Sistem</Badge>}
      </div>
      {role.description && <Typography variant="muted">{role.description}</Typography>}

      <PermissionMatrix
        roleId={role.id}
        initialPermissionKeys={role.permissionKeys}
        modules={permissionsQuery.data}
        isSystemRole={role.isSystem}
      />
    </div>
  );
}

RoleDetailView.displayName = 'RoleDetailView';
