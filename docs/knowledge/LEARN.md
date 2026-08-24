# LEARN — Log Koreksi & Kesalahan

← [Blueprint INDEX](../blueprint/INDEX.md) · Aturan penulisan: [KNOWLEDGE.md](../blueprint/KNOWLEDGE.md)

Format satu baris per entri:

```
[YYYY-MM-DD] - [apa yang salah] - [pendekatan yang benar] - [pelajaran]
```

Tulis di sini **segera** setelah user mengoreksi, atau setelah menyadari sendiri menyimpang. Prioritaskan pelajarannya — bagian yang mencegah pengulangan.

---

## Entri

[2026-08-15] - Tombol transaksi dirender tanpa `onClick` sama sekali di `BuyingScrapMelting`, `JewelryProduction`, dan `ExportInvoicing`, sehingga klik tidak melakukan apa pun - Setiap tombol harus punya handler sebelum halaman dianggap selesai; bila fiturnya belum siap, tombolnya jangan ada - UI yang tampak jadi tapi mati lebih berbahaya daripada UI yang jelas belum ada, karena user mengira datanya tersimpan.

[2026-08-15] - Tombol di `VoucherManagement` berlabel "Terbitkan Voucher & Auto-Jurnal" padahal handler-nya hanya menyimpan voucher tanpa menulis `JOURNAL_ENTRIES` - Label harus menjanjikan persis yang dijalankan kode; jurnal ditulis di handler yang sama dengan penyimpanan transaksinya - Label yang berbohong menciptakan selisih kas yang baru ketahuan berbulan-bulan kemudian saat rekonsiliasi.

[2026-08-15] - `alert()` di `LmLocalTrading` mengklaim "Stok Vault Ter-update" padahal tidak ada satu baris pun yang menulis kartu stok - Pesan sukses hanya menyebutkan yang benar-benar terjadi - Pesan sukses adalah janji ke user; menjanjikan efek yang tidak ada sama saja dengan kehilangan data secara diam-diam.

[2026-08-15] - Laba Rugi, Neraca, dan Arus Kas di `AccountingReports` di-hardcode di JSX padahal `incomeStatement.js`, `balanceSheet.js`, dan `cashFlow.js` sudah dimuat `main.jsx` - Sambungkan ke modul yang sudah ada; bila belum siap, tampilkan keadaan kosong yang jujur - Angka palsu di laporan keuangan tidak bisa dibedakan dari angka asli oleh pembacanya.

[2026-08-15] - Nomor PO, TTB, jurnal, dan voucher dibuat dari `Date.now().toString().slice(-6)` - Pakai `Storage.getNextReferenceNumber(type)` yang sudah punya sequencer atomik Firestore dan fallback lokal - Sebelum menulis penomoran/perhitungan sendiri, cari dulu di `modules/` dan `data/storage.js`; kemungkinan besar sudah ada dan sudah punya test.

[2026-08-15] - Saldo berjalan Buku Besar diakumulasi atas `journals` apa adanya, padahal jurnal disimpan dengan `unshift` (terbaru di depan) - Urutkan naik menurut tanggal sebelum mengakumulasi - Urutan penyimpanan tidak sama dengan urutan perhitungan; setiap agregasi kronologis harus mengurutkan eksplisit.

[2026-08-15] - Saldo GL dihitung `debit - credit` untuk semua akun, membuat kewajiban, ekuitas, dan pendapatan tampil negatif - Normalisasi menurut sisi normal akun (kelompok `2` dan `3` bersaldo kredit) - Rumus akuntansi tidak seragam lintas kelompok akun; periksa kategorinya sebelum menghitung.

[2026-08-15] - Kode akun dipakai tanpa diverifikasi ada di COA: `2110` tidak terdaftar (yang ada `2111`), `1111` adalah header, `4110` di COA berarti Direct Labour bukan pendapatan ekspor - Cek `getDefaultChartOfAccounts()` sebelum menulis `accountCode` apa pun, dan pastikan `type` akunnya `detail` - Kode akun yang "masuk akal" belum tentu ada; jurnal ke akun karangan tidak akan pernah muncul di laporan mana pun.

[2026-08-15] - Rumus landed cost impor ditulis ulang di `LmImportTrading.jsx` padahal rumus yang sama sudah ada di `modules/purchaseOrder.js` - Pakai ulang dari modul, atau satukan ke satu tempat - Dua sumber kebenaran untuk satu rumus pasti menyimpang; yang menyimpang diam-diam adalah HPP.

[2026-08-18] - `formData.supplierName` di `LmLocalTrading` diinisialisasi `'PT Pegadaian (Persero)'` sementara opsi dropdown-nya `'PT Pegadaian (Persero) Jakarta'`, sehingga `<select>` menampilkan opsi pertama tapi state menyimpan nilai lain — nota pembelian tersimpan dengan nama supplier yang berbeda dari yang terbaca di layar selama user tidak menyentuh dropdown - Nilai awal state wajib sama persis dengan salah satu `value` opsi; ketidakcocokan baru ketahuan saat `<select>` diganti `Combobox` yang jujur menampilkan `-- Pilih --` - `<select>` menampilkan opsi pertama untuk `value` yang tidak dikenal tanpa peringatan apa pun; ini varian ketiga dari pelajaran yang sama dengan `justify` dan `variant: 'danger'` — **fallback yang diam lebih berbahaya daripada crash**.

[2026-08-18] - Class `spin` dipakai di `Navbar.jsx` dan `LmImportTrading.jsx` untuk memutar ikon refresh, tapi tidak pernah ada `.spin` maupun `@keyframes spin` di `index.css` — ikonnya diam sejak awal - Verifikasi setiap nama class benar-benar menghasilkan CSS, bukan hanya bahwa nama itu terlihat masuk akal - Class yang tidak terdefinisi tidak error, tidak memberi peringatan, dan tidak berefek; ini varian keempat dari pelajaran yang sama dengan `justify`, `variant: 'danger'`, dan nilai awal `<select>` — **fallback yang diam lebih berbahaya daripada crash**.

[2026-08-18] - `badge-rose` (cek VOID di `MasterChequePage`, prioritas Urgent di `PurchaseRequestPage`) dan `badge-blue` (3 halaman) dipakai bertahun tanpa pernah didefinisikan; keenam badge itu tampil polos tanpa warna, jadi "VOID" dan "Urgent" tidak terbaca sebagai peringatan - Sebelum memakai varian class, cek daftar varian yang benar-benar ada di CSS — sama seperti mengecek kode akun ada di COA sebelum menjurnal - Nama varian yang salah dan kode akun yang salah gagal dengan cara yang sama: diam, masuk akal dilihat sekilas, dan baru ketahuan saat ada yang membandingkan dengan sumbernya.

[2026-08-18] - Token `--color-base: #0b0f19` di `@theme` melahirkan utility warna `text-base` yang bentrok dengan font-size bawaan Tailwind v4 dan memenangkannya, sehingga kelima pemakaian `text-base` (judul "PT TAN ERP" di Sidebar, `h4` di `@layer base`, 2 di `LmImportTrading`, 1 di `WarehouseManagement`) berubah jadi teks hitam #0b0f19 di atas latar gelap — bukan diperbesar - Token dinamai `--color-canvas`; nama token warna tidak boleh menabrak skala bawaan Tailwind (`xs`/`sm`/`base`/`lg`/`xl`/`2xl`…) karena namespace `--color-*` dan `--text-*` berbagi awalan utility yang sama - Di Tailwind v4 setiap token `@theme` adalah generator utility, bukan sekadar variabel; sebelum menamai token, cek apakah namanya sudah dipakai skala lain — tabrakannya tidak error, hanya menghasilkan properti yang salah diam-diam.

[2026-08-18] - Ditanya "apakah dropdown rekening bank pembayaran perlu ada di form PO Impor `LmImportTrading`", dijawab dengan membenarkan field yang sudah ada di kode ("ya perlu, sudah dipakai untuk menentukan sisi kredit jurnal") — baru di pertanyaan ketiga user ("apakah purchasing perlu tahu bank mana yang membayar?") ketahuan jawaban sebenarnya terbalik: pemilihan rekening bank itu keputusan Treasury/Finance saat pembayaran benar-benar terjadi (likuiditas rekening USD/SGD bisa beda dari saat PO dibuat), bukan keputusan Purchasing saat membuat PO — dan pola yang benar sudah berjalan di `VoucherManagement.jsx` (BBK Voucher, `form.bankAccountCode`) - Pertanyaan "apakah X perlu ada" dijawab dari proses bisnis (siapa mengambil keputusan ini, kapan) sebelum membaca kode sama sekali; membaca kode adalah verifikasi setelah kesimpulan bisnis jelas, bukan sumber kesimpulannya - "Sudah diimplementasikan di kode" dan "seharusnya begini secara desain" adalah dua klaim berbeda; yang pertama tidak membuktikan yang kedua, dan menjawab pertanyaan non-teknis dengan mendeskripsikan kode yang ada membuat user harus bertanya ulang untuk sampai ke jawaban sebenarnya.

[2026-08-19] - `badge-sky` dan `badge-purple` dipakai di `WarehouseManagement.jsx` (kolom Jenis Dokumen kartu stok, sejak mutasi vault dinamis diaktifkan) tapi tidak pernah didefinisikan di `index.css` — dua dari empat warna kartu mutasi (EKSPOR, kategori lain) tampil sebagai badge polos tanpa warna - Ditambahkan ke `@layer components` mengikuti pola `badge-rose`/`badge-blue` yang sudah ada, memakai token `--color-sky`/`--color-purple` yang sudah ada di `@theme` - Ini kejadian kelima dari pola yang sama (`justify`, `variant: 'danger'`, nilai awal `<select>`, `spin`, `badge-rose`/`badge-blue`): repo tanpa TypeScript/ESLint tidak pernah memperingatkan nama class yang tidak terdefinisi, jadi setiap `badge-*` baru di JSX wajib dicek ada padanannya di `index.css` sebelum dipakai.

[2026-08-18] - Total USD di tabel Riwayat PO LM Import tampil $ 0.00 karena payload items hanya mengirim `unitPriceUSD` tanpa properti `unitPrice`, sehingga `parseFloat(item.unitPrice)` di `purchaseOrder.js` menghasilkan `NaN` dan `totalAmountUSD` tidak tersimpan ke objek PO - Sediakan `unitPrice` eksplisit pada payload items dan buat fallback kuat di modul `purchaseOrder.js` (`unitPrice ?? unitPriceUSD`) serta getter tampilan tabel - Payload antar-komponen harus sesuai dengan schema parser modul; kegagalan perhitungan yang jatuh ke nilai default nol di UI harus dicegah dari layer penyimpanan hingga rendering.

[2026-08-24] - Penggunaan warna di UI tersebar liar (purple/violet di berbagai halaman dan badge) sehingga tampilan tampak seperti pelangi dan inkonsisten - Batasi penggunaan warna hanya pada 5 warna fungsional resmi: Emas (Gold), Hijau (Emerald), Biru (Sky/Blue), Orange, dan Merah (Danger/Rose) di samping warna gelap netral dasar - Aplikasi enterprise ERP membutuhkan disiplin palet ketat agar setiap warna membawa arti semantik yang konsisten dan tidak membingungkan pengguna operasional.
