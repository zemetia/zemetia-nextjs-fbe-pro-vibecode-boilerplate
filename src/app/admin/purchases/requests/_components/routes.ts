export const REQUEST_BASE_PATH = '/admin/purchases/requests' as const;

export function requestListHref(): string {
  return REQUEST_BASE_PATH;
}

export function requestNewHref(): string {
  return `${REQUEST_BASE_PATH}/new`;
}

export function requestDetailHref(id: string): string {
  return `${REQUEST_BASE_PATH}/${id}`;
}

export function requestEditHref(id: string): string {
  return `${REQUEST_BASE_PATH}/${id}/edit`;
}

/**
 * Tujuan konversi PR → PO — GOLD_IMPORT ke form PO impor, GOLD_LOCAL ke form
 * PO lokal. `SUPPLY`/`CHEMICALS_REFINERY`/`SAFETY_GA` tidak pernah sampai
 * sini: `canConvertPurchaseRequest()` sudah menutup tombolnya untuk kategori
 * non-logam.
 */
export function requestConvertHref(id: string, category: 'GOLD_IMPORT' | 'GOLD_LOCAL'): string {
  const path = category === 'GOLD_IMPORT' ? '/admin/purchases/import' : '/admin/purchases/local';
  return `${path}?from_request=${id}`;
}
