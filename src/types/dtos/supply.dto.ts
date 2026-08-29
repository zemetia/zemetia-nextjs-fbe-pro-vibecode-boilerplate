import type { PaginatedDTO } from './pagination.dto';

export type SupplyCategoryDTO = 'CHEMICAL' | 'CONSUMABLE' | 'EQUIPMENT' | 'OTHER';

/**
 * Master barang non-logam. Satuannya teks bebas dan ikut terkirim karena form PR
 * mencetaknya di sebelah kolom jumlah — "5" tanpa "Jerigen 30 kg" adalah angka
 * yang tidak bisa dibaca siapa pun.
 */
export interface SupplyDTO {
  id: string;
  code: string;
  name: string;
  category: SupplyCategoryDTO;
  unit: string;
  /** Harga terakhir yang diketahui, rupiah. Perkiraan, bukan kesepakatan. */
  last_price_idr: number | null;
  notes: string | null;
  is_active: boolean;
}

export type SupplyListDTO = PaginatedDTO<SupplyDTO>;
