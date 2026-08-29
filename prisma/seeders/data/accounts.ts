/**
 * Bagan akun bawaan — diangkat dari COA operasional PT TAN (refinery emas,
 * emas digital, ekspor perhiasan) dan ditulis ulang mengikuti skema kode di
 * `src/lib/account-code.ts`: satu digit per level, dipad `0` sampai empat
 * karakter, karakter kelima untuk level terdalam.
 *
 * Sumbernya memakai penomoran bebas (`11101`, `115601`, `12030`) yang tidak
 * bisa dipetakan satu-satu ke skema ini — `0` di sini dipesan sebagai padding,
 * satu induk maksimal 9 anak, dan tree maksimal 5 level. Jadi isinya
 * dipertahankan, penomorannya disusun ulang, duplikat dirapikan (`Bank BCA`
 * empat kali, `1160` dipakai dua entitas berbeda, `Tanah` di dua level), dan
 * beberapa akun dipindah ke kelas yang benar: pendapatan bunga / selisih kurs /
 * revaluasi harga emas turun ke kelas 6 (Di Luar Usaha), Investasi keluar dari
 * Piutang Lain-lain ke Aset Lain-lain.
 *
 * Sepuluh denominasi Emas Pelapis Digital tidak muat sebagai anak satu induk
 * (batas 9), jadi dikelompokkan per tingkat denominasi — besar / menengah /
 * kecil.
 *
 * `isTan` menandai akun yang khusus milik PT TAN Export (valas, ekspor-impor).
 * Seeder hanya memasangnya saat baris dibuat; sesudah itu flag jadi milik
 * perusahaan.
 *
 * Berada di luar `src/` seperti katalog negara/mata uang: data seed tidak
 * pernah boleh ikut ke bundle client. Daftarnya rata — seeder menurunkan induk
 * tiap baris dari kodenya sendiri.
 */
export const ACCOUNT_SKELETON = [
  // ── 1 ASET ────────────────────────────────────────────────────────────────
  { code: '1000', name: 'ASET' },

  { code: '1100', name: 'ASET LANCAR' },

  { code: '1110', name: 'Kas' },
  { code: '1111', name: 'Kas Besar' },
  { code: '1112', name: 'Kas Kecil' },
  { code: '1113', name: 'Kas dalam Perjalanan' },

  { code: '1120', name: 'Bank' },
  { code: '1121', name: 'Bank BCA' },
  { code: '1122', name: 'Bank BSI' },
  { code: '1123', name: 'Bank Valas USD (Rekening Ekspor)', isTan: true },
  { code: '1124', name: 'Escrow Account Bank' },
  { code: '1125', name: 'Deposito' },
  { code: '11251', name: 'Deposito BCA' },

  { code: '1130', name: 'Piutang Usaha' },
  { code: '1131', name: 'Piutang Usaha Refinery' },
  { code: '1132', name: 'Piutang Usaha Emas Digital' },
  { code: '1133', name: 'Piutang Usaha Ekspor (USD)', isTan: true },

  { code: '1140', name: 'Piutang Lain-lain' },
  { code: '1141', name: 'Piutang Karyawan - Perjalanan Dinas' },
  { code: '1142', name: 'Piutang Karyawan - Belanja' },

  { code: '1150', name: 'Persediaan' },
  { code: '1151', name: 'Persediaan Bahan Baku' },
  { code: '11511', name: 'Emas Mentah' },
  // Scrap emas yang **dibeli** duduk di sini dan tidak diduplikasi ke 1154:
  // barang tua untuk dilebur memang bahan baku, dan dua akun untuk satu benda
  // adalah cara saldonya terpecah tanpa ada yang terlihat salah di layar.
  { code: '11512', name: 'Emas Scrap' },
  { code: '11513', name: 'Silver & Logam Mulia Lain' },
  { code: '11514', name: 'Chemicals & Flux Materials' },
  { code: '11515', name: 'Consumables (Crucibles, Molds)' },
  // Perhiasan yang **dibeli**, bukan yang diproduksi sendiri (itu 11538).
  // Duduk di bahan baku karena barangnya masuk untuk dipilah dulu — sebagian
  // dilebur, sebagian dijual apa adanya — dan pada hari terima belum ada yang
  // tahu yang mana.
  { code: '11516', name: 'Perhiasan Emas (Dibeli)' },
  { code: '1152', name: 'Persediaan Dalam Proses (WIP)' },
  { code: '11521', name: 'WIP - Melting' },
  { code: '11522', name: 'WIP - Assay & Testing' },
  { code: '11523', name: 'WIP - Refining/Electrolysis' },
  { code: '11524', name: 'WIP - Casting' },
  { code: '11525', name: 'WIP - Quality Control' },
  { code: '1153', name: 'Persediaan Barang Jadi' },
  { code: '11531', name: 'Gold Bar 24K (99.99%)' },
  { code: '11532', name: 'Gold Grain/Granules' },
  { code: '11533', name: 'Gold Sheet/Foil' },
  { code: '11534', name: 'Gold Wire' },
  { code: '11535', name: 'By-products (Silver, Copper, dll)' },
  { code: '11536', name: 'Emas Murni 999.9 (LM Lokal)', isTan: true },
  { code: '11537', name: 'Emas Murni 999.9 (LM Import)', isTan: true },
  { code: '11538', name: 'Perhiasan Emas Siap Ekspor', isTan: true },

  // Logam murni yang **dibeli** — bukan hasil produksi sendiri, jadi bukan
  // Barang Jadi (1153) dan bukan Bahan Baku (1151): sekeping LM 99,99% yang
  // masuk brankas hari ini bisa keluar lagi apa adanya besok tanpa pernah
  // menyentuh tungku. Emas dan perak berdiri sebagai leaf masing-masing karena
  // satu gram perak dan satu gram emas tidak pernah boleh dijumlahkan — sumbu
  // yang sama yang memisahkan posisi stok di `product.prisma`.
  //
  // Batangan dan granul juga terpisah: keduanya logam murni dengan kadar yang
  // sama, tapi batangan bersertifikat per keping bernomor seri sementara granul
  // ditakar per gram, jadi yang bisa dicocokkan ke fisiknya memang bukan hal
  // yang sama. Slot 11545+ menampung bentuk berikutnya tanpa memindahkan yang
  // sudah ada.
  { code: '1154', name: 'Persediaan Logam Mulia' },
  { code: '11541', name: 'Emas Murni Batangan 999,9' },
  { code: '11542', name: 'Perak Murni Batangan 999,0' },
  { code: '11543', name: 'Emas Murni Granul' },
  { code: '11544', name: 'Perak Murni Granul 999,0' },

  // Barang yang sudah berangkat dari supplier tapi belum sampai di meja kita.
  //
  // Akun ini adalah **tempat singgah, bukan tempat tinggal**: ia didebit penuh
  // saat pengiriman dimulai (lawan `2111`, sehingga hutang berdiri sejak hak
  // milik pindah) lalu terkuras tiap kiriman datang sampai kembali nol. Saldo
  // yang tertinggal di sini berarti ada emas yang menurut buku sedang di jalan
  // — pertanyaan yang memang harus bisa dijawab satu layar.
  //
  // Dipisah per logam dengan alasan yang sama dengan 1154.
  { code: '1155', name: 'Persediaan dalam Perjalanan' },
  { code: '11551', name: 'Emas dalam Perjalanan' },
  { code: '11552', name: 'Perak dalam Perjalanan' },

  { code: '1160', name: 'Persediaan Emas Pelapis Digital' },
  { code: '1161', name: 'Emas Pelapis Digital - Denominasi Besar' },
  { code: '11611', name: 'Emas Pelapis Digital - 1000 gr' },
  { code: '11612', name: 'Emas Pelapis Digital - 500 gr' },
  { code: '11613', name: 'Emas Pelapis Digital - 250 gr' },
  { code: '11614', name: 'Emas Pelapis Digital - 100 gr' },
  { code: '1162', name: 'Emas Pelapis Digital - Denominasi Menengah' },
  { code: '11621', name: 'Emas Pelapis Digital - 50 gr' },
  { code: '11622', name: 'Emas Pelapis Digital - 25 gr' },
  { code: '11623', name: 'Emas Pelapis Digital - 10 gr' },
  { code: '1163', name: 'Emas Pelapis Digital - Denominasi Kecil' },
  { code: '11631', name: 'Emas Pelapis Digital - 5 gr' },
  { code: '11632', name: 'Emas Pelapis Digital - 2 gr' },
  { code: '11633', name: 'Emas Pelapis Digital - 1 gr' },

  { code: '1170', name: 'Pajak Dibayar Dimuka' },
  { code: '1171', name: 'PPN Masukan' },
  { code: '1172', name: 'PPh Pasal 21 Dibayar Dimuka' },
  { code: '1173', name: 'PPh Pasal 22 Dibayar Dimuka' },
  { code: '1174', name: 'PPh Pasal 23 Dibayar Dimuka' },
  { code: '1175', name: 'PPh Pasal 25 Dibayar Dimuka' },

  { code: '1180', name: 'Aset Lancar Lainnya' },
  { code: '1181', name: 'Asuransi Dibayar Dimuka' },
  { code: '1182', name: 'Biaya Dibayar Dimuka' },
  { code: '1183', name: 'Emas Titipan Customer (Jasa Refining)' },
  { code: '1184', name: 'Transit Landed Cost Impor Emas', isTan: true },

  { code: '1200', name: 'ASET TETAP' },

  { code: '1210', name: 'Harga Perolehan Aset Tetap' },
  { code: '1211', name: 'Tanah' },
  { code: '1212', name: 'Bangunan' },
  { code: '1213', name: 'Kendaraan' },
  { code: '1214', name: 'Mesin' },
  { code: '1215', name: 'Peralatan Kantor' },
  { code: '1216', name: 'Furniture Kantor' },

  { code: '1220', name: 'Akumulasi Penyusutan Aset Tetap' },
  { code: '1221', name: 'Akumulasi Penyusutan Bangunan' },
  { code: '1222', name: 'Akumulasi Penyusutan Kendaraan' },
  { code: '1223', name: 'Akumulasi Penyusutan Mesin' },
  { code: '1224', name: 'Akumulasi Penyusutan Peralatan Kantor' },
  { code: '1225', name: 'Akumulasi Penyusutan Furniture Kantor' },

  { code: '1230', name: 'Harga Perolehan Peralatan Produksi' },
  { code: '1231', name: 'Furnace & Melting Equipment' },
  { code: '1232', name: 'Assay Equipment' },
  { code: '1233', name: 'Refining Equipment' },
  { code: '1234', name: 'Casting Equipment' },
  { code: '1235', name: 'Testing & Lab Equipment' },
  { code: '1236', name: 'Support Equipment' },
  { code: '1237', name: 'Safety & Ventilation Equipment' },
  { code: '1238', name: 'Waste Treatment Equipment' },

  { code: '1240', name: 'Akumulasi Penyusutan Peralatan Produksi' },
  { code: '1241', name: 'Akumulasi Penyusutan Furnace & Melting Equipment' },
  { code: '1242', name: 'Akumulasi Penyusutan Assay Equipment' },
  { code: '1243', name: 'Akumulasi Penyusutan Refining Equipment' },
  { code: '1244', name: 'Akumulasi Penyusutan Casting Equipment' },
  { code: '1245', name: 'Akumulasi Penyusutan Testing & Lab Equipment' },
  { code: '1246', name: 'Akumulasi Penyusutan Support Equipment' },
  { code: '1247', name: 'Akumulasi Penyusutan Safety & Ventilation Equipment' },
  { code: '1248', name: 'Akumulasi Penyusutan Waste Treatment Equipment' },

  { code: '1250', name: 'Uang Muka Pembelian Aset Tetap' },
  { code: '1251', name: 'Uang Muka Pembelian Tanah' },
  { code: '1252', name: 'Uang Muka Pembelian Bangunan' },
  { code: '1253', name: 'Uang Muka Pembelian Kendaraan' },
  { code: '1254', name: 'Uang Muka Pembelian Mesin' },
  { code: '1255', name: 'Uang Muka Pembelian Inventaris & Peralatan Kantor' },

  { code: '1300', name: 'ASET LAIN-LAIN' },

  { code: '1310', name: 'Aset Tidak Berwujud' },
  { code: '1311', name: 'Biaya Pra Operasi' },
  { code: '1312', name: 'Goodwill' },
  { code: '1313', name: 'Software' },

  { code: '1320', name: 'Uang Muka Aset Tidak Berwujud' },
  { code: '1321', name: 'Uang Muka Software' },

  { code: '1330', name: 'Investasi' },

  // ── 2 KEWAJIBAN ───────────────────────────────────────────────────────────
  { code: '2000', name: 'KEWAJIBAN' },

  { code: '2100', name: 'KEWAJIBAN JANGKA PENDEK' },

  { code: '2110', name: 'Hutang Usaha' },
  { code: '2111', name: 'Hutang Usaha Dagang' },
  { code: '2112', name: 'Hutang Retensi' },

  { code: '2120', name: 'Hutang Bank Jangka Pendek' },

  { code: '2130', name: 'Hutang Pajak' },
  { code: '2131', name: 'Hutang PPN' },
  { code: '2132', name: 'Hutang PPh Pasal 21' },
  { code: '2133', name: 'Hutang PPh Pasal 22' },
  { code: '2134', name: 'Hutang PPh Pasal 23' },
  { code: '2135', name: 'Hutang PPh Pasal 4 Ayat 2' },
  { code: '2136', name: 'Hutang PPh Badan' },

  { code: '2140', name: 'Biaya Yang Masih Harus Dibayar' },
  { code: '2141', name: 'Biaya Gaji Yang Masih Harus Dibayar' },
  { code: '2142', name: 'Biaya Listrik & Utilitas Yang Masih Harus Dibayar' },
  { code: '2143', name: 'Biaya Assay & Testing Yang Masih Harus Dibayar' },

  { code: '2150', name: 'Titipan & Uang Muka Pelanggan' },
  { code: '2151', name: 'Uang Muka Penjualan' },
  { code: '2152', name: 'Uang Titipan Customer' },
  { code: '2153', name: 'Emas Titipan Customer (Kewajiban)' },
  { code: '2154', name: 'Saldo Deposit Nasabah (User Wallet)' },
  { code: '2155', name: 'Hutang Emas Digital Nasabah' },

  { code: '2160', name: 'Hutang Lain-lain' },

  { code: '2200', name: 'KEWAJIBAN JANGKA PANJANG' },
  { code: '2210', name: 'Hutang Bank Jangka Panjang' },
  { code: '2220', name: 'Hutang Obligasi' },

  // ── 3 EKUITAS ─────────────────────────────────────────────────────────────
  { code: '3000', name: 'EKUITAS' },

  { code: '3100', name: 'MODAL' },
  { code: '3110', name: 'Modal Disetor' },
  { code: '3120', name: 'Prive' },

  { code: '3200', name: 'LABA DITAHAN' },
  { code: '3210', name: 'Saldo Laba Ditahan' },
  { code: '3220', name: 'Laba Tahun Berjalan' },
  { code: '3230', name: 'Deviden' },
  { code: '3231', name: 'Deviden Tunai' },

  // ── 4 PENDAPATAN ──────────────────────────────────────────────────────────
  { code: '4000', name: 'PENDAPATAN' },

  { code: '4100', name: 'PENDAPATAN USAHA' },

  { code: '4110', name: 'Penjualan Produk' },
  { code: '4111', name: 'Penjualan Gold Bar' },
  { code: '4112', name: 'Penjualan Gold Grain' },
  { code: '4113', name: 'Penjualan Gold Sheet/Wire' },
  { code: '4114', name: 'Penjualan By-products' },
  { code: '4115', name: 'Penjualan Emas Digital' },
  { code: '4116', name: 'Penjualan Ekspor Perhiasan Emas', isTan: true },

  { code: '4120', name: 'Pendapatan Jasa' },
  { code: '4121', name: 'Pendapatan Jasa Refining' },
  { code: '4122', name: 'Pendapatan Jasa Assay/Testing' },

  { code: '4130', name: 'Pendapatan Emas Digital' },
  { code: '4131', name: 'Pendapatan Spread Jual Beli' },
  { code: '4132', name: 'Pendapatan Biaya Cetak Fisik & Minting' },
  { code: '4133', name: 'Pendapatan Biaya Penarikan Dana' },

  { code: '4200', name: 'POTONGAN & RETUR PENJUALAN' },
  { code: '4210', name: 'Retur Penjualan' },
  { code: '4220', name: 'Potongan Penjualan' },

  // ── 5 HPP & BEBAN ─────────────────────────────────────────────────────────
  { code: '5000', name: 'HPP & BEBAN' },

  { code: '5100', name: 'HARGA POKOK PENJUALAN' },

  { code: '5110', name: 'Biaya Bahan Baku Langsung' },
  { code: '5111', name: 'Biaya Bahan Baku Emas' },
  { code: '5112', name: 'Biaya Chemicals & Flux' },
  { code: '5113', name: 'Biaya Consumables' },

  { code: '5120', name: 'Biaya Tenaga Kerja Langsung' },
  { code: '5121', name: 'Gaji Operator Produksi' },
  { code: '5122', name: 'Gaji Technician' },

  { code: '5130', name: 'Overhead Pabrik' },
  { code: '5131', name: 'Biaya Produksi' },
  { code: '5132', name: 'Biaya Gas & Fuel' },
  { code: '5133', name: 'Biaya Maintenance Equipment' },
  { code: '5134', name: 'Biaya Assay & Lab Testing' },
  { code: '5135', name: 'Biaya Safety & PPE' },
  { code: '5136', name: 'Penyusutan Peralatan Produksi' },

  { code: '5140', name: 'Susut & Penyesuaian Produksi' },
  { code: '5141', name: 'Susut Produksi Normal' },
  { code: '5142', name: 'Susut Produksi Abnormal' },
  { code: '5143', name: 'Rugi Revaluasi Harga Emas' },
  { code: '5144', name: 'Selisih Timbang' },

  { code: '5150', name: 'HPP Penjualan Ekspor', isTan: true },
  { code: '5151', name: 'HPP Penjualan Ekspor LM Lokal', isTan: true },
  { code: '5152', name: 'HPP Penjualan Ekspor LM Import', isTan: true },
  { code: '5153', name: 'HPP Penjualan Ekspor Perhiasan Emas', isTan: true },
  { code: '5154', name: 'Biaya Freight, Insurance & Handling Ekspor', isTan: true },

  { code: '5200', name: 'BEBAN OPERASIONAL' },

  { code: '5210', name: 'Beban Pemasaran' },
  { code: '5211', name: 'Beban Gaji Sales & Marketing' },
  { code: '5212', name: 'Biaya Iklan' },
  { code: '5213', name: 'Biaya Promosi' },
  { code: '5214', name: 'Biaya Marketing Tools' },

  { code: '5220', name: 'Beban Fasilitas & Lingkungan Produksi' },
  { code: '5221', name: 'Beban Pendukung Produksi' },
  { code: '5222', name: 'Beban Pemeliharaan' },
  { code: '5223', name: 'Beban Lab & QC' },
  { code: '5224', name: 'Biaya Sertifikasi & Compliance' },
  { code: '5225', name: 'Biaya Waste Management' },
  { code: '5226', name: 'Biaya Environmental Compliance' },

  { code: '5230', name: 'Beban Distribusi' },
  { code: '5231', name: 'Beban Transport & Delivery' },

  { code: '5240', name: 'Beban Emas Digital' },
  { code: '5241', name: 'Beban Processing Fee Payment Gateway' },
  { code: '5242', name: 'Beban Asuransi & Vault Storage Emas' },
  { code: '5243', name: 'Beban Registrasi ICDX' },
  { code: '5244', name: 'Beban Registrasi ICH' },
  { code: '5245', name: 'Beban Transaksi Emas Digital' },
  { code: '5246', name: 'Beban Emas Digital Lainnya' },

  { code: '5250', name: 'Beban Operasional Lain-lain' },

  { code: '5300', name: 'BEBAN UMUM & ADMINISTRASI' },

  { code: '5310', name: 'Beban Gaji & Kesejahteraan' },
  { code: '5311', name: 'Biaya Gaji Karyawan' },
  { code: '5312', name: 'Beban Gaji Administrasi' },
  { code: '5313', name: 'THR dan Bonus' },
  { code: '5314', name: 'Tunjangan Transport' },
  { code: '5315', name: 'BPJS' },
  { code: '5316', name: 'Uang Makan' },
  { code: '5317', name: 'Biaya Kesehatan Karyawan' },
  { code: '5318', name: 'Kesejahteraan Pegawai Lainnya' },

  { code: '5320', name: 'Beban Transportasi & Perjalanan Dinas' },
  { code: '5321', name: 'Bahan Bakar & Listrik Kendaraan' },
  { code: '5322', name: 'Taksi & Transportasi Umum' },
  { code: '5323', name: 'Hotel & Penginapan' },
  { code: '5324', name: 'Perjalanan Dinas Lainnya' },

  { code: '5330', name: 'Beban Utilitas' },
  { code: '5331', name: 'Beban Listrik' },
  { code: '5332', name: 'Beban Air (PDAM)' },
  { code: '5333', name: 'Beban Telepon' },
  { code: '5334', name: 'Beban Internet' },
  { code: '5335', name: 'Beban Hosting Website & Aplikasi' },

  { code: '5340', name: 'Beban Sewa' },
  { code: '5341', name: 'Sewa Kantor' },
  { code: '5342', name: 'Sewa Lainnya' },

  { code: '5350', name: 'Beban Perlengkapan Kantor' },
  { code: '5351', name: 'Alat Tulis & Stationery' },
  { code: '5352', name: 'Cetakan' },
  { code: '5353', name: 'Biaya Pos, Meterai & Kurir' },

  { code: '5360', name: 'Beban Jasa Profesional' },
  { code: '5361', name: 'Biaya Notaris & Konsultan Hukum' },
  { code: '5362', name: 'Biaya Akuntan' },
  { code: '5363', name: 'Jasa Profesional Lainnya' },

  { code: '5370', name: 'Beban Penyusutan & Amortisasi' },
  { code: '5371', name: 'Beban Penyusutan Non-Produksi' },
  { code: '5372', name: 'Amortisasi Biaya Pra Operasi' },
  { code: '5373', name: 'Amortisasi Aset Tak Berwujud Lainnya' },

  { code: '5380', name: 'Beban Umum Lainnya' },

  // ── 6 DI LUAR USAHA ───────────────────────────────────────────────────────
  { code: '6000', name: 'DI LUAR USAHA' },

  { code: '6100', name: 'PENDAPATAN DI LUAR USAHA' },
  { code: '6110', name: 'Pendapatan Bunga' },
  { code: '6120', name: 'Pendapatan Selisih Kurs Emas' },
  { code: '6130', name: 'Laba Revaluasi Harga Emas' },
  { code: '6140', name: 'Laba Selisih Kurs Valas', isTan: true },

  { code: '6200', name: 'BEBAN DI LUAR USAHA' },
  { code: '6210', name: 'Beban Bunga' },
  { code: '6220', name: 'Beban Administrasi Bank' },
  { code: '6230', name: 'Rugi Selisih Kurs Valas', isTan: true },
  { code: '6240', name: 'Beban Pajak Penghasilan' },
] as const satisfies readonly { code: string; name: string; isTan?: boolean }[];

export type SeededAccountCode = (typeof ACCOUNT_SKELETON)[number]['code'];
