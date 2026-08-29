import type { ApprovalKind, ApprovalStatus, Prisma } from '@prisma/client';

import { nextApprovalNumber } from '@/lib/approval-number';

/**
 * Yang dipanggil **route dokumen** ke arah lapis persetujuan.
 *
 * File ini sengaja tidak mengimpor satu pun modul dokumen — arah impornya satu
 * arah: dokumen → sini. `approval-write.ts` yang berjalan ke arah sebaliknya
 * (ia mengimpor transisi tiap dokumen untuk menjalankannya saat disetujui), dan
 * menggabung keduanya dalam satu file akan menutup lingkaran impor.
 *
 * Aturan yang dijaganya: **inbox tidak boleh menyimpan baris yang subjeknya
 * sudah lewat.** Direktur yang mengkonfirmasi dokumennya langsung dari halaman
 * dokumen memutuskan hal yang sama persis dengan menekan Setujui di inbox, jadi
 * transisi itu ikut menutup permintaannya. Draft yang dihapus menutupnya sebagai
 * `CANCELLED` — barisnya tidak punya FK ke dokumennya, jadi tidak ada `onDelete`
 * yang akan membereskannya.
 */
export async function resolvePendingApprovals(
  kind: ApprovalKind,
  subjectId: string,
  status: Exclude<ApprovalStatus, 'PENDING'>,
  actorId: string,
  note: string | null,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.approvalRequest.updateMany({
    where: { kind, subjectId, status: 'PENDING' },
    data: {
      status,
      // Melepas kunci parsialnya — selama kolom ini terisi, dokumen yang sama
      // tidak bisa diajukan lagi.
      pendingKey: null,
      decidedById: actorId,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
}

/**
 * Menaruh sebuah dokumen di inbox direktur, tanpa memeriksa apa pun tentang
 * dokumennya — pemanggilnya sudah melakukannya.
 *
 * Dipakai dari dua arah yang harus bertemu di satu tempat: `POST /api/approvals`
 * (petugas mengajukan dari halaman dokumen) dan `PATCH /api/cash-vouchers/[id]/status`
 * (voucher sudah punya langkah "ajukan verifikasi" sendiri sejak sebelum lapis
 * ini ada). Kalau jalur kedua tidak menulis barisnya, voucher yang diajukan lewat
 * menu voucher tidak akan pernah muncul di inbox — dan inbox yang tidak memuat
 * semua yang menunggu lebih buruk daripada tidak ada inbox.
 *
 * Idempotent: permintaan yang sudah menunggu dikembalikan apa adanya, bukan
 * ditolak. Menekan "Ajukan" dua kali bukan kesalahan yang perlu diberitahukan.
 */
export async function ensurePendingApproval(
  kind: ApprovalKind,
  subjectId: string,
  requesterId: string,
  note: string | null,
  tx: Prisma.TransactionClient,
): Promise<{ id: string; number: string }> {
  const existing = await tx.approvalRequest.findFirst({
    where: { kind, subjectId, status: 'PENDING' },
    select: { id: true, number: true },
  });
  if (existing) return existing;

  return tx.approvalRequest.create({
    data: {
      number: await nextApprovalNumber(new Date(), tx),
      kind,
      subjectId,
      status: 'PENDING',
      pendingKey: 'PENDING',
      requestNote: note,
      requestedById: requesterId,
    },
    select: { id: true, number: true },
  });
}
