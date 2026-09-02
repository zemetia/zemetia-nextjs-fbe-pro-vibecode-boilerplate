# LEARN — Log Koreksi & Kesalahan

← [Blueprint INDEX](../blueprint/INDEX.md) · Aturan penulisan: [KNOWLEDGE.md](../blueprint/KNOWLEDGE.md)

Format satu baris per entri:

```
[YYYY-MM-DD] - [apa yang salah] - [pendekatan yang benar] - [pelajaran]
```

Tulis di sini **segera** setelah user mengoreksi, atau setelah menyadari sendiri menyimpang. Prioritaskan pelajarannya — bagian yang mencegah pengulangan.

---

## Entri

**Kejujuran UI** [2026-08-15] Tombol tanpa handler, label "Auto-Jurnal" yang tidak menjurnal, `alert()` sukses palsu, laporan keuangan hardcode - Setiap tombol/label/pesan hanya boleh menjanjikan yang benar-benar dijalankan kode; sambungkan ke modul asli atau tampilkan empty state jujur - UI yang tampak jadi tapi mati/bohong lebih berbahaya daripada yang jelas belum ada.

**Reuse sebelum menulis ulang** [2026-08-15] Nomor dokumen dari `Date.now()`, rumus landed cost ditulis ulang padahal sudah ada di `modules/purchaseOrder.js` - Cari dulu di modul/storage yang ada sebelum menulis logic sendiri - Dua sumber kebenaran untuk satu rumus/counter pasti menyimpang diam-diam.

**Akurasi GL/jurnal** [2026-08-28] Saldo GL salah urut (`unshift`) & salah normalisasi sisi akun; baris jurnal menembak akun `type: header`; `accountName` diambil dari jurnal sendiri bukan COA; 2 akun dipakai tanpa ada di COA (`2115`, `2116-1`); `recalculateCounters()` salah baca field/index - Urutkan eksplisit sebelum akumulasi, normalisasi per sisi normal akun, posting hanya ke akun `detail`, nama akun di laporan selalu dari COA, cari padanan COA dulu sebelum tambah akun baru - Fungsi/laporan yang "terlihat benar" bisa menyembunyikan kesalahan diam-diam; self-healing yang salah baca lebih berbahaya daripada tidak ada.

**COA berubah, verifikasi ke sumber** [2026-08-15, 2026-08-26, 2026-09-01] Kode akun dipakai tanpa dicek ke COA (`2110` vs `2111` berbalik makna antara COA legacy dan Prisma), pembayaran impor default ke akun/bank hutang lokal - Verifikasi kode akun & sisi jurnal langsung ke `LedgerAccount`/`prisma/seeders/data/accounts.ts` (bukan ke `ACCOUNTING.md` atau catatan lama), cocokkan kategori pengadaan (lokal/impor/valas) dengan flow bisnis - COA legacy dan COA Prisma **berbeda** dan hidup berdampingan selama migrasi; catatan pelajaran tentang kode akun punya masa berlaku.

**Fallback diam lebih berbahaya dari crash** [2026-08-18, 2026-08-19] Nilai awal state tidak cocok `value` dropdown, class CSS (`spin`, `badge-*`) dipakai tanpa didefinisikan (5×), token Tailwind `--color-base` bentrok skala `text-base` - Verifikasi setiap nama class/value/token benar ada sebelum dipakai - Fallback diam tidak error/warning, baru ketahuan saat dibandingkan ke sumbernya.

**Jawab pertanyaan bisnis dari proses, bukan dari kode** [2026-08-18] "Apakah field X perlu ada" dijawab membenarkan kode yang sudah ada, ternyata terbalik (keputusan Treasury bukan Purchasing) - Jawab dari proses bisnis (siapa ambil keputusan, kapan) sebelum baca kode - "Sudah diimplementasikan" ≠ "seharusnya begini". Lihat [[feedback_business_questions_before_code]].

**Payload harus sesuai schema parser** [2026-08-18] Total USD $0.00 karena payload kirim `unitPriceUSD` tanpa `unitPrice`, `parseFloat` → `NaN` - Field eksplisit sesuai schema + fallback kuat - Kegagalan hitung tidak boleh jatuh diam ke nol di UI.

**Disiplin palet warna** [2026-08-24] Warna UI tersebar liar - Batasi ke 5 warna fungsional: Gold, Emerald, Sky/Blue, Orange, Rose - ERP enterprise butuh warna yang tetap bermakna semantik.

**Migrasi legacy = pindah logika, bukan kosmetik** [2026-08-28, 2026-09-01] Tag `(legacy)` ditambahkan ke menu alih-alih memindahkan modul; komponen view penjualan ditulis ulang total padahal user minta UI legacy dipertahankan plek-ketiplek - Pindahkan fungsionalitas/alur bisnis utuh; UI legacy (`src/views/*.jsx`) tetap, hanya lapisan data (`storageService`→service API) yang ganti - UI legacy adalah aset yang disengaja; migrasi database tidak boleh mengubah satu piksel pun.

**`page.tsx` literal wajib dicek, bukan cuma `_components/`** [2026-09-01] 2× hari yang sama (Purchase Request, lalu Partners/Supplier): `page.tsx` listing utama masih import view legacy localStorage padahal komponen DB-backed lengkap sudah ada di `_components/` tapi tidak pernah dirender - Buka `page.tsx` literal folder rute DULU sebelum menilai status migrasi; "sudah pakai database" hanya valid bila `page.tsx` benar-benar merender komponen itu - Komponen baru yang lengkap & teruji tidak membuktikan apa-apa kalau tidak ada yang me-render-nya; `lint`/`type-check`/`build` tetap hijau karena dua komponen sama-sama valid React.

**Pagination/limit harus dicek ke skema validasi** [2026-08-28] Picker lot kosong tanpa pesan — `limit: 200` > batas Zod (maks 100), request 400 ditelan diam `<Combobox />`; label "sisa X g" pakai angka global padahal per-lokasi jauh lebih kecil - Cek batas Zod endpoint dulu; jangan anggap picker kosong = data tidak ada; verifikasi scope angka (global vs lokal) sebelum memilih kata label - Lint/type-check/build/test hijau saat bug ada — cuma ketahuan lewat browser + database sungguhan.

**Komponen terkendali harus bedakan gema sendiri** [2026-09-01] `CertificatesInput` memetakan ulang berat tiap ketik koma karena `onChange` trigger ulang dan nilai balik via prop `value` memicu lagi - Aksi bertombol ("Hitung Ulang") tidak boleh terpicu diam oleh pengetikan; pakai ref (`lastEmittedRef`) untuk membedakan echo dari data baru.

**Rename schema wajib sapuan konsumen** [2026-09-01] Rename model Prisma tanpa update lib/API/permission/DTO — 82 error type-check - Sapuan `grep -rn "namaLama" src/` di sesi yang sama; katalog permission = sumber kebenaran - Error TS2724 "Did you mean X" adalah peta arah perbaikan.

**Perubahan skema Prisma wajib sinkron ke DB saat itu juga** [2026-09-01] Jurnal Umum crash "Objects are not valid as a React child" — kolom FK baru belum di-DDL ke PostgreSQL + fallback cache berisi `{}` truthy lolos ke JSX - Tambahkan kolom via DDL saat itu juga, sanitasi DTO (`safeString`), bungkus render teks (`renderSafeText()`) - Jangan asumsikan field API selalu string murni.

**Session mock adalah bom waktu** [2026-09-01] `getSession()`/`requireAuth()` balikin `DEV_MOCK_SESSION` sisa transisi migrasi — login manual mustahil, auth-guard bikin redirect loop - Hapus mock total, `requireAuth()` lempar `UnauthorizedError` tanpa sesi - Mock yang hidup di server tapi tidak di client bikin fitur `useSession()` diam-diam mati.

**Schema relasional pakai FK, bukan nomor string** [2026-09-01] `sales.prisma` awal sambung rantai dokumen lewat nomor string + model kembar lokal/ekspor, padahal diminta FK tanpa duplikasi - Satu model per lapisan dokumen, enum `type`, rantai via FK; verifikasi dengan `prisma validate`+`db push`+type-check di sesi yang sama - Rantai bersambung string tidak bisa dijoin relasional.

**Radix `<Select>` tidak kompatibel native `<select>`** [2026-09-01] Form legacy pakai `<Select><option></Select>`, Radix merender opsi sebagai teks biasa, tidak bisa dipilih - Mode hibrida: deteksi opsi native, render `<NativeSelect />` - Penggantian primitive lintas halaman legacy wajib kompatibel interface native HTML.

**Verifikasi fitur end-to-end lewat browser, bukan cuma lint/build** [2026-09-01] TTB (`GoodsReceiptView.tsx`) di-hardcode `type: 'LOCAL'` di query PO Referensi — PO Impor yang sudah `CONFIRMED` tak pernah muncul di combobox, padahal skema/API/validasi sudah siap keduanya sejak awal. Saat login sebagai role `VAULT_OFFICER` (pembuat TTB sesungguhnya) untuk verifikasi manual, kombobox kosong total meski ada PO `CONFIRMED` — ternyata role itu tidak punya `local-purchases:list`/`:detail`, jadi `GET /api/metal-purchases` selalu 403 untuknya. Bug ini pre-existing, tidak muncul di `tsc`/`eslint`/`vitest` karena tak ada test yang login sebagai role tersebut - Setelah ubah UI yang bergantung pada RBAC, login sebagai role pemakai asli (bukan Super Admin) dan jalankan alurnya sungguhan di browser sebelum lapor selesai - Lint/build/unit test hijau bukan bukti fitur benar-benar bisa dipakai oleh role yang dituju; kesenjangan permission tidak terlihat di jalur verifikasi otomatis manapun.

**Perbaikan "`page.tsx` masih legacy" bukan alasan ganti UI** [2026-09-01] Setelah menemukan `purchases/requests/page.tsx` masih render view legacy, "diperbaiki" dengan mengganti ke `PurchaseRequestsView.tsx` (TSX/card/Radix) — padahal pelajaran ini SUDAH tercatat di baris [[Migrasi legacy = pindah logika, bukan kosmetik]] pada hari yang sama; user marah keras ("kenapa tampilannya berubah? gak bisa dibuat pakai database tapi UI identik legacy?") - Saat menyambung `page.tsx` yang masih legacy ke database: tetap `dynamic(() => import('@/views/NamaView'))`, HANYA ganti importnya dari `storageService`→`purchaseDb.js`. Proses ini juga membongkar bug tersembunyi: `purchaseDb.createPurchaseRequest` selalu gagal (kirim `weight_unit` yang tidak ada di skema Zod, bukan `unit_id` wajib) karena tidak pernah benar-benar dipanggil UI manapun — verifikasi ke DB (`prisma.purchaseRequest.count()`) membuktikan tabelnya 0 baris meski fungsinya "ada" - **Menemukan sebuah pelajaran ter-log tidak berarti otomatis diterapkan pada permintaan berikutnya di sesi yang sama** — grep LEARN.md untuk kasus serupa sebelum memilih pendekatan, jangan cuma andalkan ingatan sesi. Kode yang "ada di repo tapi tidak pernah dipanggil siapa pun" tidak terverifikasi apa pun oleh `tsc`/`eslint` — baru terbukti benar/salah begitu benar-benar disambungkan ke pemanggil nyata.
