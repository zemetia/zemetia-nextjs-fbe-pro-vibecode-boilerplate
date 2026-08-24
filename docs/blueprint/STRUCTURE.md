# Project Structure

← [Blueprint INDEX](./INDEX.md)

---

## Root

| Path | Status | Keterangan |
|---|---|---|
| [index.html](../../index.html) | 🟩 aktif | Satu-satunya entry point. Memuat `/src/index.css` + `/src/main.jsx` |
| [src/](../../src/) | 🟩 aktif | Aplikasi React — UI yang benar-benar dipakai |
| [public/](../../public/) | 🟩 aktif | Aset statis Vite, disalin apa adanya ke `dist/`. Berisi `logo/logo-tan.png` (brand mark PT TAN, dipakai Sidebar via `/logo/logo-tan.png`) |
| [data/](../../data/) | 🟩 aktif | Mesin data vanilla; `storage.js` dimuat oleh `main.jsx` |
| [modules/](../../modules/) | 🟨 sebagian | 116 file; 14 dimuat, 102 dorman |
| [tests/](../../tests/) | 🟨 sebagian | 28 file test; mayoritas menguji modul dorman |
| [app.js](../../app.js) | 🟥 mati | Router aplikasi vanilla lama. Tidak dimuat siapa pun |
| [login.html](../../login.html) | 🟥 mati | Halaman login lama, tidak terhubung ke app React |
| [simulasi-awi.html](../../simulasi-awi.html) | 🟥 mati | Halaman simulasi lepas |
| [firebase-config.js](../../firebase-config.js) | 🟨 | Inisialisasi Firebase via CDN gstatic. Tidak di-import `main.jsx` — hanya aktif di jalur HTML lama |
| [firebase.json](../../firebase.json) | 🟩 | Hosting `dist/`, predeploy `npm run build`, SPA rewrite, security headers |
| [firestore.rules](../../firestore.rules) / [firestore.indexes.json](../../firestore.indexes.json) | 🟩 | Aturan & indeks Firestore |
| [vite.config.js](../../vite.config.js) | 🟩 | Plugin React, dev server port 3000 |
| [package.json](../../package.json) | 🟩 | Script + konfigurasi Jest inline |
| [CLAUDE.md](../../CLAUDE.md) | 🟩 | Pintu masuk konteks AI |
| [SKILLS.md](../../SKILLS.md) · [skills/](../../skills/) · [.cursor/](../../.cursor/) · [.claude-plugin/](../../.claude-plugin/) | 🟨 | Isi dari repo *karpathy-skills* yang ikut ter-merge. Bukan dokumentasi ERP |
| [README.md](../../README.md) · [README.zh.md](../../README.zh.md) · [EXAMPLES.md](../../EXAMPLES.md) · [CURSOR.md](../../CURSOR.md) | 🟥 menyesatkan | README repo *karpathy-skills*, **bukan** README ERP ini |
| [.agent/](../../.agent/) · [.agents/](../../.agents/) | 🟨 | Workflow & aturan agent dari proyek Gold Refinery sebelumnya |
| [chart of account PT TAN.xlsx](../../chart%20of%20account%20PT%20TAN.xlsx) | 📎 | Sumber COA versi akuntan |

---

## src/ — Aplikasi React

| Path | Export | Peran |
|---|---|---|
| [src/main.jsx](../../src/main.jsx) | — | Bootstrap: import CSS, import side-effect mesin legacy, `Storage.init()`, `createRoot` |
| [src/App.jsx](../../src/App.jsx) | `App` | Shell: Clean URL Path routing (`/page-id`) + render halaman aktif dari registry. Zero-dependency, tanpa `switch` |
| [src/index.css](../../src/index.css) | — | Seluruh styling aplikasi. Satu file, CSS variables + class global |
| [src/config/pages.js](../../src/config/pages.js) | `PAGES`, `PAGE_GROUPS`, `PINNED_PAGE_IDS`, `getPage`, `getPageTitle`, `getMenuItems`, `DEFAULT_PAGE_ID` | **Registry halaman** — satu-satunya tempat pendaftaran: id, judul navbar, label sidebar, ikon, komponen, dan susunan grup menu |
| [src/components/layout/Sidebar.jsx](../../src/components/layout/Sidebar.jsx) | `Sidebar` | 5 grup menu collapsible, state `openCategories`. Isi menu dibaca dari `config/pages.js`. Struktur tetap: header logo + nav yang bisa di-scroll + footer, semua styling di `index.css` |
| [src/components/layout/Navbar.jsx](../../src/components/layout/Navbar.jsx) | `Navbar` | Judul halaman + badge kurs (klik = refresh BCA e-Rate) |
| [src/components/ui/Modal.jsx](../../src/components/ui/Modal.jsx) | `Modal` (default), `useModal` | **Pengganti `alert()` / `window.confirm()`.** 5 varian (`success`/`warning`/`error`/`info`/`confirm`), pesan multi-baris `pre-wrap`, tutup lewat overlay/✕/Esc. Styling di `index.css` (`.modal-*`, `.btn-ghost`) |
| [src/pages/](../../src/pages/) | 18 halaman | Satu file = satu layar. Lihat tabel di bawah |
| [src/services/storageService.js](../../src/services/storageService.js) | 13 fungsi | Pembungkus `window.Storage` & `window.PurchaseOrder` |
| [src/services/currencyService.js](../../src/services/currencyService.js) | `fetchBcaERateUSD`, `getStoredUsdRate`, `setCustomUsdRate` | Kurs USD/IDR live + fallback benchmark 16.250 |
| [src/components/ui/Combobox.jsx](../../src/components/ui/Combobox.jsx) | `Combobox` (default) | **Pengganti `<select className="form-select">` untuk daftar panjang.** Dropdown + search, pola Combobox shadcn/ui. Dipakai 22 kali di 12 halaman |
| [src/components/ui/Popover.jsx](../../src/components/ui/Popover.jsx) | `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverContent` | Popover shadcn/ui di atas `@radix-ui/react-popover`. Dipakai `Combobox`; `z-index: 1100` agar di atas sidebar & modal |
| [src/components/ui/Command.jsx](../../src/components/ui/Command.jsx) | `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator` | Daftar ber-search (`cmdk`) versi shadcn/ui. `CommandDialog` sengaja tidak disertakan |
| [src/utils/format.js](../../src/utils/format.js) | `formatIDR` | Formatter tampilan. Baru dipakai `Navbar`; halaman masih memformat sendiri (44 `toLocaleString` tersebar) |
| [src/utils/cn.js](../../src/utils/cn.js) | `cn` | Helper `clsx` + `tailwind-merge` milik shadcn/ui (aslinya `lib/utils`). Hanya dipakai komponen di `components/ui/` |

### src/pages/

| Halaman | `activePage` | Menyimpan ke | Jurnal otomatis |
|---|---|---|---|
| [Dashboard.jsx](../../src/pages/Dashboard.jsx) | `dashboard` | — (angka hardcoded) | — |
| [LmImportTrading.jsx](../../src/pages/LmImportTrading.jsx) | `import-trading` | `PURCHASE_ORDERS` via `PurchaseOrder.createOrder` | ❌ belum |
| [LmLocalTrading.jsx](../../src/pages/LmLocalTrading.jsx) | `local-trading` | `pttan_local_purchases` | ✅ 2 tahap: 1159→1157 |
| [BuyingScrapMelting.jsx](../../src/pages/BuyingScrapMelting.jsx) | `scrap-melting` | — (kalkulator, tombol tanpa handler) | ❌ |
| [GoodsReceiptPage.jsx](../../src/pages/GoodsReceiptPage.jsx) | `goods-receipt` | `pttan_goods_receipts` | ✅ |
| [JewelryProduction.jsx](../../src/pages/JewelryProduction.jsx) | `jewelry-production` | — | ✅ jurnal saja, tanpa record produksi |
| [ExportSalesOrderPage.jsx](../../src/pages/ExportSalesOrderPage.jsx) | `export-so` | `pttan_export_sales_orders` | ❌ (benar — SO belum peristiwa akuntansi) |
| [ExportInvoicing.jsx](../../src/pages/ExportInvoicing.jsx) | `export-invoicing` | `pttan_export_invoices` | ✅ |
| [ExportDeliveryOrderPage.jsx](../../src/pages/ExportDeliveryOrderPage.jsx) | `export-do` | `pttan_export_delivery_orders` | ❌ |
| [WarehouseManagement.jsx](../../src/pages/WarehouseManagement.jsx) | `warehouse-mgmt` | — (array hardcoded di `useState`) | — |
| [VoucherManagement.jsx](../../src/pages/VoucherManagement.jsx) | `voucher-mgmt` | `PAYMENT_VOUCHERS` / `RECEIPT_VOUCHERS` | ❌ label mengklaim ada |
| [MasterFinishedGoods.jsx](../../src/pages/MasterFinishedGoods.jsx) | `master-finished-goods` | `pttan_master_finished_goods` | — |
| [MasterItemPage.jsx](../../src/pages/MasterItemPage.jsx) | `master-items` | `KEYS.ITEMS` | — |
| [MasterCustomer.jsx](../../src/pages/MasterCustomer.jsx) | `master-customers` | `KEYS.CUSTOMERS` | — |
| [MasterSupplier.jsx](../../src/pages/MasterSupplier.jsx) | `master-suppliers` | `KEYS.SUPPLIERS` | — |
| [AccountingReports.jsx](../../src/pages/AccountingReports.jsx) | `accounting-reports` | `KEYS.JOURNAL_ENTRIES` | jurnal manual |
| [ChartOfAccounts.jsx](../../src/pages/ChartOfAccounts.jsx) | `coa-setting` | `KEYS.CHART_OF_ACCOUNTS` | — |
| [SystemSettingsPage.jsx](../../src/pages/SystemSettingsPage.jsx) | `system-settings` | `pttan_company_profile` + export/import backup | — |

Status detail dan bug per halaman: [../FLOW_ANALYSIS.md](../FLOW_ANALYSIS.md).

---

## data/ — Mesin Penyimpanan

| Path | Global | Peran |
|---|---|---|
| [data/storage.js](../../data/storage.js) | `window.Storage` | 189 KB. Sumber kebenaran penyimpanan: `KEYS`, `get`/`set`, COA default, master data default, sequencer, cloud adapter, SyncGuard. Lihat [STORAGE.md](./STORAGE.md) |
| [data/firebase-sync.js](../../data/firebase-sync.js) | — | Sinkronisasi dua arah localStorage ↔ Firestore |
| [data/firestore-sync.js](../../data/firestore-sync.js) | — | Varian sync lebih tipis |
| [data/firebase-storage.js](../../data/firebase-storage.js) | — | Adapter Firebase Storage (file/gambar) |
| [data/warehouseStock.js](../../data/warehouseStock.js) | — | Kartu stok gudang — **belum dipakai app React** |
| [data/_transaction_functions.js](../../data/_transaction_functions.js) · [data/storage_temp.js](../../data/storage_temp.js) | — | Potongan sementara, identik isinya. Kandidat dihapus |

Hanya `data/storage.js` yang di-import `main.jsx`. Sisanya menunggu.

---

## modules/ — Mesin Bisnis Legacy

116 file. Yang **dimuat** `main.jsx` (14):

`auth` · `_validators` · `purchaseOrder` · `paymentVoucher` · `receiptVoucher` · `journalEntry` · `generalLedger` · `incomeStatement` · `balanceSheet` · `cashFlow` · `journalReport` · `balanceReports` · `finalReports` · `pdfExporter`

Dari 14 itu, yang benar-benar **dipanggil** halaman React hanya `purchaseOrder` (lewat `storageService`). Sisanya sudah menempel di `window` tapi menganggur — termasuk `incomeStatement`, `balanceSheet`, dan `cashFlow` yang laporannya masih di-hardcode di JSX.

102 sisanya dorman: payroll, makloon, KYC, CRM, HRD, fixed assets, produksi refinery, dst. Detail dan cara menghidupkannya: [LEGACY.md](./LEGACY.md).

---

## tests/

| Path | Isi |
|---|---|
| [tests/setup.js](../../tests/setup.js) | `setupFilesAfterEach` Jest |
| [tests/unit/](../../tests/unit/) | 25 file — mayoritas menguji modul dorman (payroll, refinery, KYC) |
| [tests/integration/](../../tests/integration/) | 2 file — `business_flows`, `payment_voucher_visibility` |

Tidak ada satu pun test untuk `src/` (React). Lihat [TESTING.md](./TESTING.md).

---

## docs/

| Path | Isi |
|---|---|
| [docs/blueprint/](./) | Blueprint ini |
| [docs/knowledge/THIS.md](../knowledge/THIS.md) | Identitas proyek, gaya developer, insight berjalan |
| [docs/knowledge/LEARN.md](../knowledge/LEARN.md) | Log koreksi & kesalahan |
| [docs/FLOW_ANALYSIS.md](../FLOW_ANALYSIS.md) | Audit alur bisnis end-to-end (diagram mermaid + temuan) |

---

## NPM Scripts

| Script | Perintah | Catatan |
|---|---|---|
| `npm run dev` | `vite` | Port 3000, auto-open |
| `npm run build` | `vite build` | Output `dist/` — dipanggil otomatis saat deploy |
| `npm test` | `jest` | Seluruh test |
| `npm run test:unit` | `jest tests/unit` | Wajib jalan bila menyentuh `modules/` atau `data/` |
| `npm run test:integration` | `jest tests/integration` | |
| `npm run test:e2e` | `cypress run` | Belum ada spec |
| `npm run serve` | `firebase serve --only hosting` | Melayani `dist/`, jalankan `build` dulu |
| `npm run deploy` | `firebase deploy` | Hosting + Firestore rules |
| `npm run deploy:hosting` | `firebase deploy --only hosting` | |

---

← [Blueprint INDEX](./INDEX.md)
