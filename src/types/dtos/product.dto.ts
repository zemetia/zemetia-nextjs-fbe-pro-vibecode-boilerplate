import type { MetalDTO } from './inventory.dto';

export type ProductFormDTO = 'BULLION' | 'GRANULE' | 'JEWELRY' | 'SCRAP';
export type PriceBasisDTO = 'FINE' | 'GROSS';

export interface ProductDTO {
  id: string;
  code: string;
  name: string;
  metal: MetalDTO;
  form: ProductFormDTO;
  default_purity_percent: number | null;
  purity_locked: boolean;
  requires_certificate: boolean;
  is_active: boolean;
}
