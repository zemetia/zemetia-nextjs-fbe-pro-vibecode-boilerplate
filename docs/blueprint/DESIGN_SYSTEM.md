# Design System

← [Blueprint INDEX](./INDEX.md)

Seluruh styling ada di satu file: [src/index.css](../../src/index.css). Tidak ada Tailwind, tidak ada CSS modules, tidak ada styled-components. Yang ada: CSS variables di `:root` + class global + `style={{}}` inline di JSX.

Tema tunggal: gelap, aksen emas. Tidak ada mode terang, dan jangan menambahkannya tanpa diminta.

---

## Token

```css
--bg-primary: #0b0f19;      --bg-surface: #131b2e;
--bg-card: rgba(23,32,54,.75);  --bg-card-hover: rgba(30,42,70,.85);

--accent-gold: #f59e0b;     --accent-gold-light: #fbbf24;
--accent-gold-glow: rgba(245,158,11,.2);
--accent-emerald: #10b981;  --accent-blue: #3b82f6;  --accent-purple: #8b5cf6;

--text-primary: #f8fafc;    --text-secondary: #94a3b8;   --text-muted: #64748b;
--border-color: rgba(255,255,255,.08);   --border-hover: rgba(245,158,11,.3);

--radius-sm: 8px;  --radius-md: 14px;  --radius-lg: 20px;
--font-main: 'Inter', system-ui, sans-serif;
--font-heading: 'Outfit', sans-serif;
```

Font dimuat dari Google Fonts di [index.html](../../index.html).

### Arti warna (konsisten di seluruh aplikasi)

| Warna | Makna |
|---|---|
| Emas `#f59e0b` / `#fbbf24` | Emas, nilai, identitas PT TAN, item aktif |
| Emerald `#10b981` / `#34d399` | Selesai, terverifikasi, tunai, sudah masuk vault |
| Biru `#0284c7` / `#38bdf8` | Kredit/tempo, kurir, dokumen, informasi |
| Merah `#ef4444` | Gagal, sync tertunda, peringatan |

Ikuti pemetaan ini. Badge hijau untuk barang yang masih transit akan salah dibaca oleh petugas vault.

---

## Class global

| Class | Kegunaan |
|---|---|
| `.glass-panel` | Kartu utama — semua blok konten dibungkus ini. `padding` diberikan inline (`24px`) |
| `.gold-gradient-text` | Judul beraksen |
| `.app-container` / `.main-content` | Shell: sidebar fixed 260px + konten bermargin |
| `.sidebar` `.sidebar-logo` `.sidebar-nav` `.nav-item` `.nav-item.active` | Sidebar |
| `.navbar` `.navbar-title` `.navbar-badges` | Header |
| `.badge` `.badge-gold` `.badge-emerald` | Label status |
| `.dashboard-grid` `.stat-card` `.stat-val` `.stat-lbl` | Kartu angka |
| `.table-container` `.custom-table` | Tabel data (scroll horizontal otomatis) |
| `.form-grid` `.form-group` `.form-label` `.form-input` `.form-select` | Form (grid auto-fit min 220px) |
| `.btn-primary` | Tombol utama |
| `.btn-ghost` | Tombol sekunder (transparan + border) — dipakai tombol "Batal" di modal |
| `.modal-overlay` `.modal-card` `.modal-close` `.modal-head` `.modal-icon` `.modal-title` `.modal-message` `.modal-actions` | Modal pemberitahuan — dipakai lewat komponen, jangan disusun manual |

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
| `variant` | `success` (emerald) · `warning` (emas) · `error` (merah) · `info` (biru) · `confirm` (emas). Default `info` |
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

## Kapan inline style

`style={{}}` dipakai di mana-mana dan itu memang gayanya. Batasnya:

- **Boleh inline**: padding/margin per instance, warna aksen kondisional, lebar kolom, `gridColumn: 'span 2'`, penekanan bidang tertentu.
- **Harus lewat variabel**: setiap warna teks/latar/border rujuk `var(--…)` bila token-nya ada. Hex mentah hanya untuk aksen semantik di tabel di atas.
- **Jangan** menambah class baru ke `index.css` untuk satu pemakaian. Tambahkan class hanya bila polanya sudah muncul di ≥3 tempat.

Contoh yang benar (dari `LmLocalTrading`):

```jsx
<button
  className="btn-primary"
  style={{ background: paymentMode === 'cash'
    ? 'linear-gradient(135deg, #10b981, #059669)'
    : 'transparent' }}
/>
```

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

Grid memakai `repeat(auto-fit, minmax(…, 1fr))`, jadi sebagian besar layar ikut menyesuaikan. Yang **tidak** responsif: `.sidebar` fixed 260px dan `.main-content { margin-left: 260px }` tanpa breakpoint. Aplikasi ini dipakai di desktop kantor; jangan mengerjakan tata letak mobile kecuali diminta.

---

← [Blueprint INDEX](./INDEX.md)
