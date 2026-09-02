/**
 * Bagan Akun PT TAN — diangkat **verbatim** dari `getDefaultChartOfAccounts()`
 * di `data/storage.js` milik erp-tan-felix (commit terakhir 2026-08-29).
 *
 * Kode yang dipakai di aplikasi operasional (1157, 1159, 11502, 115601,
 * 53000, dst) sengaja **tidak** diubah ke skema 4-5 digit abstrak, karena:
 * 1. Seluruh modul views/* dan unit test legacy mengandalkan kode ini persis.
 * 2. Akun-akun kritis penjurnalan (1157, 1158, 1159, 11502, 2110, 5114, 5115)
 *    sudah berwiring di handler SAK EMKM — mengubah kodenya = mengubah jurnal.
 *
 * `isTan` menandai akun yang lahir dari kebutuhan khusus PT TAN (valas, transit
 * kurir, vault ekspor). Seeder hanya menetapkan `isTan` saat baris pertama kali
 * dibuat; sesudah itu flag menjadi milik perusahaan.
 *
 * Catatan duplikat yang ada di sumber asli:
 * - `1122` "Bank BCA" dan `11214` "Bank BCA" — disimpan apa adanya, nama saja
 *   yang sama, kodenya berbeda, keduanya detail.
 * - `12101` "Tanah" dan `1210` "Tanah" — duplikat nama di level berbeda, oke.
 * - `1174` "PPN Masukan" dan `11901` "PPN Masukan" — dua slot berbeda, oke.
 */
export interface RawAccount {
  code: string;
  name: string;
  /** 'header' = akun induk, 'detail' = akun daun yang boleh dijurnal */
  type: 'header' | 'detail';
  category: 'aset' | 'kewajiban' | 'ekuitas' | 'pendapatan' | 'beban' | 'pendapatan_lain';
  /** isTan = true untuk akun khusus PT TAN Export/Impor */
  isTan?: boolean;
}

export const ACCOUNT_SKELETON: RawAccount[] = [
  // ── 1 ASET ───────────────────────────────────────────────────────────────
  { code: '1000',   name: 'ASET',                                       type: 'header', category: 'aset' },

  { code: '1100',   name: 'ASET LANCAR',                                type: 'header', category: 'aset' },

  // Kas
  { code: '1110',   name: 'Kas',                                        type: 'detail', category: 'aset' },
  { code: '11101',  name: 'Kas Kecil',                                  type: 'detail', category: 'aset' },

  // Bank
  { code: '1120',   name: 'Bank',                                       type: 'header', category: 'aset' },
  { code: '1121',   name: 'Bank BCA',                                   type: 'detail', category: 'aset' },
  { code: '11210',  name: 'Deposito',                                   type: 'detail', category: 'aset' },
  { code: '11211',  name: 'Deposito BCA',                               type: 'detail', category: 'aset' },
  { code: '11212',  name: 'BANK BCA',                                   type: 'detail', category: 'aset' },
  { code: '11213',  name: 'Bank BSI',                                   type: 'detail', category: 'aset' },
  { code: '11214',  name: 'Bank BCA',                                   type: 'detail', category: 'aset' },
  { code: '1122',   name: 'Bank BCA',                                   type: 'detail', category: 'aset' },
  { code: '1123',   name: 'Escrow Account Bank',                        type: 'detail', category: 'aset' },
  { code: '1125',   name: 'Bank USD (Valas)',                           type: 'detail', category: 'aset', isTan: true },
  { code: '11299',  name: 'Kas dalam Perjalanan',                       type: 'detail', category: 'aset' },

  // Piutang Usaha
  { code: '1130',   name: 'Piutang Usaha',                             type: 'detail', category: 'aset' },
  { code: '1132',   name: 'Piutang Usaha - Ekspor',                    type: 'detail', category: 'aset', isTan: true },
  { code: '1121-1', name: 'Uang Muka Pembelian Emas Lokal',           type: 'detail', category: 'aset', isTan: true },
  { code: '1121-2', name: 'Uang Muka Pembelian Emas Impor',           type: 'detail', category: 'aset', isTan: true },
  { code: '1135',   name: 'Uang Muka Impor / Pembelian Valas',         type: 'detail', category: 'aset', isTan: true },
  { code: '11301',  name: 'Piutang usaha Refineri',                    type: 'detail', category: 'aset' },
  { code: '11302',  name: 'Piiutang Usaha Digital Emas',               type: 'detail', category: 'aset' },

  // Piutang Lain-lain
  { code: '1140',   name: 'Piutang Lain-lain',                         type: 'detail', category: 'aset' },
  { code: '11400',  name: 'Investasi',                                  type: 'detail', category: 'aset' },
  { code: '11401',  name: 'Piutang Karyawan - Perjalanan Dinas',       type: 'detail', category: 'aset' },
  { code: '11402',  name: 'Piutang Karyawan - Belanja',                type: 'detail', category: 'aset' },

  // Persediaan Bahan Baku
  { code: '1150',   name: 'PERSEDIAAN BAHAN BAKU',                     type: 'header', category: 'aset' },
  { code: '11502',  name: 'Persediaan dalam proses',                   type: 'detail', category: 'aset', isTan: true },
  { code: '11503',  name: 'Persediaan barang jadi',                    type: 'detail', category: 'aset' },
  { code: '1151',   name: 'Emas Mentah',                               type: 'detail', category: 'aset' },
  { code: '1152',   name: 'Scrap Gold',                                type: 'detail', category: 'aset', isTan: true },
  { code: '1153',   name: 'Silver & Logam Mulia Lain',                 type: 'detail', category: 'aset', isTan: true },
  { code: '1157',   name: 'Persediaan Logam Mulia Antam (Gold Bar)',   type: 'detail', category: 'aset', isTan: true },
  { code: '1158',   name: 'Persediaan Logam Mulia Valcambi/LBMA (Import)', type: 'detail', category: 'aset', isTan: true },
  { code: '1159',   name: 'Persediaan Emas Dalam Perjalanan Kurir (Transit)', type: 'detail', category: 'aset', isTan: true },
  { code: '1154',   name: 'Chemicals & Flux Materials',                type: 'detail', category: 'aset' },
  { code: '1155',   name: 'Consumables (Crucibles, Molds)',            type: 'detail', category: 'aset' },

  // Emas Pelapis Digital (denominasi)
  { code: '115601', name: 'Persediaan Emas Pelapis Digital - 1000 gr', type: 'detail', category: 'aset' },
  { code: '115602', name: 'Persediaan Emas Pelapis Digital - 500 gr',  type: 'detail', category: 'aset' },
  { code: '115603', name: 'Persediaan Emas Pelapis Digital - 250 gr',  type: 'detail', category: 'aset' },
  { code: '115604', name: 'Persediaan Emas Pelapis Digital - 100 gr',  type: 'detail', category: 'aset' },
  { code: '115605', name: 'Persediaan Emas Pelapis Digital - 50 gr',   type: 'detail', category: 'aset' },
  { code: '115606', name: 'Persediaan Emas Pelapis Digital - 25 gr',   type: 'detail', category: 'aset' },
  { code: '115607', name: 'Persediaan Emas Pelapis Digital - 10 gr',   type: 'detail', category: 'aset' },
  { code: '115608', name: 'Persediaan Emas Pelapis Digital - 5 gr',    type: 'detail', category: 'aset' },
  { code: '115609', name: 'Persediaan Emas Pelapis Digital - 2gr',     type: 'detail', category: 'aset' },
  { code: '115610', name: 'Persediaan Emas Pelapis Digital - 1 gr',    type: 'detail', category: 'aset' },

  // WIP (dalam proses produksi)
  { code: '1160',   name: 'PERSEDIAAN BARANG DALAM PROSES (WIP)',      type: 'header', category: 'aset' },
  { code: '1161',   name: 'WIP - Melting Stage',                       type: 'detail', category: 'aset' },
  { code: '1162',   name: 'WIP - Assay & Testing',                     type: 'detail', category: 'aset' },
  { code: '1163',   name: 'WIP - Refining/Electrolysis',               type: 'detail', category: 'aset' },
  { code: '1164',   name: 'WIP - Casting Stage',                       type: 'detail', category: 'aset' },
  { code: '1165',   name: 'WIP - Quality Control',                     type: 'detail', category: 'aset' },

  // Aset Lancar Lainnya
  { code: '1170',   name: 'ASET LANCAR LAINNYA',                       type: 'header', category: 'aset' },
  { code: '1171',   name: 'Asuransi dibyr dimuka',                     type: 'detail', category: 'aset' },
  { code: '1172',   name: 'Emas Titipan Customer (Refining Service)',  type: 'detail', category: 'aset' },
  { code: '1173',   name: 'Biaya Dibayar Dimuka',                      type: 'detail', category: 'aset' },
  { code: '1174',   name: 'PPN Masukan',                               type: 'detail', category: 'aset' },

  // Persediaan Barang Jadi
  { code: '1180',   name: 'PERSEDIAAN BARANG JADI',                    type: 'header', category: 'aset' },
  { code: '1181',   name: 'Gold Bar 24K (99.99%)',                     type: 'detail', category: 'aset', isTan: true },
  { code: '1182',   name: 'Gold Grain/Granules',                       type: 'detail', category: 'aset', isTan: true },
  { code: '1183',   name: 'Gold Sheet/Foil',                           type: 'detail', category: 'aset', isTan: true },
  { code: '1184',   name: 'Gold Wire',                                 type: 'detail', category: 'aset', isTan: true },
  { code: '1185',   name: 'By-products (Silver, Copper, dll)',         type: 'detail', category: 'aset', isTan: true },

  // Pajak Dibayar Dimuka
  { code: '11900',  name: 'Pajak Dibayar dimuka',                      type: 'header', category: 'aset' },
  { code: '11901',  name: 'PPN Masukan',                               type: 'detail', category: 'aset' },
  { code: '11902',  name: 'Pajak Dibayar dimuka-PPh 21',               type: 'detail', category: 'aset' },
  { code: '11903',  name: 'Pajak Dibayar dimuka-PPh 22',               type: 'detail', category: 'aset', isTan: true },
  { code: '11904',  name: 'Pajak Dibayar dimuka-PPh 23',               type: 'detail', category: 'aset' },
  { code: '11905',  name: 'Pajak Dibayar dimuka-PPh 25',               type: 'detail', category: 'aset' },

  // ── ASET TIDAK LANCAR ────────────────────────────────────────────────────
  { code: '1200',   name: 'ASET TIDAK LANCAR',                         type: 'header', category: 'aset' },

  // Uang Muka Pembelian Aset Tetap
  { code: '12030',  name: 'Uang Muka Pembelian',                       type: 'header', category: 'aset' },
  { code: '12031',  name: 'Uang Muka Pembelian Tanah',                 type: 'detail', category: 'aset' },
  { code: '12032',  name: 'Uang Muka Pembelian Bangunan',              type: 'detail', category: 'aset' },
  { code: '12033',  name: 'Uang Muka Pembelian Kendaraan',             type: 'detail', category: 'aset' },
  { code: '12034',  name: 'Uang Muka Pembelian Mesin',                 type: 'detail', category: 'aset' },
  { code: '12035',  name: 'Uang Muka Pembelian Inventaris dan Peralatan Kantor', type: 'detail', category: 'aset' },

  // Tanah & Bangunan
  { code: '1210',   name: 'Tanah',                                     type: 'detail', category: 'aset' },
  { code: '12100',  name: 'Harga Perolehan',                           type: 'header', category: 'aset' },
  { code: '12101',  name: 'Tanah',                                     type: 'detail', category: 'aset' },
  { code: '12102',  name: 'Bangunan',                                  type: 'detail', category: 'aset' },
  { code: '12103',  name: 'Kendaraan',                                 type: 'detail', category: 'aset' },
  { code: '12104',  name: 'Mesin',                                     type: 'detail', category: 'aset' },
  { code: '12105',  name: 'Akumulasi Penyusutan Mesin',                type: 'detail', category: 'aset' },
  { code: '1220',   name: 'Bangunan',                                  type: 'detail', category: 'aset' },
  { code: '1221',   name: 'Akumulasi Penyusutan Bangunan',             type: 'detail', category: 'aset' },
  { code: '1230',   name: 'Kendaraan',                                 type: 'detail', category: 'aset' },
  { code: '1231',   name: 'Akumulasi Penyusutan Kendaraan',            type: 'detail', category: 'aset' },
  { code: '1235',   name: 'Peralatan Kantor',                          type: 'detail', category: 'aset' },
  { code: '1236',   name: 'Akumulasi Penyusutan Peralatan Kantor',     type: 'detail', category: 'aset' },
  { code: '1237',   name: 'Furniture Kantor',                          type: 'detail', category: 'aset' },
  { code: '12379',  name: 'Akumulasi Penyusutan Furniture Kantor',     type: 'detail', category: 'aset' },

  // Peralatan Produksi
  { code: '1240',   name: 'PERALATAN PRODUKSI',                        type: 'header', category: 'aset' },
  { code: '1241',   name: 'Furnace & Melting Equipment',               type: 'detail', category: 'aset' },
  { code: '12410',  name: 'Harga Perolehan Peralatan Produksi',        type: 'header', category: 'aset' },
  { code: '12414',  name: 'Furnace & Melting Equipment',               type: 'detail', category: 'aset' },
  { code: '12419',  name: 'Akumulasi Penyusutan Furnace & Melting Equipment', type: 'detail', category: 'aset' },
  { code: '1242',   name: 'Assay Equipment',                           type: 'detail', category: 'aset' },
  { code: '12429',  name: 'Akumulasi Penyusutan Assay Equipment',      type: 'detail', category: 'aset' },
  { code: '1243',   name: 'Refining Equipment',                        type: 'detail', category: 'aset' },
  { code: '12439',  name: 'Akumulasi Penyusutan Refining Equipment',   type: 'detail', category: 'aset' },
  { code: '1244',   name: 'Casting Equipment',                         type: 'detail', category: 'aset' },
  { code: '12449',  name: 'Akumulasi Penyusutan Casting Equipment',    type: 'detail', category: 'aset' },
  { code: '1245',   name: 'Testing & Lab Equipment',                   type: 'detail', category: 'aset' },
  { code: '12459',  name: 'Akumulasi Penyusutan Testing & Lab',        type: 'detail', category: 'aset' },
  { code: '1246',   name: 'Support Equipment',                         type: 'detail', category: 'aset' },
  { code: '12469',  name: 'Akumulasi Penyusutan Support Equipment',    type: 'detail', category: 'aset' },
  { code: '1247',   name: 'Safety & Ventilation Equipment',            type: 'detail', category: 'aset' },
  { code: '12479',  name: 'Akumulasi Penyusutan Safety & Ventilation Equipment', type: 'detail', category: 'aset' },
  { code: '1248',   name: 'Waste Treatment',                           type: 'detail', category: 'aset' },
  { code: '12489',  name: 'Akumulasi Penyusutan Waste Treatment',      type: 'detail', category: 'aset' },
  { code: '1250',   name: 'Safety & Ventilation Equipment',            type: 'detail', category: 'aset' },
  { code: '1251',   name: 'Waste Treatment Equipment',                 type: 'detail', category: 'aset' },
  { code: '1252',   name: 'Akumulasi Penyusutan - Safety Equipment',   type: 'detail', category: 'aset' },
  { code: '1290',   name: 'Akumulasi Penyusutan Peralatan Produksi',   type: 'detail', category: 'aset' },

  // Aktiva Tak Berwujud
  { code: '13000',  name: 'Aktiva Tetap Tak Berwujud',                 type: 'header', category: 'aset' },
  { code: '13011',  name: 'Biaya Pra Operasi',                         type: 'detail', category: 'aset' },
  { code: '13012',  name: 'Goodwill',                                  type: 'detail', category: 'aset' },
  { code: '13013',  name: 'Software',                                  type: 'detail', category: 'aset' },
  { code: '13021',  name: 'Uang Muka Software',                        type: 'detail', category: 'aset' },

  // ── 2 KEWAJIBAN ──────────────────────────────────────────────────────────
  { code: '2000',   name: 'KEWAJIBAN',                                 type: 'header', category: 'kewajiban' },

  { code: '2100',   name: 'KEWAJIBAN JANGKA PENDEK',                   type: 'header', category: 'kewajiban' },

  // Hutang Usaha
  { code: '2110',   name: 'Hutang Usaha',                              type: 'detail', category: 'kewajiban', isTan: true },
  { code: '21102',  name: 'Hutang Retensi',                            type: 'detail', category: 'kewajiban' },
  { code: '2111',   name: 'Uang Titipan Customer',                     type: 'detail', category: 'kewajiban' },
  { code: '2112',   name: 'Emas Titipan Customer (Liability)',          type: 'detail', category: 'kewajiban' },
  { code: '2113',   name: 'Biaya yang masih harus dibayar',            type: 'header', category: 'kewajiban' },

  // Hutang Pajak
  { code: '21140',  name: 'Hutang pajak',                              type: 'header', category: 'kewajiban' },
  { code: '21141',  name: 'Hutang Pajak - PPN',                        type: 'detail', category: 'kewajiban' },
  { code: '21142',  name: 'Hutang PPh 21',                             type: 'detail', category: 'kewajiban' },
  { code: '21143',  name: 'Hutang PPh 22',                             type: 'detail', category: 'kewajiban' },
  { code: '21144',  name: 'Hutang PPh 23',                             type: 'detail', category: 'kewajiban' },
  { code: '21145',  name: 'Hutang PPh Pasal 4 ayat 2',                 type: 'detail', category: 'kewajiban' },
  { code: '21146',  name: 'Hutang PPh Badan',                          type: 'detail', category: 'kewajiban' },

  { code: '2120',   name: 'Hutang Bank Jangka Pendek',                 type: 'detail', category: 'kewajiban' },
  { code: '2130',   name: 'Hutang Pajak',                              type: 'detail', category: 'kewajiban' },
  { code: '2140',   name: 'Hutang Lain-lain',                          type: 'detail', category: 'kewajiban' },
  { code: '2141',   name: 'Hutang Listrik & Utilities',                type: 'detail', category: 'kewajiban' },
  { code: '2142',   name: 'Hutang Assay & Testing Services',           type: 'detail', category: 'kewajiban' },
  { code: '2116',   name: 'Uang Muka Penjualan',                       type: 'header', category: 'kewajiban' },
  { code: '2116-1', name: 'Uang Muka Penjualan Emas Lokal',           type: 'detail', category: 'kewajiban', isTan: true },
  { code: '2116-2', name: 'Uang Muka Penjualan Perhiasan Ekspor',     type: 'detail', category: 'kewajiban', isTan: true },
  { code: '2150',   name: 'Uang Muka Penjualan',                       type: 'detail', category: 'kewajiban', isTan: true },
  { code: '21601',  name: 'Saldo hutang deposit nasabah (user wallet liability)', type: 'detail', category: 'kewajiban' },
  { code: '21701',  name: 'Hutang Emas Digital Nasabah',               type: 'detail', category: 'kewajiban' },

  { code: '2200',   name: 'KEWAJIBAN JANGKA PANJANG',                  type: 'header', category: 'kewajiban' },
  { code: '2210',   name: 'Hutang Bank Jangka Panjang',                type: 'detail', category: 'kewajiban' },
  { code: '2220',   name: 'Hutang Obligasi',                           type: 'detail', category: 'kewajiban' },

  // ── 3 EKUITAS ────────────────────────────────────────────────────────────
  { code: '3000',   name: 'EKUITAS',                                   type: 'header', category: 'ekuitas' },
  { code: '3100',   name: 'Modal Disetor',                             type: 'detail', category: 'ekuitas' },
  { code: '31001',  name: 'Modal Disetor',                             type: 'detail', category: 'ekuitas' },
  { code: '31100',  name: 'Saldo Laba',                                type: 'detail', category: 'ekuitas' },
  { code: '31101',  name: 'Laba Berjalan',                             type: 'detail', category: 'ekuitas' },
  { code: '31102',  name: 'Saldo laba',                                type: 'detail', category: 'ekuitas' },
  { code: '31200',  name: 'Deviden',                                   type: 'detail', category: 'ekuitas' },
  { code: '31201',  name: 'Deviden tunai',                             type: 'detail', category: 'ekuitas' },
  { code: '3200',   name: 'Laba Ditahan',                              type: 'detail', category: 'ekuitas' },
  { code: '32001',  name: 'Prive',                                     type: 'detail', category: 'ekuitas' },
  { code: '3300',   name: 'Laba Tahun Berjalan',                       type: 'detail', category: 'ekuitas' },

  // ── 4 PENDAPATAN ─────────────────────────────────────────────────────────
  { code: '4000',   name: 'PENDAPATAN',                                type: 'header', category: 'pendapatan' },

  { code: '4100',   name: 'PENDAPATAN PENJUALAN PRODUK',               type: 'header', category: 'pendapatan' },
  { code: '41101',  name: 'PENJUALAN',                                 type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4111',   name: 'Penjualan Gold Bar',                        type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4112',   name: 'Penjualan Gold Grain',                      type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4113',   name: 'Penjualan Gold Sheet/Wire',                 type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4114',   name: 'Penjualan By-products',                     type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4115',   name: 'Penjualan Emas Digital',                    type: 'detail', category: 'pendapatan' },
  { code: '4116',   name: 'Penjualan Perhiasan Emas Ekspor (PPN 0%)',  type: 'detail', category: 'pendapatan', isTan: true },

  { code: '4120',   name: 'PENDAPATAN JASA',                           type: 'header', category: 'pendapatan' },
  { code: '4121',   name: 'Pendapatan Jasa Refining',                  type: 'detail', category: 'pendapatan' },
  { code: '4122',   name: 'Pendapatan Jasa Assay/Testing',             type: 'detail', category: 'pendapatan' },

  { code: '4200',   name: 'PENDAPATAN LAIN-LAIN',                      type: 'header', category: 'pendapatan' },
  { code: '4201',   name: 'Pendapatan Selisih Kurs Emas',              type: 'detail', category: 'pendapatan', isTan: true },
  { code: '4202',   name: 'Gain on Gold Price Revaluation',            type: 'detail', category: 'pendapatan' },
  { code: '420301', name: 'Pendapatan Spread jual beli',               type: 'detail', category: 'pendapatan' },
  { code: '420302', name: 'Pendapatan biaya cetak fisik & minting',    type: 'detail', category: 'pendapatan' },
  { code: '420303', name: 'Pendapatan biaya penarikan dana',           type: 'detail', category: 'pendapatan' },
  { code: '4210',   name: 'Pendapatan Bunga',                          type: 'detail', category: 'pendapatan' },

  // ── 5 BEBAN ──────────────────────────────────────────────────────────────
  { code: '5000',   name: 'BEBAN',                                     type: 'header', category: 'beban' },

  // HPP
  { code: '5100',   name: 'HARGA POKOK PRODUKSI',                      type: 'header', category: 'beban' },

  { code: '5110',   name: 'BIAYA BAHAN BAKU LANGSUNG',                 type: 'header', category: 'beban' },
  { code: '5111',   name: 'Biaya Bahan Baku Emas',                     type: 'detail', category: 'beban' },
  { code: '5112',   name: 'Biaya Chemicals & Flux',                    type: 'detail', category: 'beban' },
  { code: '5113',   name: 'Biaya Consumables',                         type: 'detail', category: 'beban' },
  { code: '5114',   name: 'HPP - Logam Mulia Antam',                   type: 'detail', category: 'beban', isTan: true },
  { code: '5115',   name: 'HPP - Logam Mulia Valcambi/LBMA',           type: 'detail', category: 'beban', isTan: true },
  { code: '5150',   name: 'Beban Ekspor & Freight Ekspor',             type: 'detail', category: 'beban', isTan: true },

  { code: '5120',   name: 'BIAYA TENAGA KERJA LANGSUNG',               type: 'header', category: 'beban' },
  { code: '5121',   name: 'Gaji Operator Produksi',                    type: 'detail', category: 'beban' },
  { code: '5122',   name: 'Gaji Technician',                           type: 'detail', category: 'beban' },

  { code: '5130',   name: 'OVERHEAD PABRIK',                           type: 'header', category: 'beban' },
  { code: '5131',   name: 'Biaya Produksi',                            type: 'detail', category: 'beban' },
  { code: '5132',   name: 'Biaya Gas & Fuel',                          type: 'detail', category: 'beban' },
  { code: '5133',   name: 'Biaya Maintenance Equipment',               type: 'detail', category: 'beban' },
  { code: '5134',   name: 'Biaya Assay & Lab Testing',                 type: 'detail', category: 'beban' },
  { code: '5135',   name: 'Biaya Safety & PPE',                        type: 'detail', category: 'beban' },
  { code: '5136',   name: 'Penyusutan Peralatan Produksi',             type: 'detail', category: 'beban' },

  { code: '5140',   name: 'LOSSES & ADJUSTMENTS',                      type: 'header', category: 'beban' },
  { code: '5141',   name: 'Susut Produksi Normal',                     type: 'detail', category: 'beban', isTan: true },
  { code: '5142',   name: 'Susut Produksi Abnormal',                   type: 'detail', category: 'beban', isTan: true },
  { code: '5143',   name: 'Loss on Gold Price Revaluation',            type: 'detail', category: 'beban' },
  { code: '5144',   name: 'Selisih Timbang (Weight Difference)',       type: 'detail', category: 'beban', isTan: true },

  // Beban Operasional
  { code: '5200',   name: 'BEBAN OPERASIONAL',                         type: 'header', category: 'beban' },
  { code: '5210',   name: 'Beban Gaji Administrasi',                   type: 'detail', category: 'beban' },
  { code: '5211',   name: 'Beban Gaji Sales & Marketing',              type: 'detail', category: 'beban' },
  { code: '5220',   name: 'Beban Sewa',                                type: 'detail', category: 'beban' },
  { code: '5230',   name: 'Beban Listrik dan Air (Office)',             type: 'detail', category: 'beban' },
  { code: '5240',   name: 'Beban Telepon dan Internet',                type: 'detail', category: 'beban' },

  { code: '52400',  name: 'Biaya iklan dan Promosi',                   type: 'detail', category: 'beban' },
  { code: '52401',  name: 'Biaya Promosi',                             type: 'detail', category: 'beban' },
  { code: '52402',  name: 'Biaya Marketing Tools',                     type: 'detail', category: 'beban' },
  { code: '52403',  name: 'Biaya iklan',                               type: 'detail', category: 'beban' },

  { code: '5250',   name: 'Beban Pendukung Produksi',                  type: 'detail', category: 'beban' },
  { code: '5260',   name: 'Beban Penyusutan (Non-Production)',          type: 'detail', category: 'beban' },
  { code: '5270',   name: 'Beban Pemeliharaan',                        type: 'detail', category: 'beban' },
  { code: '5271',   name: 'Beban Lab & QC',                            type: 'detail', category: 'beban' },
  { code: '5272',   name: 'Biaya Sertifikasi & Compliance',            type: 'detail', category: 'beban' },
  { code: '5280',   name: 'Beban Transport & Delivery',                type: 'detail', category: 'beban' },
  { code: '5281',   name: 'Biaya Waste Management',                    type: 'detail', category: 'beban' },
  { code: '5282',   name: 'Biaya Environmental Compliance',            type: 'detail', category: 'beban' },
  { code: '5290',   name: 'Beban Operasional Lain-lain',               type: 'detail', category: 'beban' },

  // Biaya Administrasi dan Umum
  { code: '53000',  name: 'Biaya Administrasi dan Umum',               type: 'header', category: 'beban' },

  { code: '53100',  name: 'Biaya Gaji',                                type: 'header', category: 'beban' },
  { code: '53101',  name: 'Biaya Gaji Karyawan',                       type: 'detail', category: 'beban' },
  { code: '53102',  name: 'THR dan Bonus',                             type: 'detail', category: 'beban' },
  { code: '53103',  name: 'Tunjangan Transport',                       type: 'detail', category: 'beban' },
  { code: '53109',  name: 'Tunjangan lainnya',                         type: 'detail', category: 'beban' },
  { code: '53110',  name: 'Biaya kesejahteraan pegawai',               type: 'detail', category: 'beban' },
  { code: '53111',  name: 'BPJS',                                      type: 'detail', category: 'beban' },
  { code: '53112',  name: 'Uang Makan',                                type: 'detail', category: 'beban' },
  { code: '53113',  name: 'BIaya Kesehatan Karyawan',                  type: 'detail', category: 'beban' },
  { code: '53119',  name: 'Lainnya',                                   type: 'detail', category: 'beban' },

  { code: '53120',  name: 'Biaya Transportasi',                        type: 'detail', category: 'beban' },
  { code: '53121',  name: 'Bahan bakar dan listrik mobil',             type: 'detail', category: 'beban' },
  { code: '53122',  name: 'Taxi dll',                                  type: 'detail', category: 'beban' },
  { code: '53123',  name: 'Biaya Hotel/penginapan',                    type: 'detail', category: 'beban' },
  { code: '53129',  name: 'Lainnya',                                   type: 'detail', category: 'beban' },

  { code: '53130',  name: 'Biaya Utilitas',                            type: 'detail', category: 'beban' },
  { code: '53131',  name: 'Beban Listrik',                             type: 'detail', category: 'beban' },
  { code: '53132',  name: 'Beban Air-PDAM',                            type: 'detail', category: 'beban' },
  { code: '53133',  name: 'Telepon',                                   type: 'detail', category: 'beban' },
  { code: '53134',  name: 'Biaya Internet',                            type: 'detail', category: 'beban' },
  { code: '53135',  name: 'BIaya Internet - Hosting Website Aplikasi dll', type: 'detail', category: 'beban' },

  { code: '53140',  name: 'Biaya Sewa',                                type: 'detail', category: 'beban' },
  { code: '53141',  name: 'Sewa Kantor',                               type: 'detail', category: 'beban' },
  { code: '53149',  name: 'Sewa lainnya',                              type: 'detail', category: 'beban' },

  { code: '53150',  name: 'Biaya Perlengkapan kantor',                 type: 'detail', category: 'beban' },
  { code: '53151',  name: 'alat Tulis Stasionery',                     type: 'detail', category: 'beban' },
  { code: '53152',  name: 'Cetakan',                                   type: 'detail', category: 'beban' },
  { code: '53153',  name: 'Biaya Pos, Meterai & Kurir',                type: 'detail', category: 'beban' },

  { code: '53160',  name: 'Biaya Jasa profesional',                    type: 'header', category: 'beban' },
  { code: '53161',  name: 'Biaya Notaris dan Konsultan hukum',         type: 'detail', category: 'beban' },
  { code: '53162',  name: 'Biaya Akuntan',                             type: 'detail', category: 'beban' },
  { code: '53169',  name: 'Biaya profesional lainnya',                 type: 'detail', category: 'beban' },

  { code: '53180',  name: 'Biaya Amortisasi',                          type: 'header', category: 'beban' },
  { code: '53181',  name: 'Biaya Amortisasi Pra Operasi',              type: 'detail', category: 'beban' },
  { code: '53189',  name: 'Biaya Amortisasi Aktiva Tak berwujud lainnya', type: 'detail', category: 'beban' },

  // Beban Emas Digital & Lainnya
  { code: '5401',   name: 'Beban Processing Fee Payment Gateaway',     type: 'detail', category: 'beban' },
  { code: '5402',   name: 'Beban asuransi & Vault Storage Emas',       type: 'detail', category: 'beban', isTan: true },
  { code: '5403',   name: 'Beban Registrasi ICDX',                     type: 'detail', category: 'beban' },
  { code: '5404',   name: 'Beban Registrasi ICH',                      type: 'detail', category: 'beban' },
  { code: '5405',   name: 'Beban transaksi',                           type: 'detail', category: 'beban' },
  { code: '5406',   name: 'Beban emas digital lainnya',                type: 'detail', category: 'beban' },

  { code: '5900',   name: 'Beban Bunga',                               type: 'detail', category: 'beban' },

  // ── 6 DI LUAR USAHA ──────────────────────────────────────────────────────
  { code: '6110',   name: 'Laba/Rugi Selisih Kurs Valas',              type: 'detail', category: 'pendapatan_lain', isTan: true },
];

/**
 * Union type semua kode akun yang ada di `ACCOUNT_SKELETON` — dipakai seeder
 * lain (mis. `product.seeder.ts`) untuk validasi kode akun saat kompilasi.
 * Salah ketik kode akan gagal di `tsc`, bukan gagal saat runtime seed.
 */
export type SeededAccountCode = (typeof ACCOUNT_SKELETON)[number]['code'];
