import { apiClient } from './client';

export interface StorageLocationOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

/** Daftar lokasi penyimpanan aktif — dipakai form Surat Jalan. */
export const storageLocationService = {
  list: async (): Promise<StorageLocationOption[]> => {
    const response = await apiClient.get<{ data: StorageLocationOption[] }>(
      '/api/storage-locations',
      { cache: 'no-store' },
    );
    return response.data;
  },
};
