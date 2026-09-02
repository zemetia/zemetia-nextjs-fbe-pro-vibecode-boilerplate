import type { PaginatedDTO } from './pagination.dto';

export type ApprovalKindDTO =
  | 'METAL_PURCHASE_CONFIRM'
  | 'METAL_PURCHASE_DELIVERY_CONFIRM'
  | 'CASH_VOUCHER_APPROVE'
  | 'PRODUCTION_ORDER_RELEASE';

export type ApprovalStatusDTO = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Keputusan yang boleh dikirim ke `PATCH /api/approvals/[id]`. */
export type ApprovalDecisionDTO = 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalActorRefDTO {
  id: string;
  name: string | null;
}

/**
 * Ringkasan dokumen yang dimintakan keputusannya, diresolve server-side per
 * `kind`. Bentuknya sengaja seragam untuk keempat jenis dokumen: yang membaca
 * inbox ingin tahu *apa* dan *berapa*, dan tabel yang kolomnya berubah-ubah
 * mengikuti jenis baris tidak bisa dibaca sekali lihat.
 *
 * `null` bila dokumennya sudah tidak ada lagi — draft yang dihapus setelah
 * diajukan. Barisnya tetap ditampilkan (dengan keterangan) alih-alih hilang
 * diam-diam, karena permintaan yang lenyap tanpa jejak persis seperti permintaan
 * yang tidak pernah dibaca.
 */
export interface ApprovalSubjectDTO {
  /** Nomor dokumennya sendiri — `PO-LM-202608-0001`, `TT-202608-0003`, … */
  number: string;
  /** Baris utama: mitra, model perhiasan, atau pihak lawan voucher. */
  title: string;
  /** Baris kedua: jenis dokumen, status, atau keterangan singkat. */
  subtitle: string;
  /** `YYYY-MM-DD` — tanggal dokumen, bukan tanggal pengajuan. */
  date: string;
  /** Nilai uang dokumen bila punya, sudah dalam rupiah presentasi. */
  amount_idr: number | null;
  /** Berat yang relevan bila dokumennya bicara gram. */
  weight_gram: number | null;
  /** Rute halaman dokumennya, atau `null` bila layarnya memang belum ada. */
  href: string | null;
}

export interface ApprovalRequestDTO {
  id: string;
  number: string;
  kind: ApprovalKindDTO;
  status: ApprovalStatusDTO;
  subject_id: string;
  subject: ApprovalSubjectDTO | null;
  request_note: string | null;
  requested_by: ApprovalActorRefDTO | null;
  requested_at: string;
  decided_by: ApprovalActorRefDTO | null;
  decided_at: string | null;
  decision_note: string | null;
}

export type ApprovalRequestListDTO = PaginatedDTO<ApprovalRequestDTO>;
