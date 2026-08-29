import { z } from 'zod';

import { paginationSchema } from './common';

const METAL_LOT_FORMS = ['BAR', 'JEWELRY', 'SCRAP', 'BAL'] as const;
const METALS = ['GOLD', 'SILVER'] as const;
const BAL_STAGES = ['OPEN', 'SEALED'] as const;

export const metalLotListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  form: z.enum(METAL_LOT_FORMS, 'Bentuk lot tidak dikenali').optional(),
  metal: z.enum(METALS, 'Logam tidak dikenali').optional(),
  bal_stage: z.enum(BAL_STAGES, 'Tahap bal tidak dikenali').optional(),
  in_stock: z
    .enum(['true', 'false'], 'Filter sisa stok tidak dikenali')
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type MetalLotListQuery = z.infer<typeof metalLotListQuerySchema>;
