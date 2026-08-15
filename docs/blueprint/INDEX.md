# Blueprint Index

Cross-linked reference untuk AI agent. Setiap path adalah backlink. Baca file ini lebih dulu, lalu lompat ke dokumen spesifik lewat tabel di bawah.

Repo ini **bukan** aplikasi framework-modern. Ini SPA React tanpa router, tanpa TypeScript, tanpa state library, yang duduk di atas mesin data vanilla-JS warisan proyek sebelumnya. Jangan menerapkan pola dari repo lain tanpa membaca [ARCHITECTURE.md](./ARCHITECTURE.md) dulu.

---

## Document Map

| File | Coverage | Use When |
|---|---|---|
| [STRUCTURE.md](./STRUCTURE.md) | Setiap folder & file penting, siapa memuat apa | Mencari di mana sesuatu tinggal |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Boot sequence, routing `useState`, dua lapisan aplikasi | Debug system-level, menambah halaman/integrasi |
| [STORAGE.md](./STORAGE.md) | `window.Storage`, `KEYS`, cloud sync, SyncGuard, sequencer | Setiap baca/tulis data |
| [ACCOUNTING.md](./ACCOUNTING.md) | COA SAK EMKM, alur 2-tahap 1159→1157, aturan jurnal | Setiap transaksi yang menyentuh buku |
| [PAGES.md](./PAGES.md) | Anatomi halaman React, form + tabel riwayat, handler | Membuat atau mengubah halaman |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | CSS variables, `.glass-panel`, `.custom-table`, `.btn-primary` | Menyentuh tampilan |
| [LEGACY.md](./LEGACY.md) | 116 modul vanilla, mana yang hidup, cara menghidupkan yang dorman | Sebelum menulis ulang logika yang mungkin sudah ada |
| [TESTING.md](./TESTING.md) | Jest, Cypress, apa yang benar-benar ter-cover | Sebelum menyatakan tugas selesai |
| [KNOWLEDGE.md](./KNOWLEDGE.md) | Aturan `THIS.md` + `LEARN.md` — sistem belajar | Sebelum setiap tugas; setelah setiap koreksi |
| [../FLOW_ANALYSIS.md](../FLOW_ANALYSIS.md) | Audit alur bisnis end-to-end + daftar temuan | Memahami mata rantai mana yang belum tersambung |

---

## Stack Reference

| Package | Version | Config / Entry |
|---|---|---|
| vite | ^8.2.1 | [vite.config.js](../../vite.config.js) — port 3000, `open: true` |
| react / react-dom | ^19.2.8 | [src/main.jsx](../../src/main.jsx) — `createRoot` + `StrictMode` |
| @vitejs/plugin-react | ^6.0.5 | satu-satunya plugin Vite |
| lucide-react | ^1.30.0 | seluruh ikon UI |
| firebase | ^12.10.0 | [firebase-config.js](../../firebase-config.js) — Firestore + Auth |
| firebase-tools | ^15.26.0 | deploy hosting + firestore |
| jest | ^29.7.0 | config inline di [package.json](../../package.json), env `jsdom` |
| cypress | ^13.6.2 | `npm run test:e2e` — belum ada spec |
| @google/generative-ai | ^0.21.0 | dipakai modul legacy `aiAdvisor.js` (dorman) |

Tidak ada TypeScript, tidak ada ESLint, tidak ada Prettier, tidak ada Tailwind, tidak ada React Router, tidak ada state library. **Jangan menambahkannya tanpa diminta.**

---

## Canonical Import Paths

```js
// Halaman React (src/pages/*.jsx)
import { getCOA, saveCOA, addCOAAccount }        from '../services/storageService';
import { getMasterItems, saveMasterItem }        from '../services/storageService';
import { getFinishedGoods, saveFinishedGood }    from '../services/storageService';
import { getCustomers, saveCustomer }            from '../services/storageService';
import { getSuppliers, saveSupplier }            from '../services/storageService';
import { getPurchaseOrders, createPurchaseOrder} from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate, setCustomUsdRate } from '../services/currencyService';

// Ikon — selalu lucide-react, jangan emoji-only untuk ikon fungsional
import { ShoppingCart, Printer, CheckCircle }    from 'lucide-react';

// Registry halaman & formatter (dipakai App.jsx + src/components/layout/*)
import { PAGES, PAGE_GROUPS, getPage, getPageTitle, getMenuItems } from './config/pages';
import { formatIDR }                             from '../utils/format';

// Mesin data legacy — hanya lewat window, tidak pernah di-import langsung dari halaman
window.Storage            // data/storage.js      → get/set/KEYS/CloudStorage/SyncGuard
window.PurchaseOrder      // modules/purchaseOrder.js
window.JournalEntry       // modules/journalEntry.js
window.db / window.auth / window.firestore   // firebase-config.js
```

---

## Hard Constraints

| # | Rule | Violation |
|---|---|---|
| 1 | Satu-satunya entry point adalah [index.html](../../index.html) → [src/main.jsx](../../src/main.jsx). `app.js` dan `login.html` adalah jalur lama yang mati | Menambah fitur di jalur mati = kode tak pernah dieksekusi |
| 2 | Halaman baru wajib didaftarkan di **satu file**: [src/config/pages.js](../../src/config/pages.js) — entri di `PAGES` (`id`, `title`, `label`, `icon`, `component`), lalu `id`-nya dimasukkan ke `items` salah satu `PAGE_GROUPS`. `App.jsx` dan `Sidebar.jsx` membacanya, tidak perlu disentuh | Halaman tak terdaftar di `PAGES` tidak bisa dibuka; terdaftar tapi tidak masuk `PAGE_GROUPS` = tidak muncul di sidebar |
| 3 | Modul legacy yang dipakai halaman React wajib di-import sebagai side-effect di [src/main.jsx](../../src/main.jsx) | `window.X is undefined` saat runtime, hanya ketahuan setelah klik |
| 4 | Setiap akses `window.Storage` dijaga `typeof window !== 'undefined' && window.Storage` | Jest (jsdom) dan render awal bisa jalan sebelum `Storage.init()` |
| 5 | Fungsi data baru masuk [src/services/storageService.js](../../src/services/storageService.js), bukan `window.Storage` langsung di JSX | Lapisan service sudah bocor di 8 halaman — jangan tambah bocornya |
| 6 | `Storage.set()` itu **async** (menulis ke Firestore). `await` bila hasilnya dipakai | Kondisi balapan: UI reload sebelum cloud selesai, data lama muncul kembali |
| 7 | Kunci storage baru didaftarkan di `Storage.KEYS` ([data/storage.js:170](../../data/storage.js)) | Kunci `pttan_*` ad-hoc tidak ikut export/import backup di `SystemSettingsPage` |
| 8 | Setiap transaksi yang menyentuh uang/emas **wajib** menulis jurnal ke `KEYS.JOURNAL_ENTRIES` di handler yang sama | Tombol berlabel "Auto-Jurnal" yang tidak menjurnal adalah bug terparah di repo ini — sudah terjadi 3×, lihat [ACCOUNTING.md](./ACCOUNTING.md) |
| 9 | Kode akun hanya boleh diambil dari COA. Sebelum memakai kode baru, verifikasi ada di `getDefaultChartOfAccounts()` ([data/storage.js:1658](../../data/storage.js)) | `4110` di COA berarti **Direct Labour**, bukan pendapatan ekspor — memakai kode karangan membuat laporan mustahil direkonsiliasi |
| 10 | Pembelian tunai emas **selalu** 2 tahap: bayar → Debet `1159` (transit kurir); fisik tiba → Debet `1157` (vault), Kredit `1159` | Emas yang masih di tangan kurir tercatat sebagai isi brankas; selisih fisik-buku tidak terdeteksi |
| 11 | Berat emas **selalu disimpan dalam gram**. Satuan input (oz/gram) hanya cara mengetik; konversi `31.1034768` dilakukan sekali, di batas simpan | Satu troy ounce yang bocor ke penyimpanan menggeser HPP 31× tanpa satu karakter pun berubah di layar |
| 12 | Nilai uang disimpan sebagai `Number` mentah, diformat hanya saat tampil (`toLocaleString()`) | Angka berpemisah ribuan yang masuk penyimpanan jadi `NaN` di penjumlahan berikutnya |
| 13 | Jangan pakai `Date.now()` untuk nomor dokumen. Penomoran berurutan sudah ada: `Storage.getNextReferenceNumber()` + `CloudSequencer` | Nomor tidak berurutan, bisa bentrok, dan melanggar kaidah penomoran dokumen akuntansi |
| 14 | Tanggal kalender disimpan `YYYY-MM-DD` (`new Date().toISOString().split('T')[0]`) | `toISOString()` penuh di UTC+7 menggeser dokumen ke hari sebelumnya |
| 15 | Firestore menolak `undefined`. Objek yang disimpan harus bersih atau lewat `CloudStorage.deepStripUndefined()` | Sync gagal diam-diam, masuk antrean SyncGuard, banner merah muncul ke user |
| 16 | Jangan buat file backup longgar (`.bak`, `.final`, `_new.js`). `modules/journalEntry_new.js` adalah contoh yang **tidak** boleh ditiru | Repo sudah punya duplikat yang tak seorang pun tahu mana yang aktif |
| 17 | Jangan sentuh 102 modul dorman di `modules/` kecuali diminta | ~2 MB kode dari proyek Gold Refinery — mengubahnya memecahkan `tests/unit` tanpa memperbaiki apa pun yang hidup |

---

## File Creation Checklists

### Halaman Baru (`src/pages/*.jsx`)

- [ ] File `src/pages/NamaHalaman.jsx` — default export, komponen fungsi
- [ ] Import + entri `PAGES` di [src/config/pages.js](../../src/config/pages.js): `id`, `title` (judul navbar), `label` (label sidebar), `icon` lucide, `component`
- [ ] `id` dimasukkan ke `items` salah satu grup di `PAGE_GROUPS`
- [ ] Data lewat `src/services/storageService.js` — tambah fungsi di sana bila belum ada
- [ ] Struktur: `.glass-panel` form di atas, `.glass-panel` tabel riwayat di bawah — lihat [PAGES.md](./PAGES.md)
- [ ] Setiap tombol punya `onClick`. Tombol tanpa handler dilarang — sudah ada 3 di repo ini
- [ ] Bila halaman menyimpan transaksi: jurnal ditulis di handler yang sama, lihat [ACCOUNTING.md](./ACCOUNTING.md)

### Fungsi Data Baru (`storageService.js`)

- [ ] Guard `typeof window !== 'undefined' && window.Storage`
- [ ] Return nilai default aman (`[]` / `{ success: false, error }`) bila engine belum siap
- [ ] Kunci dari `window.Storage.KEYS.*` — kalau belum ada, tambahkan ke `KEYS` di [data/storage.js](../../data/storage.js)
- [ ] Fungsi tulis `async` dan mengembalikan hasil `await Storage.set(...)`

### Akun COA Baru

- [ ] Tambah ke `getDefaultChartOfAccounts()` di [data/storage.js:1658](../../data/storage.js) — `code`, `name`, `type` (`header`/`detail`), `category`, `balance: 0`
- [ ] Pastikan kode belum dipakai (`1160` pernah dobel — lihat [ACCOUNTING.md](./ACCOUNTING.md))
- [ ] Bila akun bank: tambah juga entri di `BANK_ACCOUNTS` default dengan `glAccount` yang cocok
- [ ] User existing tidak otomatis dapat akun baru — `ChartOfAccounts.jsx` punya tombol sinkronisasi COA resmi

### Modul Legacy yang Dihidupkan

- [ ] Tambahkan `import '../modules/namaModul.js'` di [src/main.jsx](../../src/main.jsx)
- [ ] Cek nama global yang dipasang modul (`window.X`) sebelum memanggilnya
- [ ] Bungkus di `storageService.js` — halaman tidak memanggil `window.X` langsung
- [ ] Jalankan `npm run test:unit` — banyak modul legacy punya test yang sudah ada
