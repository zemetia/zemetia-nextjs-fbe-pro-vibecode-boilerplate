import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getUserPermissions, hasPermission, requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ForbiddenError } from '@/lib/errors';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import { APPROVAL_KIND_REQUEST_PERMISSION } from '@/lib/approval';
import { APPROVAL_REQUEST_INCLUDE, toApprovalRequestDTO } from '@/lib/approval-dto';
import { createApprovalRequest, loadApprovalSubjects } from '@/lib/approval-write';
import { approvalListQuerySchema, createApprovalRequestSchema } from '@/lib/validations';

/**
 * Inbox konfirmasi direktur — satu daftar untuk permintaan dari seluruh modul.
 *
 * **Dua izin, dua tingkat pandangan.** `approvals:list` membuka seluruh antrean
 * perusahaan; `approvals:request` hanya membuka pengajuan sendiri. Pemanggil yang
 * cuma punya yang kedua **dipaksa** ke mode `mine`, karena wewenang mengajukan
 * tidak dengan sendirinya berarti boleh membaca apa yang sedang diputuskan
 * tentang dokumen orang lain.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const permissions = await getUserPermissions(session.user.id);

    const canReadAll = hasPermission(permissions, 'approvals:list');
    if (!canReadAll && !hasPermission(permissions, 'approvals:request')) {
      throw new ForbiddenError('Anda tidak punya izin untuk melihat daftar konfirmasi.');
    }

    const query = parseListQuery(request, approvalListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.ApprovalRequestWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(!canReadAll || query.mine ? { requestedById: session.user.id } : {}),
      ...(query.q ? { OR: await searchConditions(query.q) } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: APPROVAL_REQUEST_INCLUDE,
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    const subjects = await loadApprovalSubjects(rows);

    return NextResponse.json(
      buildPaginatedDTO(rows, total, query, (row) =>
        toApprovalRequestDTO(row, subjects.get(`${row.kind}:${row.subjectId}`) ?? null),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Pencarian menembus ke **nomor dokumennya**, bukan hanya nomor permintaannya.
 *
 * Yang diketik orang saat mencari di inbox adalah `PO-LM-202608-0004`, bukan
 * `APR-202608-0011` — nomor permintaan cuma nomor antrean, dan daftar yang hanya
 * bisa dicari dengannya praktis tidak bisa dicari. Harganya empat query, dan
 * hanya saat kolom pencariannya benar-benar terisi.
 */
async function searchConditions(q: string): Promise<Prisma.ApprovalRequestWhereInput[]> {
  const contains = { contains: q, mode: 'insensitive' } as const;

  const [vouchers, orders] = await Promise.all([
    prisma.cashVoucher.findMany({ where: { number: contains }, select: { id: true } }),
    prisma.productionOrder.findMany({ where: { number: contains }, select: { id: true } }),
  ]);

  const subjectIds = [...vouchers, ...orders].map((row) => row.id);

  return [
    { number: contains },
    { requestedBy: { name: contains } },
    ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
  ];
}

/**
 * Mengajukan sebuah dokumen untuk dikonfirmasi.
 *
 * Digerbangi **dua** izin: `approvals:request` (boleh memakai alur ini sama
 * sekali) dan izin modul dokumennya (boleh menggerakkan dokumen ini). Satu key
 * saja akan membuat wewenang mengajukan menjadi wewenang lintas modul — dan
 * untuk voucher, pengajuannya sekalian memindahkan statusnya ke menunggu
 * verifikasi.
 */
export async function POST(request: Request) {
  try {
    const body = createApprovalRequestSchema.parse(await request.json());

    await requirePermission('approvals:request');
    const session = await requirePermission(APPROVAL_KIND_REQUEST_PERMISSION[body.kind]);

    const id = await createApprovalRequest(
      body.kind,
      body.subject_id,
      body.note ?? null,
      session.user.id,
    );

    const row = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id },
      include: APPROVAL_REQUEST_INCLUDE,
    });
    const subjects = await loadApprovalSubjects([row]);

    return NextResponse.json(
      toApprovalRequestDTO(row, subjects.get(`${row.kind}:${row.subjectId}`) ?? null),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
