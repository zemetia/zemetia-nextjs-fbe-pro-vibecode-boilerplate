import { apiClient } from './client';
import { PERMISSION_MODULES } from '@/lib/permissions';
import type { PermissionListDTO } from '@/types/dtos';
import type { PermissionGroupVO, PermissionModuleVO, PermissionVO } from '@/types/value-objects';

export const permissionService = {
  /**
   * Shapes the flat API response into the catalog's module → resource → permission
   * tree. Labels, copy and ordering come from `@/lib/permissions`; the API only
   * supplies the ids of what is actually seeded, so catalog entries not yet in the
   * database are skipped rather than rendered as dead toggles.
   */
  listCatalog: async (): Promise<PermissionModuleVO[]> => {
    const dto = await apiClient.get<PermissionListDTO>('/api/permissions', { cache: 'no-store' });
    const byKey = new Map(dto.data.map((permission) => [permission.key, permission]));

    return PERMISSION_MODULES.map((module) => {
      const groups = module.resources
        .map((resource): PermissionGroupVO => {
          const permissions = resource.permissions.reduce<PermissionVO[]>((acc, definition) => {
            const key = `${resource.resource}:${definition.action}`;
            const seeded = byKey.get(key);
            if (seeded) {
              acc.push({
                id: seeded.id,
                resource: resource.resource,
                action: definition.action,
                key,
                endpoint: definition.endpoint,
                description: definition.description,
                label: definition.label,
              });
            }
            return acc;
          }, []);

          return {
            resource: resource.resource,
            resourceLabel: resource.label,
            permissions,
          };
        })
        .filter((group) => group.permissions.length > 0);

      return { module: module.module, moduleLabel: module.label, groups };
    }).filter((module) => module.groups.length > 0);
  },
};
