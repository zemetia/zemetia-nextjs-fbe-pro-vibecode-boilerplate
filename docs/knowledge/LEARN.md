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
