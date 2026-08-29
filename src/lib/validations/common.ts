import { z } from 'zod';

// Every rule carries its own message, and every message names the field it is
// about — the API returns the message alone (the raw field key never reaches
// the screen). See docs/blueprint/ERROR_HANDLING.md.

export const emailSchema = z
  .string()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid');

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(100, 'Password maksimal 100 karakter');

export const nameSchema = z
  .string()
  .min(1, 'Nama wajib diisi')
  .max(100, 'Nama maksimal 100 karakter')
  .trim();

export const urlSchema = z.string().url('Format URL tidak valid').optional();

export const uuidSchema = z.string().uuid('Data yang dipilih tidak dikenali');

export const paginationSchema = z.object({
  page: z.coerce.number('Nomor halaman tidak valid').int().positive('Nomor halaman tidak valid').default(1),
  limit: z.coerce
    .number('Jumlah data per halaman tidak valid')
    .int()
    .positive('Jumlah data per halaman tidak valid')
    .max(100, 'Maksimal 100 data per halaman')
    .default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
