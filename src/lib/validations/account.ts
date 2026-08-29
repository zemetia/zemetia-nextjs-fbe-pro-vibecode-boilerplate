import { z } from 'zod';

import { ACCOUNT_MAX_CHILDREN } from '@/lib/account-code';

// Every rule names its own field — the API returns the message alone.
// See docs/blueprint/ERROR_HANDLING.md.

const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COST_EXPENSE',
  'NON_OPERATING',
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

const accountName = z
  .string('Nama akun wajib diisi')
  .trim()
  .min(1, 'Nama akun wajib diisi')
  .max(150, 'Nama akun maksimal 150 karakter');

/**
 * The one editable digit of a generated code. The rest of the code comes from
 * the parent and is never accepted from the client — sending it would let a
 * caller move an account into another branch by editing a text field.
 */
const ordinal = z.coerce
  .number('Urutan kode akun tidak valid')
  .int('Urutan kode akun harus berupa angka bulat')
  .min(1, 'Urutan kode akun minimal 1')
  .max(ACCOUNT_MAX_CHILDREN, `Urutan kode akun maksimal ${ACCOUNT_MAX_CHILDREN}`);

export const createAccountSchema = z.object({
  // Roots are the six account classes and are seeded; every new account hangs
  // under one of them.
  parent_id: z.string('Induk akun wajib dipilih').trim().min(1, 'Induk akun wajib dipilih'),
  /** Omitted means "take the lowest free slot". */
  ordinal: ordinal.optional(),
  name: accountName,
  description: z
    .string()
    .trim()
    .max(500, 'Keterangan akun maksimal 500 karakter')
    .optional()
    .transform((value) => (value ? value : undefined)),
  is_tan: z.boolean('Penanda milik PT TAN Export tidak valid').optional().default(false),
});

/**
 * Code and parent are absent on purpose: the code encodes the tree position, so
 * changing either would have to renumber every descendant. Moving an account is
 * a separate operation, not an edit.
 */
export const updateAccountSchema = z.object({
  name: accountName.optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Keterangan akun maksimal 500 karakter')
    .optional()
    .transform((value) => (value ? value : null)),
  is_tan: z.boolean('Penanda milik PT TAN Export tidak valid').optional(),
});

export const setAccountStatusSchema = z.object({
  is_active: z.boolean('Status akun tidak valid'),
});

/** The tree endpoint returns the whole chart — filters narrow it, never page it. */
export const accountTreeQuerySchema = z.object({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(ACCOUNT_TYPES, 'Jenis akun tidak dikenali').optional(),
  is_active: z
    .enum(['true', 'false'], 'Filter status tidak valid')
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  is_tan: z
    .enum(['true', 'false'], 'Filter kepemilikan tidak valid')
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type SetAccountStatusInput = z.infer<typeof setAccountStatusSchema>;
export type AccountTreeQuery = z.infer<typeof accountTreeQuerySchema>;
