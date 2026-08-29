import type { Prisma, Product } from '@prisma/client';

import type { ProductDTO } from '@/types/dtos';

/** Prisma `Decimal` → plain number. The stored scale is already the right one. */
function decimal(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export function toProductDTO(row: Product): ProductDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    metal: row.metal,
    form: row.form,
    default_purity_percent: decimal(row.defaultPurityPercent),
    purity_locked: row.purityLocked,
    requires_certificate: row.requiresCertificate,
    is_active: row.isActive,
  };
}
