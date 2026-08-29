import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';
import { toProductDTO } from '@/lib/product-dto';

/**
 * Daftar barang untuk picker.
 *
 * **Digerbangi `requireAuth()` saja, bukan permission**, dan tanpa paginasi —
 * pola yang sama dengan lookup negara/mata uang. Alasannya sama juga: combobox
 * butuh seluruh daftarnya sekaligus, dan menggerbanginya dengan permission
 * tersendiri membuat form macet diam-diam untuk role yang punya
 * `metal-purchases:create` tapi kebetulan tidak punya izin lookup-nya.
 *
 * Hanya yang aktif yang keluar: barang nonaktif memang tidak boleh dipakai untuk
 * dokumen baru, dan menampilkannya cuma menyediakan pilihan yang pasti ditolak
 * saat disimpan.
 */
export async function GET() {
  try {
    await requireAuth();

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ metal: 'asc' }, { form: 'asc' }, { code: 'asc' }],
    });

    return NextResponse.json(products.map(toProductDTO));
  } catch (error) {
    return handleApiError(error);
  }
}
