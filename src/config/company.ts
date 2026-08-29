/**
 * Identitas badan hukum PT TAN — kop surat setiap dokumen cetak.
 *
 * Duduk di config, bukan di database, karena nilainya berubah setahun sekali
 * sementara dokumennya dicetak tiap hari: satu tabel + halaman pengaturan +
 * permission untuk sembilan baris teks adalah biaya yang tidak dibayar apa pun.
 * Kalau nanti perusahaan punya lebih dari satu badan hukum, barulah ia pindah
 * ke master data — dan yang berubah cuma isi file ini, bukan pemanggilnya.
 *
 * Field yang masih kosong **tidak dicetak** dan tidak diganti teks pengganti:
 * NPWP karangan di atas surat pernyataan lebih berbahaya daripada NPWP yang
 * tidak ada. Layar memperingatkan yang kurang lewat `missingCompanyFields()`,
 * kertasnya tetap bersih.
 */

export interface CompanyIdentity {
  /** Nama badan hukum lengkap — yang dicetak paling besar di kop. */
  legalName: string;
  /** Satu baris di bawah nama: bidang usahanya. Boleh kosong. */
  businessLine: string;
  /** Alamat, satu baris per elemen — kop surat tidak pernah membungkus alamat sendiri. */
  addressLines: string[];
  /** Kota penandatanganan — "Jakarta, 15 Agustus 2026" di blok tanda tangan. */
  city: string;
  phone: string;
  email: string;
  npwp: string;
  /** Nomor Induk Berusaha. Boleh kosong bila tidak ingin dicetak. */
  nib: string;
  /** Penanda tangan default surat kuasa — bisa ditimpa per dokumen bila perlu. */
  signerName: string;
  signerTitle: string;
}

export const companyIdentity: CompanyIdentity = {
  legalName: 'PT TAN',
  businessLine: 'Perdagangan Logam Mulia & Perhiasan',
  addressLines: [],
  city: '',
  phone: '',
  email: '',
  npwp: '',
  nib: '',
  signerName: '',
  signerTitle: 'Direktur',
};

/** Label field wajib kop surat — urutannya sama dengan urutan cetaknya. */
const REQUIRED_FIELDS: { label: string; isFilled: (identity: CompanyIdentity) => boolean }[] = [
  { label: 'Nama badan hukum', isFilled: (identity) => identity.legalName.trim() !== '' },
  { label: 'Alamat', isFilled: (identity) => identity.addressLines.some((line) => line.trim() !== '') },
  { label: 'Kota', isFilled: (identity) => identity.city.trim() !== '' },
  { label: 'Telepon', isFilled: (identity) => identity.phone.trim() !== '' },
  { label: 'NPWP', isFilled: (identity) => identity.npwp.trim() !== '' },
  { label: 'Nama penanda tangan', isFilled: (identity) => identity.signerName.trim() !== '' },
];

/**
 * Field kop surat yang belum diisi. Dipakai untuk memperingatkan di layar —
 * peringatannya `print:hidden`, jadi ia menegur petugas tanpa ikut ke kertas.
 */
export function missingCompanyFields(identity: CompanyIdentity = companyIdentity): string[] {
  return REQUIRED_FIELDS.filter((field) => !field.isFilled(identity)).map((field) => field.label);
}
