import { apiClient } from './client';
import type { RoleDetailDTO, RoleDTO, RoleListDTO } from '@/types/dtos';
import type { RoleDetailVO, RoleListVO, RoleOptionVO, RoleVO } from '@/types/value-objects';

function toVO(dto: RoleDTO): RoleVO {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    description: dto.description ?? '',
    isSystem: dto.is_system,
    userCount: dto.user_count,
    permissionCount: dto.permission_count,
    createdAt: dto.created_at,
  };
}

function toDetailVO(dto: RoleDetailDTO): RoleDetailVO {
  return { ...toVO(dto), permissionKeys: dto.permission_keys };
}

export interface RoleListParams {
  page?: number;
  limit?: number;
  q?: string;
}

function buildQuery(params?: RoleListParams): string {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.q) search.set('q', params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const roleService = {
  list: async (params?: RoleListParams): Promise<RoleListVO> => {
    const dto = await apiClient.get<RoleListDTO>(`/api/roles${buildQuery(params)}`, {
      cache: 'no-store',
    });
    return {
      items: dto.data.map(toVO),
      total: dto.total,
      page: dto.page,
      pageSize: dto.page_size,
      isEmpty: dto.data.length === 0,
    };
  },

  get: async (id: string): Promise<RoleDetailVO> => {
    const dto = await apiClient.get<RoleDetailDTO>(`/api/roles/${id}`, { cache: 'no-store' });
    return toDetailVO(dto);
  },

  listOptions: async (): Promise<RoleOptionVO[]> => {
    const dto = await apiClient.get<RoleListDTO>('/api/roles?limit=100', { cache: 'no-store' });
    return dto.data.map((role) => ({ value: role.id, label: role.name }));
  },

  create: async (body: { name: string; description?: string }): Promise<RoleVO> => {
    const dto = await apiClient.post<RoleDTO>('/api/roles', body);
    return toVO(dto);
  },

  update: async (id: string, body: { name?: string; description?: string }): Promise<RoleVO> => {
    const dto = await apiClient.patch<RoleDTO>(`/api/roles/${id}`, body);
    return toVO(dto);
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/roles/${id}`);
  },

  replacePermissions: async (id: string, permissionKeys: string[]): Promise<string[]> => {
    const dto = await apiClient.put<{ permission_keys: string[] }>(`/api/roles/${id}/permissions`, {
      permission_keys: permissionKeys,
    });
    return dto.permission_keys;
  },
};
