import type { PermissionKey } from '@/lib/permissions';
import type { ApprovalKindDTO, ApprovalStatusDTO } from '@/types/dtos';

/**
 * Bahasa presentasi lapis persetujuan — murni, tanpa Prisma, jadi boleh diimpor
 * service layer dan komponen client. Yang menyentuh database ada di
 * `src/lib/approval-write.ts`.
 */

/**
 * Izin yang dibutuhkan untuk **memutuskan** tiap jenis permintaan.
 *
 * Sengaja memakai ulang key confirm milik modulnya, bukan key `approvals:*` yang
 * baru: menyetujui lewat inbox dan mengkonfirmasi lewat halaman dokumen adalah
 * peristiwa yang sama persis, jadi keduanya harus berdiri di izin yang sama.
 * Key kedua hanya menyediakan pintu samping ke tindakan yang ditolak di pintu
 * depan.
 *
 * `Record<ApprovalKindDTO, …>` dan bukan `Record<string, …>`: menambah jenis
 * persetujuan tanpa menjawab izinnya harus gagal saat compile.
 */
export const APPROVAL_KIND_PERMISSION: Record<ApprovalKindDTO, PermissionKey> = {
  CASH_VOUCHER_APPROVE: 'cash-vouchers:approve',
  PRODUCTION_ORDER_RELEASE: 'production-orders:release',
};

export const APPROVAL_KIND_REQUEST_PERMISSION: Record<ApprovalKindDTO, PermissionKey> = {
  CASH_VOUCHER_APPROVE: 'cash-vouchers:submit',
  PRODUCTION_ORDER_RELEASE: 'production-orders:update',
};

export const APPROVAL_KIND_LABELS: Record<ApprovalKindDTO, string> = {
  CASH_VOUCHER_APPROVE: 'Persetujuan Voucher',
  PRODUCTION_ORDER_RELEASE: 'Rilis SPK Produksi',
};

export const APPROVAL_KIND_MODULE_LABELS: Record<ApprovalKindDTO, string> = {
  CASH_VOUCHER_APPROVE: 'Keuangan',
  PRODUCTION_ORDER_RELEASE: 'Produksi',
};

export const APPROVAL_KIND_EFFECTS: Record<ApprovalKindDTO, string> = {
  CASH_VOUCHER_APPROVE:
    'Voucher disetujui. Bila dokumennya ditandai auto-posting, jurnalnya sekalian masuk buku besar.',
  PRODUCTION_ORDER_RELEASE:
    'SPK dirilis ke lantai produksi sehingga bahan boleh dikeluarkan dan hasilnya boleh dicatat.',
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusDTO, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Ditarik',
};

export const APPROVAL_KIND_OPTIONS = (
  Object.keys(APPROVAL_KIND_LABELS) as ApprovalKindDTO[]
).map((kind) => ({ value: kind, label: APPROVAL_KIND_LABELS[kind] }));

export const APPROVAL_STATUS_OPTIONS = (
  Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatusDTO[]
).map((status) => ({ value: status, label: APPROVAL_STATUS_LABELS[status] }));

/** Hanya permintaan yang masih menunggu yang bisa diputuskan. */
export function isApprovalPending(status: ApprovalStatusDTO): boolean {
  return status === 'PENDING';
}
