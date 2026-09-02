import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';

/** Daftar lokasi penyimpanan aktif — dipakai form Surat Jalan (baris = lot + lokasi). */
export async function GET() {
  try {
    await requirePermission('metal-lots:positions');

    const locations = await prisma.storageLocation.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    });

    return NextResponse.json({ data: locations });
  } catch (error) {
    return handleApiError(error);
  }
}
