import { apiClient } from './client';
import type { UserDTO, UserListDTO } from '@/types/dtos';
import type { UserListVO, UserVO } from '@/types/value-objects';

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function toVO(dto: UserDTO): UserVO {
  const name = dto.name ?? dto.email;
  return {
    id: dto.id,
    name,
    email: dto.email,
    image: dto.image,
    initials: initials(name, dto.email),
    roleId: dto.role.id,
    roleName: dto.role.name,
    roleSlug: dto.role.slug,
    isActive: dto.is_active,
    statusLabel: dto.is_active ? 'Aktif' : 'Nonaktif',
    createdAt: dto.created_at,
  };
}

export interface UserListParams {
  page?: number;
  limit?: number;
  q?: string;
}

function buildQuery(params?: UserListParams): string {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.q) search.set('q', params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const userService = {
  list: async (params?: UserListParams): Promise<UserListVO> => {
    const dto = await apiClient.get<UserListDTO>(`/api/users${buildQuery(params)}`, {
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

  create: async (body: {
    name: string;
    email: string;
    password: string;
    roleId: string;
  }): Promise<UserVO> => {
    const dto = await apiClient.post<UserDTO>('/api/users', {
      name: body.name,
      email: body.email,
      password: body.password,
      role_id: body.roleId,
    });
    return toVO(dto);
  },

  assignRole: async (userId: string, roleId: string): Promise<UserVO> => {
    const dto = await apiClient.patch<UserDTO>(`/api/users/${userId}/role`, { role_id: roleId });
    return toVO(dto);
  },

  setActive: async (userId: string, isActive: boolean): Promise<UserVO> => {
    const dto = await apiClient.patch<UserDTO>(`/api/users/${userId}/status`, {
      is_active: isActive,
    });
    return toVO(dto);
  },
};
