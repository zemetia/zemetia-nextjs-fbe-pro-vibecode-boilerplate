# Storage Engine

← [Blueprint INDEX](./INDEX.md)

Seluruh data aplikasi melewati satu objek global: `window.Storage`, didefinisikan di [data/storage.js](../../data/storage.js). Tidak ada ORM, tidak ada schema, tidak ada validasi tipe. Yang ada adalah pasangan kunci → JSON di localStorage, dengan cermin di Firestore.

---

## Model penyimpanan

```
Storage.set(key, value)
   ├─ localStorage.setItem(key, JSON.stringify(value))   ← sinkron, selalu terjadi
   └─ CloudStorage.save(key, value)                      ← async, Firestore
        └─ gagal → SyncGuard.add(key, value) → banner merah + retry tiap 30 dtk
```

`USE_CLOUD_STORAGE: true` dipasang keras di [data/storage.js:9](../../data/storage.js). Komentar di sana menyebut localStorage "hanya cache", tapi praktiknya di app React: `firebase-config.js` tidak di-import `main.jsx`, jadi `window.db` biasanya kosong, `CloudStorage.save()` mengembalikan gagal dengan `lastErrorCode: 'cloud-unavailable'`, dan **localStorage adalah satu-satunya kebenaran**. Perlakukan cloud sebagai bonus, bukan jaminan.

Konsekuensinya: data terikat ke satu browser di satu komputer. Backup dilakukan manual lewat `SystemSettingsPage` (Export/Import JSON). Katakan ini apa adanya bila user bertanya soal multi-user atau multi-perangkat.

---

## API yang boleh dipakai

| Fungsi | Sifat | Catatan |
|---|---|---|
| `Storage.get(key)` | sinkron | `null` bila kosong. Dibatasi role untuk kunci payroll |
| `Storage.set(key, value, skipCloud?, specificItem?)` | **async** → `boolean` | Selalu `true` bila localStorage berhasil, walau cloud gagal |
| `Storage.setWithCloudBlock(key, value)` | **async** → `{ success, localSaved, cloudSaved, error }` | Untuk transaksi kritis (jurnal, BKK, TTB) yang butuh kepastian cloud |
| `Storage.delete(key)` | sinkron | Hanya localStorage — **tidak** menghapus di Firestore |
| `Storage.trackDeletion(id)` | sinkron | Wajib setelah menghapus record, agar sync tidak menghidupkannya lagi |
| `Storage.getNextReferenceNumber(type)` | **async** → `'JRN-000123'` | Transaksi Firestore atomik, fallback ke counter lokal |
| `Storage.previewNextReferenceNumber(type)` | sinkron | Tidak menaikkan counter — untuk preview di form |
| `Storage.exportData()` / `Storage.importData(file)` | | Backup JSON penuh |
| `Storage.getDefaultChartOfAccounts()` | sinkron | COA resmi SAK EMKM — lihat [ACCOUNTING.md](./ACCOUNTING.md) |

Ada puluhan helper domain (`getItems`, `addSupplier`, `getEmployees`, `getPayroll`, …). Sebagian besar melayani modul dorman. Untuk app React, akses lewat [src/services/storageService.js](../../src/services/storageService.js).

### `set()` itu async

```js
// ❌ Salah — reload bisa membaca sebelum tulis selesai
window.Storage.set(KEY, list);
loadInitialData();

// ✅ Benar
await window.Storage.set(KEY, list);
loadInitialData();
```

Kode existing di beberapa halaman melanggar ini. Karena localStorage ditulis sinkron di baris pertama `set()`, gejalanya jarang muncul — sampai cloud aktif. Untuk kode baru, `await`.

---

## KEYS

`Storage.KEYS` ([data/storage.js:170](../../data/storage.js)) memetakan nama simbolik ke string localStorage. Ada 70+ entri; yang relevan untuk app React:

| Konstanta | String | Dipakai |
|---|---|---|
| `CHART_OF_ACCOUNTS` | `erp_chart_of_accounts` | COA, semua dropdown akun |
| `JOURNAL_ENTRIES` | `erp_journal_entries` | Seluruh jurnal — sumber laporan keuangan |
| `ITEMS` | `erp_items` | Master barang emas |
| `CUSTOMERS` / `SUPPLIERS` | `erp_customers` / `erp_suppliers` | Master mitra |
| `PURCHASE_ORDERS` | `erp_purchase_orders` | PO impor via `PurchaseOrder.createOrder` |
| `PAYMENT_VOUCHERS` / `RECEIPT_VOUCHERS` | `payment_vouchers` / `receipt_vouchers` | BKK/BKM |
| `TRANSACTION_COUNTERS` | `erp_transaction_counters` | Counter penomoran |
| `WAREHOUSE_STOCK` / `STOCK_CARDS` | `erp_warehouse_stock` / `stock_cards` | **Belum ditulis app React** — rantai stok masih putus |

### Kunci `pttan_*` di luar KEYS

Halaman React memperkenalkan kunci sendiri yang tidak terdaftar di `KEYS`:

`pttan_local_purchases` · `pttan_goods_receipts` · `pttan_export_sales_orders` · `pttan_export_invoices` · `pttan_export_delivery_orders` · `pttan_master_finished_goods` · `pttan_company_profile` · `pttan_bca_erate_usd` (localStorage langsung, bukan lewat Storage)

Ini utang teknis: kunci di luar `KEYS` **tidak ikut** dalam export/import backup di `SystemSettingsPage` — kecuali `pttan_company_profile` yang ditambahkan manual. Kunci baru: daftarkan di `KEYS`, dan bila menambah kunci `pttan_*`, tambahkan juga ke daftar backup.

---

## CloudStorage

Adapter Firestore internal ([data/storage.js:289](../../data/storage.js)).

- Menolak `undefined` — `deepStripUndefined()` membersihkan objek sebelum kirim. Objek yang dibangun dengan field opsional harus lolos ini, atau sync gagal diam-diam.
- `lastErrorCode` menyimpan alasan gagal terakhir: `'cloud-unavailable'` (Firebase belum siap) atau `'permission-denied'` (aturan Firestore menolak).
- `permission-denied` pada user read-only **tidak** masuk antrean retry — itu disengaja, agar user tanpa hak tulis tidak melihat banner merah selamanya.

## SyncGuard

Antrean retry + banner peringatan ([data/storage.js:15](../../data/storage.js)).

| Perilaku | Nilai |
|---|---|
| Interval retry | 30 detik |
| Maksimum percobaan | 10 (~5 menit) lalu menyerah |
| Banner | `<div id="sync-guard-banner">` merah, disuntik ke `document.body` |
| Kunci senyap (tak memicu banner) | `CONFIG`, `SETTINGS`, `erp_current_session`, `AUDIT_LOG`, `BUG_REPORTS` |

Banner ini DOM langsung, di luar React. Jangan coba mengendalikannya dari komponen.

## CloudSequencer

Penomoran atomik lewat Firestore transaction pada dokumen `transactionCounters/counters`. Dipakai `getNextReferenceNumber()`. Bila `window.db` tidak ada, mengembalikan `null` dan pemanggil jatuh ke counter lokal.

Tipe transaksi yang valid: `JRN` `CSH` `BNK` `SAL` `PUR` `ADJ` `DEP` `CLS` `S`. Format keluaran: `JRN-000123`.

**Halaman React saat ini tidak memakainya** — semua nomor dokumen dibuat dari `Date.now().toString().slice(-6)`. Itu pelanggaran hard constraint #13 di [INDEX.md](./INDEX.md); untuk kode baru pakai sequencer.

---

## Mode GUEST_SAFETY (honeypot)

Bila `localStorage['erp_current_session']` berisi role `GUEST_SAFETY`, `Storage.get()` **tidak** membaca data asli — ia mengembalikan data contoh dari `getSafetySampleData()`: master item/customer/supplier yang tampak wajar, tapi seluruh stok, jurnal, voucher, dan transaksi kosong. Banner SyncGuard juga disembunyikan.

Ini fitur keamanan yang disengaja, bukan bug. Jangan "perbaiki" karena data terlihat kosong — periksa dulu isi `erp_current_session`.

---

## Pembatasan role pada payroll

`isPayrollSecurityKey()` / `canCurrentUserReadKey()` / `canCurrentUserWriteKey()` memblokir baca-tulis kunci payroll untuk role yang tidak berhak; `get()` mengembalikan `[]`/`null`, `set()` mengembalikan `false` tanpa melempar. Relevan hanya untuk modul HR yang dorman, tapi menjelaskan kenapa `set()` bisa mengembalikan `false` tanpa error apa pun.

---

## Aturan praktis

1. Baca lewat `storageService.js`. Bila fungsinya belum ada, tambahkan di sana — jangan panggil `window.Storage` dari JSX.
2. Guard setiap akses: `if (typeof window !== 'undefined' && window.Storage)`.
3. Record baru masuk dengan `unshift` (terbaru di depan) — pola yang sudah dipakai konsisten. Ingat implikasinya saat menghitung saldo berjalan: **urutkan naik menurut tanggal dulu**.
4. `await` setiap `set()`.
5. Simpan angka sebagai `Number`, tanggal sebagai `YYYY-MM-DD`, berat selalu gram.
6. Setelah menghapus, panggil `trackDeletion(id)`.

---

← [Blueprint INDEX](./INDEX.md)
