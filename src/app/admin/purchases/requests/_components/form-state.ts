import { fromDateOnly, toDateOnly, today } from '@/lib/date';
import { roundTo } from '@/lib/number';
import type { PurchaseRequestWritePayload } from '@/services';
import type {
  ProductVO,
  PurchaseRequestCategory,
  PurchaseRequestDetailVO,
  PurchaseRequestItemVO,
  PurchaseRequestPriority,
  SupplyVO,
} from '@/types/value-objects';

export interface PurchaseRequestItemFormState {
  key: string;
  productId?: string;
  productLabel?: string;
  supplyId?: string;
  supplyLabel?: string;
  supplyUnit?: string;
  unitId?: string;
  unitLabel?: string;
  quantity?: number;
  estUnitPrice?: number;
  notes?: string;
}

export interface PurchaseRequestFormState {
  category: PurchaseRequestCategory;
  date: Date | undefined;
  requiredDate: Date | undefined;
  department: string;
  priority: PurchaseRequestPriority;
  suggestedPartnerId: string;
  currencyCode: string;
  notes: string;
  items: PurchaseRequestItemFormState[];
}

let sequence = 0;

function nextKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function emptyItem(): PurchaseRequestItemFormState {
  return {
    key: nextKey('pr-item'),
    productId: undefined,
    productLabel: undefined,
    supplyId: undefined,
    supplyLabel: undefined,
    supplyUnit: undefined,
    unitId: undefined,
    unitLabel: undefined,
    quantity: undefined,
    estUnitPrice: undefined,
    notes: '',
  };
}

export function withProduct(
  item: PurchaseRequestItemFormState,
  product: ProductVO,
): PurchaseRequestItemFormState {
  return {
    ...item,
    productId: product.id,
    productLabel: product.label,
    supplyId: undefined,
    supplyLabel: undefined,
    supplyUnit: undefined,
  };
}

export function withSupply(
  item: PurchaseRequestItemFormState,
  supply: SupplyVO,
): PurchaseRequestItemFormState {
  return {
    ...item,
    supplyId: supply.id,
    supplyLabel: supply.label,
    supplyUnit: supply.unit,
    productId: undefined,
    productLabel: undefined,
    estUnitPrice: item.estUnitPrice ?? supply.lastPriceIdr,
  };
}

export function emptyForm(
  category: PurchaseRequestCategory = 'GOLD_LOCAL',
): PurchaseRequestFormState {
  return {
    category,
    date: today(),
    requiredDate: undefined,
    department: '',
    priority: 'NORMAL',
    suggestedPartnerId: '',
    currencyCode: category === 'GOLD_IMPORT' ? 'USD' : 'IDR',
    notes: '',
    items: [emptyItem()],
  };
}

function text(value?: string | null): string {
  return !value || value === '—' ? '' : value;
}

function toItemFormState(item: PurchaseRequestItemVO): PurchaseRequestItemFormState {
  return {
    key: nextKey('pr-item'),
    productId: item.productId,
    productLabel: item.productId ? `${item.itemCode} — ${item.itemLabel}` : undefined,
    supplyId: item.supplyId,
    supplyLabel: item.supplyId ? `${item.itemCode} — ${item.itemLabel}` : undefined,
    supplyUnit: item.supplyId ? item.unitLabel : undefined,
    unitId: item.unit.id,
    unitLabel: `${item.unit.name} (${item.unit.symbol})`,
    quantity: item.quantity,
    estUnitPrice: item.estUnitPrice,
    notes: text(item.notes),
  };
}

export function toFormState(request: PurchaseRequestDetailVO): PurchaseRequestFormState {
  return {
    category: request.category,
    date: fromDateOnly(request.date),
    requiredDate: fromDateOnly(request.requiredDate),
    department: request.department,
    priority: request.priority,
    suggestedPartnerId: request.suggestedPartnerId ?? '',
    currencyCode: request.currencyCode,
    notes: text(request.notes),
    items:
      request.items.length > 0
        ? request.items.map((item) => toItemFormState(item))
        : [emptyItem()],
  };
}

export function previewItemAmount(item: PurchaseRequestItemFormState): number {
  const qty = item.quantity ?? 0;
  const price = item.estUnitPrice ?? 0;
  return roundTo(qty * price, 2);
}

export function previewTotalAmount(form: PurchaseRequestFormState): number {
  return roundTo(
    form.items.reduce((total, item) => total + previewItemAmount(item), 0),
    2,
  );
}

export function toPayload(form: PurchaseRequestFormState): PurchaseRequestWritePayload {
  return {
    category: form.category,
    date: form.date ? toDateOnly(form.date) : '',
    required_date: form.requiredDate ? toDateOnly(form.requiredDate) : undefined,
    department: form.department.trim(),
    priority: form.priority,
    suggested_partner_id: form.suggestedPartnerId || undefined,
    currency_code: form.currencyCode,
    notes: form.notes.trim() || undefined,
    items: form.items.map((item) => ({
      product_id: form.category !== 'SUPPLY' ? (item.productId || undefined) : undefined,
      supply_id: form.category === 'SUPPLY' ? (item.supplyId || undefined) : undefined,
      unit_id: item.unitId ?? '',
      quantity: item.quantity ?? 0,
      est_unit_price: item.estUnitPrice ?? 0,
      notes: item.notes?.trim() || undefined,
    })),
  };
}
