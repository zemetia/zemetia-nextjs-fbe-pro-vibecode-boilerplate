# Design System

← [Blueprint INDEX](./INDEX.md)

Styling proyek ini **Tailwind v4**. [src/index.css](../../src/index.css) tinggal ~190 baris: token palet di `@theme`, dasar tema gelap di `@layer base`, dan 18 primitif frekuensi tinggi di `@layer components`. Tidak ada CSS modules, tidak ada styled-components.

**Migrasi penuh ke Tailwind 2026-08-18** atas permintaan user, menggantikan 550 baris class global + 670 inline style. Aturan yang berlaku sekarang:

- `@import 'tailwindcss'` — theme + **preflight** + utilities. Preflight menyala atas keputusan user; tema gelap dibangun di atasnya lewat `@layer base` (`color-scheme: dark`, `body` bergaya token, ukuran dasar `h1`–`h4` karena preflight menyetelnya jadi `inherit`).
- **Tulis utility di JSX.** `className="flex items-center gap-3 rounded-md p-6"` adalah cara normal di halaman mana pun, termasuk `src/pages/`.
- Class bernama hanya untuk pola yang **sudah muncul ≥15 kali** — itu isi `@layer components`. Menyalin 12 utility yang sama ke 143 `<input>` bukan Tailwind yang baik, tapi membuat class untuk satu pemakaian juga bukan.
- Token shadcn (`--popover`, `--border`, `--accent`, `--ring`, …) hidup berdampingan di `@theme` sebagai alias palet PT TAN — dipakai `Popover`, `Command`, `Combobox`.

Tema tunggal: gelap, aksen emas. Palet gelap adalah palet **dasar**, bukan varian `dark:`. Tidak ada mode terang, dan jangan menambahkannya tanpa diminta.

---

## Token

Token didefinisikan di `@theme`, jadi setiap nama langsung jadi utility: `--color-fg-soft` → `text-fg-soft`, `bg-fg-soft`, `border-fg-soft`.

```css
@theme {
  --color-canvas: #0b0f19;      /* bg-canvas  — latar aplikasi (bukan `base`: bentrok dengan font-size `text-base`) */
  --color-surface: #131b2e;     /* bg-surface — panel padat, popover */
  --color-card: rgba(23,32,54,.75);      /* bg-card  — .glass-panel */
  --color-field: rgba(15,23,42,.7);      /* bg-field — .form-input */

  --color-gold: #f59e0b;   --color-gold-light: #fbbf24;   --color-gold-dark: #d97706;
  --color-gold-glow: rgba(245,158,11,.2);
  --color-emerald: #10b981;  --color-emerald-light: #34d399;  --color-emerald-dark: #059669;
  --color-sky: #0284c7;      --color-sky-light: #38bdf8;      --color-sky-dark: #0369a1;
  --color-blue: #3b82f6;
  --color-orange: #f97316;   --color-orange-light: #fb923c;   --color-orange-dark: #ea580c;
  --color-danger: #ef4444;   --color-danger-light: #f87171;
  --color-ink: #0f172a;      /* latar sidebar & panel terdalam */

  --color-fg: #f8fafc;   --color-fg-soft: #94a3b8;   --color-fg-muted: #64748b;
  --color-line: rgba(255,255,255,.08);   --color-line-hover: rgba(245,158,11,.3);

  --radius-sm: 8px;  --radius-md: 14px;  --radius-lg: 20px;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-heading: 'Outfit', sans-serif;
  --shadow-glass / --shadow-modal / --shadow-popover / --shadow-gold
}
```

**Skala radius menimpa bawaan Tailwind:** di proyek ini `rounded-sm` = 8px, `rounded-md` = 14px, `rounded-lg` = 20px — bukan 2/6/8px. Jangan "membetulkannya" ke skala bawaan.

Nama lama (`--text-secondary`, `--border-color`, `--accent-gold`, `--font-main`) **sudah tidak ada**. `var(--text-secondary)` di JSX tidak akan menghasilkan warna apa pun — pakai `text-fg-soft`.

Font dimuat dari Google Fonts di [index.html](../../index.html).

### 5 Warna Resmi & Artinya (Dibatasi Ketat — Tanpa Warna Pelangi)

Penggunaan warna dibatasi secara ketat hanya pada **5 warna resmi** (ditambah warna dasar gelap netral canvas/surface/field/line/fg):

| Warna | Makna & Penggunaan |
|---|---|
| **Emas (Gold)** `#f59e0b` / `#fbbf24` | Brand identity PT TAN, Logam Mulia murni, tombol utama, highlight saldo emas/aktif |
| **Hijau (Emerald)** `#10b981` / `#34d399` | Selesai, status posted, kas/tunai, sudah tiba/masuk vault, fasilitas pajak PPN 0% |
| **Biru (Sky/Blue)** `#0284c7` / `#38bdf8` / `#3b82f6` | Kredit/tempo, kurir/logistik kargo, dokumen eksternal/AWB, informasi, pajak PPh 22 |
| **Orange (Orange)** `#f97316` / `#fb923c` | Produksi, SPK workshop, alloy karat, formula BOM, biaya tambahan, warning/perhatian |
| **Merah (Danger/Red)** `#ef4444` / `#f87171` | Gagal, transaksi void/batal, hutang jatuh tempo, peringatan kritis, tombol destructive |

Warna di luar 5 palet di atas (seperti ungu/violet/pink/fuchsia/cyan/teal/lime) **dilarang digunakan** agar visual ERP tetap profesional, rapi, dan konsisten.

Ikuti pemetaan ini. Badge hijau untuk barang yang masih transit akan salah dibaca oleh petugas vault.

---

## Class global

Hanya 18 class yang tersisa di `@layer components`. Semuanya lolos ambang "dipakai ≥15 kali"; sisanya sudah jadi utility di JSX.

| Class | Kegunaan | Dipakai |
|---|---|---|
| `.glass-panel` | Kartu utama — semua blok konten dibungkus ini. `padding` diberikan lewat utility (`p-6`) | 61× |
| `.badge` `.badge-gold` `.badge-emerald` `.badge-rose` `.badge-blue` | Label status | 102× |
| `.stat-card` `.stat-val` `.stat-lbl` | Kartu angka | 44× |
| `.table-container` `.custom-table` | Tabel data (scroll horizontal otomatis) | 41× |
| `.form-grid` `.form-group` `.form-label` `.form-input` `.form-select` | Form (grid auto-fit min 220px) | 505× |
| `.btn-primary` `.btn-ghost` | Tombol utama & sekunder | 72× |
| `.scrollbar-gold` | Scrollbar emas `<nav>` sidebar — satu-satunya CSS mentah yang tersisa, karena `::-webkit-scrollbar` tidak punya utility |

Yang **dihapus** dan sekarang ditulis sebagai utility langsung di JSX: `.app-container` `.main-content` `.navbar*` `.sidebar*` `.nav-item*` `.logo-icon` `.modal-*` `.dashboard-grid` `.gold-gradient-text`. Masing-masing hanya dipakai sekali; class bernama untuk satu pemakaian adalah lapisan tak berguna.

Animasi (`popover-in`, `modal-fade`, `modal-rise`) didefinisikan di `@theme` sebagai `--animate-*`, dipakai lewat `animate-popover-in` dst. Tanpa `tw-animate-css`.

---

## Modal pemberitahuan

**`alert()` dan `window.confirm()` tidak dipakai lagi.** Seluruh pemberitahuan dan konfirmasi lewat [src/components/ui/Modal.jsx](../../src/components/ui/Modal.jsx).

```jsx
import Modal, { useModal } from '../components/ui/Modal';

export default function NamaHalaman() {
  const { modalProps, showModal } = useModal();

  // pengganti alert()
  showModal({
    variant: 'success',
    title: '✅ Tahap 1 Tersimpan — Rp 4.050.000.000',
    message: '• Jurnal: Debet 1159 vs Kredit Bank BCA IDR\n• Kurir ditugaskan ambil emas di Pegadaian Jakarta.'
  });

  // pengganti window.confirm() — onConfirm memunculkan tombol Batal
  showModal({
    variant: 'confirm',
    title: '📦 Konfirmasi Tiba Di Brankas Vault',
    message: 'Debet 1157 vs Kredit 1159 …',
    confirmLabel: 'Ya, Posting Jurnal Tahap 2',
    onConfirm: () => postVaultArrival(purchase)
  });

  return (
    <div>
      {/* … isi halaman … */}
      <Modal {...modalProps} />       {/* satu instance per halaman, di akhir return */}
    </div>
  );
}
```

| Prop | Isi |
|---|---|
| `variant` | Hanya lima ini: `success` (emerald) · `warning` (emas) · `error` (merah) · `info` (biru) · `confirm` (emas). Default `info`. Nama di luar daftar jatuh ke `info` dan memicu `console.warn` — jangan mengarang `danger`/`fail`/`alert` |
| `title` | Satu baris. Boleh diawali emoji penanda, sesuai konvensi proyek |
| `message` | Multi-baris dengan `\n` — dirender `white-space: pre-wrap`, jadi baris `•` tetap utuh |
| `onConfirm` | Ada → modal jadi konfirmasi (tombol `Batal` + tombol aksi). Tidak ada → hanya tombol `Mengerti` |
| `onDismiss` | Dipanggil setiap kali modal ditutup **tanpa** menjalankan `onConfirm` (tombol `Mengerti`/`Batal`, ✕, overlay, Esc). Untuk efek samping yang membongkar halaman — lihat aturan di bawah |
| `confirmLabel` / `cancelLabel` | Label tombol. Default `Lanjutkan` / `Mengerti` dan `Batal` |
| `children` | Isi kustom di bawah `message` — untuk kasus yang butuh tabel atau input |

Aturan pemakaian:

- **Ringkasan transaksi tetap panjang.** Yang dulu jadi isi `alert()` multi-baris pindah utuh ke `message` — user membacanya sebagai bukti transaksi. Jangan diringkas jadi satu kalimat.
- Garis pemisah `------` yang dulu dipakai di `alert()` **dibuang** — modal sudah punya kepala, ikon, dan garis pemisah sendiri.
- Judul memuat inti kejadian (nomor dokumen, nominal); `message` memuat rinciannya (baris jurnal, akun, catatan).
- `onConfirm` dipanggil setelah modal ditutup, jadi handler-nya bebas memanggil `showModal` lagi untuk pesan sukses — pola dua tahap konfirmasi → sukses berjalan tanpa penanganan khusus.
- Konfirmasi ireversibel wajib memakai `variant: 'confirm'`, bukan modal biasa yang tombolnya cuma menutup.
- **Efek samping yang membongkar halaman** (`window.location.reload()`, redirect, reset tampilan) dijalankan di `onDismiss`, **bukan** sebaris setelah `showModal`. `alert()` memblokir thread sehingga pesan sempat terbaca; modal tidak — reload akan menyapu pesannya sebelum terlihat. Contoh: `applyRestore` di `SystemSettingsPage`.
- Overlay, tombol ✕, dan tombol `Esc` semuanya menutup modal tanpa menjalankan `onConfirm`.

---

## Combobox (dropdown + search)

`<select className="form-select">` tetap benar untuk daftar pendek dan tetap (status, prioritas, jenis dokumen). Untuk daftar **panjang atau dinamis** — 213 akun COA, daftar PO, master barang, buku cek — pakai [src/components/ui/Combobox.jsx](../../src/components/ui/Combobox.jsx): pola Combobox shadcn/ui di atas `@radix-ui/react-popover` + `cmdk`.

```jsx
import Combobox from '../components/ui/Combobox';

<Combobox
  value={form.accountCode}
  onChange={accountCode => setForm({ ...form, accountCode })}
  options={coaAccounts.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))}
  placeholder="-- Pilih Akun COA --"
  searchPlaceholder="Cari kode atau nama akun…"
  emptyText="Akun tidak ditemukan di COA."
/>
```

| Prop | Isi |
|---|---|
| `value` | Nilai terpilih. Dicocokkan ke `options[].value` sebagai string |
| `onChange` | Menerima **nilai mentah**, bukan event. Sama isinya dengan `e.target.value` pada `<select>` yang digantikan — handler lama cukup diubah tanda tangannya dari `(e) => { const x = e.target.value }` jadi `(x) => {}` |
| `options` | `[{ value, label, keywords?, disabled? }]`. Search mencocokkan `label` **dan** `value`, jadi "hutang" maupun "2111" sama-sama ketemu |
| `placeholder` | Teks tombol saat belum ada pilihan (warna `--text-muted`). Default `-- Pilih --` |
| `searchPlaceholder` / `emptyText` | Teks kolom cari dan teks saat nol hasil. Tulis dalam Bahasa Indonesia, sebutkan objeknya ("Akun tidak ditemukan di COA.") |
| `className` | Diteruskan ke tombol pemicu dan digabung lewat `cn()` (tailwind-merge), jadi utility yang bentrok dimenangkan yang terakhir. Dipakai untuk aksen per-instance: `className="bg-ink text-gold-light font-bold"` |
| `style` | Masih diteruskan, tapi pakai `className` kecuali nilainya baru diketahui saat runtime |
| `disabled` | Mematikan tombol pemicu |

Aturan pemakaian:

- Opsi ber-`value: ''` (mis. `-- Tanpa PO --`) **boleh** dan tetap mengembalikan `''` — di dalam komponen nilainya disimpan pakai penanda karena cmdk memakai string kosong sebagai "tidak ada nilai".
- Tombol pemicu memakai class `.form-select` yang sama dengan input lain, jadi tinggi dan warnanya sejajar di dalam satu `.form-grid`.
- Popover memakai `z-index: 1100` — di atas `.sidebar` (100) dan `.modal-overlay` (1000). Jangan menurunkannya; Combobox di dalam `<Modal>` akan tersembunyi.
- Lebar popover mengikuti lebar tombol pemicu (`--radix-popover-trigger-width`), daftar maksimal 256px lalu scroll.
- Esc, klik di luar, dan ↑↓/Enter ditangani Radix + cmdk — jangan menambah penanganan keyboard sendiri.

Yang **tidak** dipindahkan ke Combobox dan memang sebaiknya tetap `<select>`: filter periode & status di `AccountingReports` dan `PurchaseRequestPage`, kategori/tipe akun di `ChartOfAccounts`, pilihan rekening bank (3 opsi), dan target vault (3 opsi). Search di daftar 3 baris hanya menambah satu klik.

---

## NumberInput (pemisah ribuan titik)

`<input type="number">` **tidak dipakai lagi** untuk kuantitas, berat, dan nominal uang. Ganti dengan [src/components/ui/NumberInput.jsx](../../src/components/ui/NumberInput.jsx) — tampilan dipisah titik per ribuan (`10000` → `10.000`), state yang disimpan tetap `Number` mentah.

```jsx
import NumberInput from '../components/ui/NumberInput';

<NumberInput
  value={form.unitPriceIDR}
  onChange={unitPriceIDR => setForm({ ...form, unitPriceIDR })}
/>

// field berdesimal (berat gram, harga USD/gram, kadar %) — desimal dipisah koma
<NumberInput
  allowDecimal
  value={form.pricePerGramUSD}
  onChange={pricePerGramUSD => setForm({ ...form, pricePerGramUSD })}
/>
```

| Prop | Isi |
|---|---|
| `value` | `Number` mentah (bukan string berformat) |
| `onChange` | Menerima **`Number` langsung**, bukan event — pola lama `onChange={e => setForm({ ...form, x: Number(e.target.value) })}` jadi `onChange={x => setForm({ ...form, x })}` |
| `allowDecimal` | Default `false` (bulat, cocok untuk kuantitas & nominal IDR). `true` untuk field yang butuh desimal — pemisah ribuan tetap titik, desimal dipisah **koma** (`10.000,5`), sesuai konvensi angka Indonesia |
| `className`, `placeholder`, `disabled` | Diteruskan ke `<input>`, `className` digabung lewat `cn()` di atas `.form-input` bawaan |

Aturan pemakaian:

- Field yang isinya **identifier**, bukan kuantitas — nomor lembar cek (`MasterChequePage`), nomor dokumen — **tetap** `<input type="number">` atau `text` biasa dengan `e.target.value` mentah. Nomor lembar cek boleh berawalan nol dan `NumberInput` akan menghilangkannya karena disimpan sebagai `Number`.
- `<input type="number" step="0.01">` yang sudah ada sebelumnya (kadar, harga per gram, berat) dipetakan ke `allowDecimal`, bukan dibuang begitu saja — grouping ribuan tanpa dukungan desimal akan memutus digit setelah titik.
- Tampilan format ulang **setiap keystroke** (bukan hanya saat blur) — cara ini yang membuat `10000` langsung terlihat `10.000` selagi mengetik.

## Komponen UI Modern (src/components/ui/)

Daftar primitif modular bergaya shadcn/ui yang selaras dengan tema gelap emas PT TAN ERP:

| Komponen | Kegunaan | Contoh Import & Penggunaan |
|---|---|---|
| `Button` | Tombol dengan varian (`gold`, `emerald`, `sky`, `outline`, `ghost`, `destructive`), ukuran (`sm`, `default`, `lg`, `icon`), dan loading spinner | `<Button variant="emerald" leftIcon={<Box size={14} />}>Simpan</Button>` |
| `Input` | Input teks/email/date dengan `bg-field`, border aksen, `leftIcon`, `rightIcon`, error message | `<Input value={val} onChange={e => ...} />` |
| `Label` | Label form dengan penanda `required` otomatis | `<Label required>No. Kuitansi</Label>` |
| `Textarea` | Input multi-baris konsisten dengan Input | `<Textarea rows={2} value={val} onChange={e => ...} />` |
| `Select` | Dropdown select native berikon ChevronDown kustom | `<Select value={acc} onChange={e => ...}><option>...</option></Select>` |
| `Badge` | Status pill dengan varian warna (`gold`, `emerald`, `sky`, `rose`, `purple`), ikon, dan `dot` | `<Badge variant="emerald" dot>VAULT STOCKED</Badge>` |
| `Card` | Kartu kaca modular (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) | `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader></Card>` |
| `Tabs` | Tab navigation dinamis (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) | `<Tabs defaultValue="tab1"><TabsList><TabsTrigger value="tab1">Tab 1</TabsTrigger></TabsList></Tabs>` |
| `Alert` | Banner inline alert (`info`, `success`, `warning`, `destructive`) dengan ikon otomatis | `<Alert variant="success" title="Tahap 1">...</Alert>` |
| `Combobox` | Dropdown filterable berbasis cmdk + Radix Popover | `<Combobox value={val} onChange={...} options={...} />` |
| `NumberInput`| Input angka berpemisah titik ribuan (IDR/Gram) | `<NumberInput value={nominal} onChange={...} />` |
| `Modal` | Dialog modal pemberitahuan & konfirmasi | `const { modalProps, showModal } = useModal();` |

Seluruh komponen dapat diimpor langsung lewat satu barrel export:
```jsx
import { Button, Input, Label, Textarea, Select, Badge, Card, Alert, Combobox, NumberInput, Modal, useModal } from '../components/ui';
```

---

## Kapan inline style

`style={{}}` **tidak dipakai lagi** untuk nilai statis. Yang tersisa di seluruh `src/` hanya 3 buah, semuanya di `Modal.jsx`, dan semuanya wajib inline karena nilainya baru diketahui saat runtime (`v.color` per varian):

```jsx
<span style={{ color: v.color, background: `${v.color}1f`, borderColor: `${v.color}40` }}>
```

Aturannya:

- **Utility di `className`** untuk semua yang statis, termasuk nilai arbitrer: `text-[0.85rem]`, `rounded-[10px]`, `bg-[rgba(15,23,42,0.6)]`.
- **Ternary di template literal** untuk varian kondisional — bukan inline style:

```jsx
<button
  className={`btn-primary text-[0.85rem] ${
    paymentMode === 'cash'
      ? 'bg-linear-135 from-emerald to-emerald-dark text-white'
      : 'bg-none bg-transparent text-fg-soft'
  }`}
/>
```

  `bg-none` wajib di cabang non-gradien: `.btn-primary` sudah menyetel `background-image`, dan `bg-transparent` hanya menyetel `background-color` — tanpa `bg-none`, gradien emasnya tetap terlihat.

- **Inline hanya untuk nilai runtime** yang tidak bisa jadi nama class: warna dari state, ukuran dari perhitungan, `borderTopColor` per varian modal.
- **Jangan** menambah class ke `@layer components` untuk satu pemakaian. Ambangnya ≥15 pemakaian; di bawah itu tulis utility.

---

## Ikon

`lucide-react`, ukuran 13–26 tergantung konteks (`16` di sidebar, `18` di tombol, `24` di judul halaman). Emoji dipakai sebagai penanda kategori di teks dan label sidebar (📦 🏛️ 💼 ⚙️) — bukan sebagai pengganti ikon fungsional.

---

## Angka & tanggal di layar

| Jenis | Format |
|---|---|
| Rupiah | `Rp {n.toLocaleString()}` |
| USD | `$ {n.toLocaleString()}` |
| Berat | `{n} g` (atau `{n} oz` bila baris memang dikutip per ounce) |
| Tanggal | `YYYY-MM-DD` di input `type="date"`; `toLocaleDateString('id-ID')` bila ditampilkan panjang |
| Kadar | `99.99%` |

Formatting hanya saat tampil. Yang masuk state dan storage tetap `Number`.

---

## Responsif

Grid memakai `grid-cols-[repeat(auto-fit,minmax(…,1fr))]`, jadi sebagian besar layar ikut menyesuaikan. Yang **tidak** responsif: sidebar `fixed w-[260px]` dan konten `ml-[260px]` tanpa breakpoint. Aplikasi ini dipakai di desktop kantor; jangan mengerjakan tata letak mobile kecuali diminta.

---

← [Blueprint INDEX](./INDEX.md)
