import { fromUtcDateOnly } from '@/lib/date';
import { roundTo } from '@/lib/number';
import { outstandingQuantity } from '@/lib/purchase-request';
import {
  hasAnyOrder,
  isRequestFulfilled,
  type PurchaseRequestDetailRow,
  type PurchaseRequestRow,
} from '@/lib/purchase-request-write';
import type {
  PurchaseRequestDetailDTO,
  PurchaseRequestDTO,
  PurchaseRequestItemDTO,
} from '@/types/dtos';

/**
 * Row → DTO. `ordered_quantity` datang dari agregasi yang dijalankan pemanggil —
 * sekali untuk seluruh halaman, bukan sekali per baris: menanyakannya per baris
 * berarti dua puluh round trip untuk tabel yang belum digulir siapa pun.
 */

const AMOUNT_SCALE = 2;

function toItemDTO(
  item: PurchaseRequestRow['items'][number],
  ordered: Map<string, number>,
): PurchaseRequestItemDTO {
  const quantity = Number(item.quantity);
  const orderedQuantity = ordered.get(item.id) ?? 0;

  return {
    id: item.id,
    line_no: item.lineNo,
    product: item.product
      ? {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          metal: item.product.metal,
          form: item.product.form,
        }
      : null,
    supply: item.supply
      ? {
          id: item.supply.id,
          code: item.supply.code,
          name: item.supply.name,
          category: item.supply.category,
          unit: item.supply.unit,
        }
      : null,
    unit: {
      id: item.unit.id,
      code: item.unit.code,
      symbol: item.unit.symbol,
      name: item.unit.name,
      category_code: item.unit.category.code,
      conversion_factor: Number(item.unit.conversionFactor),
      is_anchor: item.unit.isAnchor,
    },
    quantity,
    est_unit_price: Number(item.estUnitPrice),
    est_amount: Number(item.estAmount),
    ordered_quantity: orderedQuantity,
    outstanding_quantity: outstandingQuantity(quantity, orderedQuantity),
    notes: item.notes,
  };
}

export function toPurchaseRequestDTO(
  row: PurchaseRequestRow,
  ordered: Map<string, number>,
): PurchaseRequestDTO {
  const estTotal = row.items.reduce((sum, item) => sum + Number(item.estAmount), 0);

  const isFulfilled = isRequestFulfilled(row.items, ordered);
  const hasOrder = hasAnyOrder(row.items, ordered);

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    category: row.category,
    date: fromUtcDateOnly(row.date),
    required_date: row.requiredDate === null ? null : fromUtcDateOnly(row.requiredDate),
    department: row.department,
    priority: row.priority,
    suggested_partner: row.suggestedPartner,
    currency_code: row.currencyCode,
    est_total_amount: roundTo(estTotal, AMOUNT_SCALE),
    is_fulfilled: isFulfilled,
    is_partially_fulfilled: hasOrder && !isFulfilled,
    requester_name: row.requesterName,
    recommended_supplier: row.recommendedSupplier,
    converted_po_number: row.convertedPoNumber,
    conversion_date: row.conversionDate ? fromUtcDateOnly(row.conversionDate) : null,
    converted_by: row.convertedBy,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toPurchaseRequestDetailDTO(
  row: PurchaseRequestDetailRow,
  ordered: Map<string, number>,
): PurchaseRequestDetailDTO {
  return {
    ...toPurchaseRequestDTO(row, ordered),
    items: row.items.map((item) => toItemDTO(item, ordered)),
    created_by: row.createdBy,
    approved_by: row.approvedBy,
    approved_at: row.approvedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    updated_at: row.updatedAt.toISOString(),
  };
}
