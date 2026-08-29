import { apiClient } from './client';
import type { FrameworkListDTO } from '@/types/dtos';
import type { FrameworkOptionVO } from '@/types/value-objects';

function toOptionVO(dto: FrameworkListDTO['data'][number]): FrameworkOptionVO {
  return { value: dto.id, label: dto.display_name };
}

export const frameworkService = {
  list: async (query?: string): Promise<FrameworkOptionVO[]> => {
    const search = query ? `?q=${encodeURIComponent(query)}` : '';
    const { data } = await apiClient.get<FrameworkListDTO>(`/api/frameworks${search}`, {
      cache: 'no-store',
    });
    return data.map(toOptionVO);
  },
};
