# THIS — Identitas Proyek & Gaya Kerja

← [Blueprint INDEX](../blueprint/INDEX.md) · Aturan penulisan: [KNOWLEDGE.md](../blueprint/KNOWLEDGE.md)

---

## Perusahaan

**PT Trifactor Alura Nusantara (PT TAN)** — pedagang dan pengekspor logam mulia serta perhiasan emas. Pembukuan menurut **SAK EMKM**. Ekspor perhiasan dikenai **PPN 0%**.

Rantai bisnisnya: **Pengadaan → Vault → Produksi → Ekspor → Akuntansi**.

## Realita lapangan yang membentuk kode

Ini bukan asumsi desain — ini hasil survei lapangan yang sudah masuk ke kode. Perubahan pada bagian ini harus dikonfirmasi ke user.

| Fakta | Implikasi di kode |
|---|---|
| Pembelian tunai emas di **Pegadaian / Antam Jakarta** diambil kurir internal (mis. "Bpk. Budi") dengan Surat Kuasa | Alur 2 tahap `1159` transit → `1157` vault. Emas di tangan kurir bukan isi brankas |
| Setiap pembelian tunai wajib **TTD Pemilik / Direktur Utama** sebelum uang keluar | Checkbox otorisasi memblokir submit |
| Dokumen serah terima punya **4 kolom tanda tangan**: kurir · penyerah (Pegadaian) · penerima vault · pemilik | Isi ringkasan cetak menyebut keempatnya |
| Emas batangan datang sebagai **beberapa batang dengan nomor sertifikat masing-masing** | Input multi-serial dipisah koma/enter, jumlah batang dideteksi otomatis |
| Impor dari **YLG Bullion Singapore**: harga = base metal kesepakatan + **premium $/oz** yang sudah termasuk kargo **BRINKS** bersenjata | Freight tidak ditambahkan terpisah — sudah di dalam premium |
| Pembayaran impor lewat rekening devisa terpisah: **BCA USD** (LBMA & ekspor) dan **BCA SGD** (bullion Singapura) | Akun `1111-USD`, `1111-SGD`; jangan pakai `1111` polos (itu header) |
| Kurs acuan adalah **BCA e-Rate**, dengan benchmark cadangan Rp 16.250 | `currencyService.js` ambil live, fallback tersimpan, fallback benchmark |
| Bila kurir lupa membawa dokumen fisik, Surat Kuasa dikirim via **WhatsApp PDF** untuk dicetak di lokasi | Tombol "WA PDF" (masih placeholder `alert()`) |

## Gaya developer

- **Bahasa Indonesia** untuk semua yang dilihat user: label, pesan, deskripsi jurnal, judul halaman. Nama variabel dan fungsi tetap Inggris.
- **Nilai awal form diisi contoh nyata** — nama supplier, nomor nota, berat, harga. User memakainya sebagai template.
- **Umpan balik lewat `alert()` multi-baris** berisi ringkasan transaksi dan jurnalnya. User membacanya sebagai bukti; jangan diringkas jadi toast satu baris.
- **Emoji sebagai penanda** di label, badge, dan pesan (📦 🏛️ 💵 ✅ ⚠️). Ini konvensi yang berlaku, bukan kelalaian.
- **Satu halaman = satu file**, sepanjang apa pun. Tidak ada sub-komponen, tidak ada folder per halaman.
- **Iterasi kecil dan sering** di satu halaman. Riwayat git menunjukkan `LmLocalTrading.jsx` disempurnakan lewat 6 commit berturut-turut, masing-masing satu kemampuan lapangan.
- **Domain akuntansi ditulis eksplisit di UI** — nomor akun ditampilkan ke user di label dan badge, bukan disembunyikan.

## Do's

- Verifikasi kode akun ada di COA sebelum memakainya.
- Pakai ulang mesin legacy yang sudah dimuat (`incomeStatement`, `balanceSheet`, `cashFlow`, `pdfExporter`, `journalEntry`) daripada menulis versi kedua.
- Tulis jurnal di handler yang sama dengan penyimpanan transaksinya.
- Jelaskan konsekuensi akuntansi sebuah perubahan sebelum menerapkannya.
- Jalankan `npm run build` dan sebutkan hasilnya.

## Don'ts

- Jangan menambah dependensi (router, form library, state library, UI kit) tanpa diminta.
- Jangan membuat tombol tanpa handler, atau label yang menjanjikan lebih dari yang dilakukan kode.
- Jangan meng-hardcode angka laporan di JSX.
- Jangan menyentuh 102 modul dorman di `modules/` kecuali diminta.
- Jangan membuat file backup longgar (`.bak`, `_new.js`, `.final`).
- Jangan menganggap `README.md` di root sebagai dokumentasi ERP — itu README repo *karpathy-skills* yang ikut ter-merge.

---

## Insights

*Entri baru ditambahkan di bawah dengan awalan tanggal. Yang sudah tidak berlaku ditandai `~~coret~~`, jangan dihapus.*

**[2026-08-15]** Blueprint pertama dibuat, meniru struktur `docs/blueprint/` dari repo `tan-erp`. Basis: branch `tan_pfelix`, commit `e120d08`.

**[2026-08-15]** COA sudah diperbaiki sejak audit `FLOW_ANALYSIS.md` (10 Agustus): duplikat `1160` hilang, akun `1157` / `1158` / `1159` / `1160` / `11502` terdefinisi rapi, rekening bank dipecah `1111-IDR` / `-USD` / `-SGD`. Total 213 akun, tanpa kode ganda.

**[2026-08-15]** Empat rujukan akun di kode masih tidak cocok dengan COA: `2110` (tidak ada — yang ada `2111`), `1111` polos (header), `4110` sebagai pendapatan (di COA itu Direct Labour), dan `4120` bernama pendapatan tapi duduk di kelompok HPP. Merapikannya menyentuh laporan — perlu keputusan user.

**[2026-08-15]** Aplikasi React **tidak memuat** `firebase-config.js`. Praktisnya `window.db` kosong, `CloudStorage` gagal dengan `cloud-unavailable`, dan localStorage adalah satu-satunya sumber kebenaran. Backup manual lewat `SystemSettingsPage` adalah satu-satunya jaring pengaman.

**[2026-08-15]** Rantai persediaan masih putus: tidak ada satu pun halaman React yang menulis ke `WAREHOUSE_STOCK` atau `STOCK_CARDS`. `WarehouseManagement.jsx` memakai array hardcoded. `data/warehouseStock.js` sudah ada tapi belum dimuat.

**[2026-08-15]** Atas permintaan user, struktur `src/` dirapikan **fase 1 — fondasi saja, 18 halaman tidak disentuh**. Hasil: `src/config/pages.js` jadi registry halaman tunggal (pendaftaran 3 tempat → 1 file, `App.jsx` turun dari 83 ke 19 baris), `Sidebar.jsx` + `Navbar.jsx` pindah ke `src/components/layout/`, dan `src/utils/format.js` lahir dengan satu fungsi (`formatIDR`) yang langsung dipakai `Navbar`.

**[2026-08-15]** Keputusan yang perlu dipegang di fase berikutnya: folder `src/components/ui/` **sengaja belum dibuat**. Membuat `PageHeader`/`DataTable`/`FormField` sementara 18 halaman belum memakainya = kode mati, dan itu persis "abstraksi yang tidak diminta" yang dilarang prinsip Simplicity First. Primitif UI dibuat bersamaan dengan halaman pertama yang memakainya, bukan sebelumnya. Berlaku sama untuk `format.js`: tambahkan `formatGram`/`formatUSD` saat ada pemanggil nyata, bukan sekarang.

**[2026-08-15]** Satu `id` halaman boleh muncul di dua grup sidebar (`goods-receipt` di 📦 Pembelian dan 🏛️ Vault, dengan label berbeda). Ini perilaku lama yang disengaja — `PAGE_GROUPS` mendukungnya lewat bentuk `{ id, label }`. Jangan "membetulkannya" jadi satu entri.
