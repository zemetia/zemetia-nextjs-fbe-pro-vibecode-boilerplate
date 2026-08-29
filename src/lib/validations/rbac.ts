import { z } from 'zod';

import { emailSchema, nameSchema, paginationSchema, passwordSchema } from './common';

const descriptionSchema = z.string().max(500, 'Deskripsi maksimal 500 karakter').trim().optional();
const searchSchema = z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional();

export const createRoleSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export const updateRoleSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
});

// Keys, not cuids — `permissions.key` is the stable identifier across reseeds
// and is what the UI already works with.
export const replaceRolePermissionsSchema = z.object({
  permission_keys: z
    .array(z.string().min(1, 'Daftar izin tidak valid'), 'Daftar izin tidak valid')
    .max(500, 'Terlalu banyak izin dipilih sekaligus'),
});

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role_id: z.string('Role wajib dipilih').min(1, 'Role wajib dipilih'),
});

export const assignUserRoleSchema = z.object({
  role_id: z.string('Role wajib dipilih').min(1, 'Role wajib dipilih'),
});

export const setUserStatusSchema = z.object({
  is_active: z.boolean('Status pengguna tidak valid'),
});

export const roleListQuerySchema = paginationSchema.extend({
  q: searchSchema,
});

export const userListQuerySchema = paginationSchema.extend({
  q: searchSchema,
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ReplaceRolePermissionsInput = z.infer<typeof replaceRolePermissionsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
export type RoleListQuery = z.infer<typeof roleListQuerySchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
