import type {
  PartnerVerificationState,
  PartnerVerificationStatus,
} from '@/types/value-objects';

/**
 * Masa berlaku dan pembacaan status verifikasi mitra (KYP).
 *
 * **Kedaluwarsa diturunkan, tidak disimpan.** Yang ada di kolom hanyalah
 * keputusan yang pernah diambil orang (`UNVERIFIED`/`PENDING`/`VERIFIED`/
 * `REJECTED`) plus tanggal berlakunya; "kedaluwarsa" cuma tanggal yang lewat,
 * jadi ia dihitung tiap kali dibaca. Menyimpannya berarti menaruh kebenaran
 * layar di tangan sebuah cron — dan semalam saja cron itu tidak jalan, centang
 * "Terverifikasi" akan terpasang di atas data yang sudah wajib diperbarui.
 *
 * Fungsinya murni dan isomorfik: route handler memakainya untuk menolak
 * pengajuan ganda, DTO memakainya untuk mengisi status yang tampil, dan layar
 * memakainya untuk memilih badge — jadi ketiganya tidak mungkin berselisih.
 */

/** Verifikasi bertahan dua tahun, lalu datanya harus diperbarui dan diajukan lagi. */
export const PARTNER_VERIFICATION_VALID_YEARS = 2;

/** Ambang peringatan "segera kedaluwarsa" di halaman mitra. */
export const PARTNER_VERIFICATION_WARNING_DAYS = 60;

/** `verifiedAt` + 2 tahun — satu-satunya tempat masa berlaku itu dihitung. */
export function partnerVerifiedUntil(verifiedAt: Date): Date {
  const until = new Date(verifiedAt);
  until.setFullYear(until.getFullYear() + PARTNER_VERIFICATION_VALID_YEARS);
  return until;
}

/**
 * Status yang tampil: status tersimpan, kecuali masa berlakunya sudah lewat.
 * `verifiedUntil` yang kosong pada baris `VERIFIED` dibaca apa adanya — itu
 * hanya mungkin untuk data lama, dan menebaknya kedaluwarsa akan mencabut
 * centang yang tidak pernah salah.
 */
export function partnerVerificationState(
  status: PartnerVerificationStatus,
  verifiedUntil: Date | string | null,
  now: Date = new Date(),
): PartnerVerificationState {
  if (status !== 'VERIFIED' || !verifiedUntil) return status;

  const until = verifiedUntil instanceof Date ? verifiedUntil : new Date(verifiedUntil);

  return until.getTime() <= now.getTime() ? 'EXPIRED' : 'VERIFIED';
}

/** Centang di layar menyala hanya untuk ini — kedaluwarsa bukan terverifikasi. */
export function isPartnerVerified(state: PartnerVerificationState): boolean {
  return state === 'VERIFIED';
}

/**
 * Boleh diajukan (ulang) bila belum pernah, ditolak, atau sudah kedaluwarsa.
 * `PENDING` sudah antre, dan `VERIFIED` yang masih berlaku tidak perlu apa-apa.
 */
export function canRequestPartnerVerification(state: PartnerVerificationState): boolean {
  return state === 'UNVERIFIED' || state === 'REJECTED' || state === 'EXPIRED';
}

/** Sisa hari sampai kedaluwarsa; negatif bila sudah lewat. */
export function daysUntilPartnerExpiry(
  verifiedUntil: Date | string,
  now: Date = new Date(),
): number {
  const until = verifiedUntil instanceof Date ? verifiedUntil : new Date(verifiedUntil);
  const millisPerDay = 24 * 60 * 60 * 1000;

  return Math.ceil((until.getTime() - now.getTime()) / millisPerDay);
}
