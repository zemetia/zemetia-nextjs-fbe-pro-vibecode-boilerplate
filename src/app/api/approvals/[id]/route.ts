import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { APPROVAL_KIND_PERMISSION } from '@/lib/approval';
import { APPROVAL_REQUEST_INCLUDE, toApprovalRequestDTO } from '@/lib/approval-dto';
import { decideApprovalRequest, loadApprovalSubjects } from '@/lib/approval-write';
import { decideApprovalRequestSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Keputusan atas satu permintaan — setuju, tolak, atau (oleh pengajunya sendiri)
 * tarik kembali.
 *
 * **Izinnya milik modul dokumennya**, bukan key `approvals:*` yang baru:
 * menyetujui permintaan konfirmasi PO di sini dan menekan Konfirmasi di halaman
 * PO menghasilkan peristiwa yang sama persis, jadi keduanya berdiri di
 * `metal-purchases:confirm`. Key kedua hanya akan menyediakan pintu samping ke
 * tindakan yang ditolak di pintu depan.
 *
 * **Menarik kembali bukan menolak.** Ia dilakukan pengaju, bukan pemutus, jadi
 * yang diperiksa bukan izin memutuskan melainkan apakah pemanggilnya memang
 * orang yang mengajukan. Direktur yang ingin menghentikannya menolak, dan
 * penolakan meninggalkan jejak siapa yang menolak.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = decideApprovalRequestSchema.parse(await request.json());

    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { kind: true, requestedById: true },
    });
    if (!existing) throw new NotFoundError('Permintaan konfirmasi tidak ditemukan.');

    let actorId: string;

    if (body.decision === 'CANCELLED') {
      const session = await requirePermission('approvals:request');
      if (session.user.id !== existing.requestedById) {
        throw new ForbiddenError('Hanya pengaju yang bisa menarik kembali permintaannya sendiri.');
      }
      actorId = session.user.id;
    } else {
      await requirePermission(APPROVAL_KIND_PERMISSION[existing.kind]);
      actorId = (await requireAuth()).user.id;
    }

    await decideApprovalRequest(id, body.decision, body.note ?? null, actorId);

    const row = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id },
      include: APPROVAL_REQUEST_INCLUDE,
    });
    const subjects = await loadApprovalSubjects([row]);

    return NextResponse.json(
      toApprovalRequestDTO(row, subjects.get(`${row.kind}:${row.subjectId}`) ?? null),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
