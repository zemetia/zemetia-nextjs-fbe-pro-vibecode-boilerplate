import type { Supply } from '@prisma/client';

import type { SupplyDTO } from '@/types/dtos';

export function toSupplyDTO(row: Supply): SupplyDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    last_price_idr: row.lastPriceIdr === null ? null : Number(row.lastPriceIdr),
    notes: row.notes,
    is_active: row.isActive,
  };
}
