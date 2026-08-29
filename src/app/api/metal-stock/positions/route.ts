import { NextResponse } from 'next/server';

import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { stockPositions } from '@/lib/metal-stock';

/**
 * The rekap behind the storage landing page. It is computed server-side because
 * summing the rows currently on screen is only ever right for one page — the
 * same reason the partner transaction summary has its own endpoint.
 */
export async function GET() {
  try {
    await requirePermission('metal-lots:positions');

    return NextResponse.json(await stockPositions());
  } catch (error) {
    return handleApiError(error);
  }
}
