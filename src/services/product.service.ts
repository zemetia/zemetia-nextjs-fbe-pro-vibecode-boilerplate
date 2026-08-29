import { apiClient } from './client';
import { formatNumber } from '@/lib/number';
import { METAL_LABELS, PRICE_BASIS_LABELS, priceBasisForForm, PRODUCT_FORM_LABELS } from '@/lib/product';
import type { ProductDTO } from '@/types/dtos';
import type { ProductVO } from '@/types/value-objects';

function toVO(dto: ProductDTO): ProductVO {
  const priceBasis = priceBasisForForm(dto.form);

  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    // Kadar ikut di label karena itu yang membedakan dua barang yang namanya
    // hampir sama di layar picker — emas 99,99% dan perak 99,90%.
    label:
      dto.default_purity_percent === null
        ? dto.name
        : `${dto.name} · ${formatNumber(dto.default_purity_percent, { decimalScale: 2 })}%`,
    metal: dto.metal,
    metalLabel: METAL_LABELS[dto.metal],
    form: dto.form,
    formLabel: PRODUCT_FORM_LABELS[dto.form],
    defaultPurityPercent: dto.default_purity_percent ?? undefined,
    purityLocked: dto.purity_locked,
    requiresCertificate: dto.requires_certificate,
    priceBasis,
    priceBasisLabel: PRICE_BASIS_LABELS[priceBasis],
  };
}

export const productService = {
  /** Seluruh barang aktif — tidak berpaginasi, picker butuh daftarnya sekaligus. */
  list: async (): Promise<ProductVO[]> =>
    (await apiClient.get<ProductDTO[]>('/api/products')).map(toVO),
};
