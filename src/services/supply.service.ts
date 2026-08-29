import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency } from '@/lib/number';
import { SUPPLY_CATEGORY_LABELS } from '@/lib/supply';
import type { SupplyDTO, SupplyListDTO } from '@/types/dtos';
import type { SupplyCategory, SupplyListVO, SupplyVO } from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: SupplyDTO): SupplyVO {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    // Satuannya ikut di label picker: "5 Asam Nitrat" tidak bisa dibaca, "5
    // Jerigen 30 kg" bisa.
    label: `${dto.code} — ${dto.name} (${dto.unit})`,
    category: dto.category,
    categoryLabel: SUPPLY_CATEGORY_LABELS[dto.category],
    unit: dto.unit,
    lastPriceIdr: dto.last_price_idr ?? undefined,
    lastPriceIdrLabel: dto.last_price_idr === null ? EMPTY : formatCurrency(dto.last_price_idr),
    notes: dto.notes ?? EMPTY,
    isActive: dto.is_active,
    statusLabel: dto.is_active ? 'Aktif' : 'Nonaktif',
  };
}

export type SupplyListParams = ListParams & {
  category?: SupplyCategory;
  is_active?: boolean;
};

export type SupplyWritePayload = {
  code: string;
  name: string;
  category?: SupplyCategory;
  unit: string;
  last_price_idr?: number;
  notes?: string;
};

const BASE = '/api/supplies';

export const supplyService = {
  list: async (params?: SupplyListParams): Promise<SupplyListVO> =>
    toPaginatedVO(
      await apiClient.get<SupplyListDTO>(`${BASE}${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  create: async (payload: SupplyWritePayload): Promise<SupplyVO> =>
    toVO(await apiClient.post<SupplyDTO>(BASE, payload)),

  update: async (id: string, payload: SupplyWritePayload): Promise<SupplyVO> =>
    toVO(await apiClient.patch<SupplyDTO>(`${BASE}/${id}`, payload)),

  setStatus: async (id: string, isActive: boolean): Promise<SupplyVO> =>
    toVO(await apiClient.patch<SupplyDTO>(`${BASE}/${id}/status`, { is_active: isActive })),
};
