import type { SupplyCategoryDTO } from '@/types/dtos';
import type { PaginatedVO } from './pagination.vo';

export type SupplyCategory = SupplyCategoryDTO;

/**
 * Baris siap layar. `label` sudah menggabungkan kode dan nama karena picker di
 * form PR menampilkannya sebagai satu baris, dan menyusunnya lagi di tiap
 * pemanggil adalah dua tempat untuk satu keputusan.
 */
export interface SupplyVO {
  id: string;
  code: string;
  name: string;
  label: string;
  category: SupplyCategory;
  categoryLabel: string;
  unit: string;
  lastPriceIdr?: number;
  lastPriceIdrLabel: string;
  notes: string;
  isActive: boolean;
  statusLabel: string;
}

export type SupplyListVO = PaginatedVO<SupplyVO>;
