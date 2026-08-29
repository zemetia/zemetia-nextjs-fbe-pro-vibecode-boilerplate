# Pages

← [Blueprint INDEX](./INDEX.md)

Setiap layar adalah satu file `.jsx` di [src/pages/](../../src/pages/) dengan default export komponen fungsi. Tidak ada folder per halaman, tidak ada sub-komponen, tidak ada file test. Halaman terpanjang saat ini ±35 KB dalam satu file — itu gaya yang berlaku di sini, dan konsistensi lebih penting daripada memecahnya diam-diam.

Komponen bersama yang sudah ada: kerangka aplikasi (`Sidebar`, `Navbar` di [src/components/layout/](../../src/components/layout/)) dan satu primitif UI, `Modal` di [src/components/ui/Modal.jsx](../../src/components/ui/Modal.jsx). Primitif lain (`PageHeader`, `DataTable`, `FormField`) belum ada — pola form dan tabel di bawah masih disalin per halaman. Bila primitif itu dibuat nanti, tempatnya `src/components/ui/`, dan adopsinya diputuskan dulu bersama user, bukan disisipkan diam-diam ke halaman yang kebetulan sedang disentuh.

---

## Anatomi standar

```jsx
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer } from 'lucide-react';
import { getMasterItems } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function NamaHalaman() {
  const { modalProps, showModal } = useModal();
  const [records, setRecords] = useState([]);
  const [formData, setFormData] = useState({ /* nilai contoh yang realistis */ });

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = () => { /* baca master + riwayat */ };

  const derived = formData.qty * formData.price;      // turunan dihitung saat render

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.wajib) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi …' });
      return;
    }
    // simpan record + tulis jurnal
    showModal({ variant: 'success', title: '…', message: 'ringkasan multi-baris' });
    loadInitialData();                                 // muat ulang, bukan setState manual
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        {/* judul + deskripsi + form */}
      </div>
      <div className="glass-panel" style={{ padding: '24px' }}>
        {/* tabel riwayat */}
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
```

### Aturan yang mengikat

| Aturan | Alasan |
|---|---|
| Satu `useState` per bidang logis; form dalam satu objek `formData` | Pola yang sudah dipakai seluruh halaman |
| Nilai awal form diisi contoh nyata (nama supplier, nomor nota, berat) | Disengaja — user PT TAN memakainya sebagai template, bukan sebagai form kosong |
| Nilai turunan dihitung saat render, tidak disimpan di state | Tidak ada state ganda yang bisa menyimpang |
| Setelah menulis, panggil `loadInitialData()` | Satu jalur baca; tidak ada dua sumber kebenaran di layar |
| Validasi = `if (!field) { showModal({ variant: 'warning', … }); return; }` di awal handler | Tidak ada library form di repo ini |
| Umpan balik = `showModal({ variant: 'success', … })` dengan ringkasan multi-baris di `message` | User membacanya sebagai bukti transaksi — isinya tetap panjang, hanya wadahnya yang berubah |
| Konfirmasi destruktif/ireversibel = `showModal({ variant: 'confirm', onConfirm })` | Contoh: `handleConfirmVaultArrival` → `postVaultArrival` di `LmLocalTrading` |
| Satu `<Modal {...modalProps} />` per halaman, di akhir `return` | Satu hook `useModal()` melayani seluruh pesan di halaman itu |
| **Setiap tombol punya `onClick`** | Tiga tombol tanpa handler sudah pernah lolos ke produksi |

Rincian prop dan aturan isi pesan: [DESIGN_SYSTEM.md § Modal pemberitahuan](./DESIGN_SYSTEM.md#modal-pemberitahuan).

### Yang dilarang

- `alert()`, `window.confirm()`, dan `window.prompt()`. Semuanya diganti `Modal` — dialog bawaan browser tidak bisa ditema, memblokir thread, dan tampil sebagai popup Chrome yang asing di layar bertema gelap ini.
- `<button>` tanpa `onClick`, atau label yang menjanjikan lebih dari yang dilakukan kode ("Auto-Jurnal" yang tidak menjurnal).
- Angka laporan yang di-hardcode di JSX. Bila datanya belum ada, tampilkan keadaan kosong yang jujur.
- `useState` berisi data contoh yang tampak seperti data asli tanpa pernah dibaca dari storage (`WarehouseManagement` melakukan ini — jangan ditiru).
- Menambah dependensi. Tidak ada React Router, tidak ada form library, tidak ada tabel library.

---

## Mendaftarkan halaman

Satu file: [src/config/pages.js](../../src/config/pages.js). `App.jsx` dan `Sidebar.jsx` membacanya — keduanya tidak perlu disentuh.

```jsx
// 1. import komponennya
import NamaHalaman from '../pages/NamaHalaman';

// 2. entri di PAGES
{
  id: 'nama-halaman',
  title: 'Judul Panjang Yang Muncul Di Navbar',
  label: 'Label Pendek Sidebar',
  icon: Package,                      // dari lucide-react
  component: NamaHalaman
}

// 3. id-nya dimasukkan ke grup yang sesuai di PAGE_GROUPS
{ id: 'vault', title: '🏛️ GUDANG VAULT & OPERASIONAL', items: [ …, 'nama-halaman' ] }
```

Grup sidebar yang tersedia: `purchasing` (📦 Pembelian) · `sales` (🏷️ Penjualan) · `vault` (🏛️ Gudang Vault & Operasional) · `accounting` (💼 Akuntansi & Keuangan) · `system` (⚙️ Setting & Utility). Urutan item di sidebar = urutan `items`, bukan urutan `PAGES`.

Satu halaman boleh muncul di lebih dari satu grup. Bila labelnya perlu berbeda per grup, tulis `{ id, label }` sebagai ganti string — begitulah `goods-receipt` tampil sebagai "Penerimaan Barang (TTB / GRN)" di Pembelian dan "Penerimaan Barang (TTB)" di Vault.

Setiap halaman menerima prop `setActivePage` — dipakai `Dashboard` untuk tombol pintas; halaman lain boleh mengabaikannya.

---

## Bentuk record

Record transaksi mengikuti pola yang sama di seluruh halaman:

```js
{
  id: Date.now(),                    // ⚠️ lihat hard constraint #13 — sebaiknya sequencer
  receiptNo / poNumber / grnNumber,  // nomor dokumen manusia
  orderDate: 'YYYY-MM-DD',
  supplierName / customerName,
  itemCode, itemName,                // dari master, jangan diketik bebas
  quantityGrams: Number,             // selalu gram
  unitPriceIDR: Number,
  totalAmount: Number,
  journalAccountDebitStage1, journalAccountCreditStage1,
  status: 'IN TRANSIT (…)',          // string bebas — dibaca UI dengan .includes()
  isVaultReceived: false,            // flag boolean untuk gerbang tahap berikutnya
  createdAt: new Date().toISOString()
}
```

Gunakan flag boolean eksplisit (`isVaultReceived`) untuk menggerbangi langkah berikutnya, bukan parsing string `status`. `status` untuk mata manusia.

---

## Master data di form

Dropdown barang/mitra membaca master dari `storageService`, lalu **menggabungkannya** dengan daftar default bawaan halaman:

```js
const items = getMasterItems() || [];
const combined = [...defaultMasterItems];
items.forEach(it => {
  if (!combined.some(c => c.code === it.code || c.id === it.id)) combined.push(it);
});
```

Pola ini disengaja: user selalu melihat katalog emas standar PT TAN walau master data belum diisi. Bila menambah dropdown master baru, ikuti bentuk ini — jangan tampilkan dropdown kosong.

---

## Tabel riwayat

```jsx
<div className="table-container">
  <table className="custom-table">
    <thead><tr><th>…</th></tr></thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan="9" style={{ textAlign:'center', color:'var(--text-muted)', padding:'30px' }}>
          Belum ada riwayat …
        </td></tr>
      ) : rows.map(r => <tr key={r.id}>…</tr>)}
    </tbody>
  </table>
</div>
```

Keadaan kosong wajib ada. Status ditampilkan sebagai `.badge` (`badge-emerald` selesai, `badge-gold` menunggu). Angka uang: `Rp {n.toLocaleString()}`; berat: `{n} g`.

---

## Kolom aksi

Tombol aksi per baris, dari kiri ke kanan: aksi yang memajukan alur dulu (mis. "Konfirmasi Tiba Di Vault"), baru dokumen (WA PDF, Cetak). Tombol yang memajukan alur disembunyikan setelah tahapnya selesai — bukan dinonaktifkan.

Semua tombol cetak/kirim saat ini memunculkan `showModal({ variant: 'info' })` berisi ringkasan dokumen yang akan dihasilkan, termasuk daftar kolom tanda tangan. Itu placeholder yang disepakati sampai `pdfExporter.js` disambungkan; pertahankan isi ringkasannya bila menggantinya dengan PDF sungguhan.

---

← [Blueprint INDEX](./INDEX.md)
