# PT TAN ERP — Gold Trading & Jewelry Export

## CRITICAL — Read Before Anything Else

> Dua file ini adalah konteks terpenting di proyek ini. Baca di awal setiap tugas, sebelum menyentuh seksi blueprint mana pun atau kode apa pun.

| File | Isi |
|---|---|
| [docs/knowledge/THIS.md](docs/knowledge/THIS.md) | Identitas proyek, realita lapangan PT TAN, gaya developer, do's & don'ts, insight berjalan |
| [docs/knowledge/LEARN.md](docs/knowledge/LEARN.md) | Kesalahan lampau dan koreksinya — baca agar tidak mengulang |

**Aturan menulis:**
- Setelah tugas yang memunculkan insight atau preferensi baru → tambahkan ke `THIS.md`
- Saat user mengoreksi, atau saat menyadari sendiri menyimpang → langsung tambahkan ke `LEARN.md` dengan format: `[YYYY-MM-DD] - [masalah] - [pendekatan benar] - [pelajaran]`

---

> **Sebelum merencanakan perbaikan atau fitur:** tentukan seksi blueprint mana yang meliputi area terdampak, baca lebih dulu, baru menyusun rencana. Jangan menebak pola — blueprint adalah sumber kebenaran.

## Business flow

Audit alur bisnis end-to-end — dokumen apa mengalir ke mana, mata rantai mana yang sudah tersambung dan mana yang masih putus: [docs/FLOW_ANALYSIS.md](docs/FLOW_ANALYSIS.md). Baca sebelum menyentuh modul pembelian, vault, produksi, atau ekspor.

## Blueprint

| Section | File |
|---|---|
| Index + hard constraints + checklist | [docs/blueprint/INDEX.md](docs/blueprint/INDEX.md) |
| Struktur proyek + lokasi file | [docs/blueprint/STRUCTURE.md](docs/blueprint/STRUCTURE.md) |
| Boot, routing, dua lapisan aplikasi | [docs/blueprint/ARCHITECTURE.md](docs/blueprint/ARCHITECTURE.md) |
| **`window.Storage`, KEYS, cloud sync** | [docs/blueprint/STORAGE.md](docs/blueprint/STORAGE.md) |
| **COA SAK EMKM + alur 2 tahap + aturan jurnal** | [docs/blueprint/ACCOUNTING.md](docs/blueprint/ACCOUNTING.md) |
| Anatomi halaman React + pola form/tabel | [docs/blueprint/PAGES.md](docs/blueprint/PAGES.md) |
| CSS variables + class global | [docs/blueprint/DESIGN_SYSTEM.md](docs/blueprint/DESIGN_SYSTEM.md) |
| 116 modul legacy — mana hidup, mana dorman | [docs/blueprint/LEGACY.md](docs/blueprint/LEGACY.md) |
| Jest, Cypress, verifikasi sebelum selesai | [docs/blueprint/TESTING.md](docs/blueprint/TESTING.md) |
| **Aturan sistem pengetahuan** | [docs/blueprint/KNOWLEDGE.md](docs/blueprint/KNOWLEDGE.md) |

## Stack snapshot

React 19 · Vite 8 · JavaScript murni (tanpa TypeScript) · lucide-react · Firebase 12 (Firestore) · Jest + jsdom · Firebase Hosting

Tanpa TypeScript, tanpa ESLint, tanpa Prettier, tanpa Tailwind, tanpa React Router, tanpa state library. **Jangan menambahkannya tanpa diminta.**

## Non-negotiables

- Entry point tunggal: `index.html` → `src/main.jsx`. `app.js`, `login.html`, dan `simulasi-awi.html` adalah jalur mati — perbaikan di sana tidak pernah dieksekusi
- Halaman baru didaftarkan di tiga tempat: `renderContent()`, `getPageTitle()` (`src/App.jsx`), dan `menuGroups` (`src/components/Sidebar.jsx`)
- Data diakses lewat `src/services/storageService.js` — bukan `window.Storage` langsung di JSX. Setiap akses dijaga `typeof window !== 'undefined' && window.Storage`
- `Storage.set()` itu **async** — `await` sebelum memuat ulang
- Kode akun hanya dari COA (`getDefaultChartOfAccounts()` di `data/storage.js`), dan hanya akun bertipe `detail`. `2110` tidak ada, `1111` itu header, `4110` itu Direct Labour — verifikasi sebelum menjurnal
- Setiap transaksi yang menyentuh uang atau emas **wajib** menulis jurnal ke `KEYS.JOURNAL_ENTRIES` di handler yang sama; total debit = total credit
- Pembelian tunai emas selalu 2 tahap: bayar → Debet `1159` (transit kurir); fisik tiba di brankas → Debet `1157`, Kredit `1159`
- Berat emas selalu disimpan **gram** (1 troy oz = 31,1034768 g, konversi sekali di batas simpan); uang selalu `Number` mentah, diformat hanya saat tampil; tanggal kalender `YYYY-MM-DD`
- Nomor dokumen dari `Storage.getNextReferenceNumber()`, bukan `Date.now()`
- Setiap tombol punya `onClick`, dan labelnya menjanjikan persis yang dilakukan kode — tidak ada "Auto-Jurnal" yang tidak menjurnal
- Tanpa `alert()`, `window.confirm()`, `window.prompt()`. Pemberitahuan dan konfirmasi lewat `useModal()` + `<Modal />` (`src/components/ui/Modal.jsx`) — lihat [DESIGN_SYSTEM.md](docs/blueprint/DESIGN_SYSTEM.md)
- Tidak ada angka laporan yang di-hardcode di JSX. Bila data belum ada, tampilkan keadaan kosong yang jujur
- Jangan menyentuh 102 modul dorman di `modules/` kecuali diminta; jangan membuat file backup longgar (`.bak`, `_new.js`, `.final`)
- `README.md`, `README.zh.md`, `EXAMPLES.md`, `CURSOR.md`, dan `skills/` di root berasal dari repo *karpathy-skills* yang ikut ter-merge — **bukan** dokumentasi ERP ini
- **Git Sync Sebelum Perubahan:** Setiap kali session hendak melakukan perubahan kode/file, wajib cek nama branch yang sedang aktif (`git branch --show-current`) dan lakukan pengecekan / pull dari remote branch tersebut (`git pull origin <current-branch>`) agar workspace selalu sinkron sebelum menulis kode baru.
- Verifikasi sebelum menyatakan selesai: `npm run build` lolos, halaman dibuka tanpa exception di konsol, dan `npm run test:unit` hijau bila `modules/` atau `data/` tersentuh. Laporkan apa yang dijalankan dan apa yang tidak diuji

---

## Working principles

Empat prinsip dari observasi [Andrej Karpathy](https://x.com/karpathy/status/2015883857489522876) tentang kebiasaan buruk LLM saat coding. Versi lengkap: [SKILLS.md](SKILLS.md).

**1. Think Before Coding** — Nyatakan asumsi eksplisit. Bila ada beberapa tafsir, paparkan; jangan memilih diam-diam. Bila ada cara lebih sederhana, katakan. Bila bingung, berhenti dan tanyakan.

**2. Simplicity First** — Kode minimum yang menyelesaikan masalah. Tanpa fitur, abstraksi, atau konfigurasi yang tidak diminta. Bila 200 baris bisa jadi 50, tulis ulang.

**3. Surgical Changes** — Sentuh hanya yang perlu. Jangan "memperbaiki" kode, komentar, atau format di sekitarnya. Ikuti gaya yang ada. Bersihkan hanya yang jadi yatim karena perubahan sendiri. Setiap baris yang berubah harus bisa ditelusuri langsung ke permintaan user.

**4. Goal-Driven Execution** — Tetapkan kriteria sukses yang bisa diverifikasi, lalu ulangi sampai terpenuhi. Untuk tugas bertahap, sebutkan rencana singkat: `1. [langkah] → verifikasi: [cek]`. Sertakan bukti verifikasi nyata, bukan klaim.

**Tradeoff:** panduan ini condong ke kehati-hatian daripada kecepatan. Untuk tugas sepele, pakai penilaian sendiri.
