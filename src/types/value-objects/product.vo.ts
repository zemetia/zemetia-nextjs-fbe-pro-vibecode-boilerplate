import type { PriceBasisDTO, ProductFormDTO } from '@/types/dtos';
import type { Metal } from './inventory.vo';

export type ProductForm = ProductFormDTO;
export type PriceBasis = PriceBasisDTO;

export interface ProductVO {
  id: string;
  code: string;
  name: string;
  label: string;
  metal: Metal;
  metalLabel: string;
  form: ProductForm;
  formLabel: string;
  defaultPurityPercent?: number;
  purityLocked: boolean;
  requiresCertificate: boolean;
  priceBasis: PriceBasis;
  priceBasisLabel: string;
}
