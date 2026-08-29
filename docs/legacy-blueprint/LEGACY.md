# Legacy Engine

← [Blueprint INDEX](./INDEX.md)

`modules/` berisi 116 file JavaScript vanilla (~2 MB) dari proyek **Gold Refinery** sebelumnya. Aplikasi React memakai 14 di antaranya; 102 sisanya dorman — tidak dimuat, tidak dieksekusi, tapi masih di repo dan sebagian masih di-cover `tests/unit`.

Baca halaman ini **sebelum** menulis logika bisnis baru. Peluangnya besar bahwa sesuatu yang mirip sudah ada, sudah punya test, dan tinggal disambungkan.

---

## Yang dimuat `main.jsx`

| Modul | Global | Status pemakaian |
|---|---|---|
| `purchaseOrder.js` | `window.PurchaseOrder` | ✅ dipakai — `createPurchaseOrder`, `getStoredOrders`, penomoran `PO-YYYYMM-0001`, kalkulasi landed cost |
| `journalEntry.js` | `window.JournalEntry` | ⚠️ menempel tapi tidak dipanggil — halaman React menulis `JOURNAL_ENTRIES` manual |
| `generalLedger.js` · `journalReport.js` · `balanceReports.js` · `finalReports.js` | | ⚠️ menganggur |
| `incomeStatement.js` · `balanceSheet.js` · `cashFlow.js` | | ⚠️ menganggur — tiga tab laporan di `AccountingReports` masih hardcoded padahal mesinnya sudah ada di sini |
| `paymentVoucher.js` · `receiptVoucher.js` | | ⚠️ menganggur — `VoucherManagement` menulis storage sendiri |
| `pdfExporter.js` (422 KB) | | ⚠️ menganggur — semua tombol Cetak masih `alert()` |
| `auth.js` | | ⚠️ menganggur — app React tanpa route guard |
| `_validators.js` | | ⚠️ menganggur |

Jarak antara "sudah dimuat" dan "sudah dipakai" adalah utang teknis terbesar di repo ini. Sebelum menulis fungsi laporan, jurnal, voucher, atau PDF dari nol, periksa modul di atas.

---

## Yang dorman

| Kelompok | Modul |
|---|---|
| HR & Payroll | `payroll` · `payrollSimulation` · `attendance` · `leaveManagement` · `workCalendar` · `masterEmployee` · `masterShift` · `masterDepartment` · `taxEngineTER` · `frontdesk` · `staffDashboard` |
| Refinery & produksi | `makloonService` · `productionBatch` · `productionDetail` · `productionOrder` · `productionLog` · `productionWIP` · `productionReports` · `productionYieldReport` · `refineryForms` · `refineryKPI` · `bomManagement` · `packaging` · `yieldAnalysis` · `goldDustRecovery` |
| Lab & kadar | `labTest` · `labTestRegister` · `labQualityTest` · `masterPurity` · `masterRefiningRules` · `masterKaratUI` |
| Perdagangan emas | `directSwap` (193 KB) · `swapAnalysis` · `simpleTransaction` (131 KB) · `goldSavings` · `goldBalanceReport` · `livePrice` |
| Pembelian & penerimaan | `purchaseRequisition` · `goodsReceipt` (68 KB) · `receivingReport` · `ttb` · `threeWayMatching` · `supplierInvoice` |
| Penjualan | `salesOrder` · `quotation` · `jobOrder` |
| Persediaan | `stockCard` · `stockPosition` · `stockOpeningBalance` · `inventoryValuation` · `inventoryOptimization` · `inventoryCustodyReport` · `preciousMetalInventory` · `reorderSystem` · `serializedItem` |
| CRM, KYC & risiko | `crmProspect` · `crmSalesTarget` · `customerKYC` (95 KB) · `kycAssessment` · `riskAssessment` · `riskMonitor` · `customerCard` · `supplierCard` · `clientRequests` · `clientCalculator` |
| Laporan | `additionalReports` · `analysisReports` · `arApAging` · `transactionRegisters` · `purchaseByItem` · `purchaseBySupplier` · `salesByItem` · `salesByCustomer` · `reportsMenu` · `checkGiroTracking` · `paymentSchedule` · `fixedAssets` |
| Master data | `masterBank` · `masterCustomer` · `masterSupplier` · `masterItem` · `masterWarehouse` · `masterTax` · `masterPaymentTerms` · `masterUser` · `masterRole` · `chartOfAccounts` |
| Infrastruktur | `_errorHandler` · `_journal_helpers` · `auditLog` · `settings` (85 KB) · `notificationService` · `dataCleanup` · `debugToolkit` · `syncDiagnosticUI` · `support` · `changePassword` · `firebase-auth` · `whatsappBot` · `agentOrchestrator` · `aiAdvisor` (66 KB) |

`journalEntry_new.js` adalah duplikat setengah jadi dari `journalEntry.js`. Jangan dipakai, jangan ditiru polanya.

---

## Tumpang tindih dengan halaman React

Beberapa modul legacy meliput domain yang sudah ditulis ulang di React. Bila diminta melengkapi halaman React-nya, modul lamanya adalah referensi logika terbaik yang tersedia:

| Halaman React | Modul legacy sepadan |
|---|---|
| `GoodsReceiptPage.jsx` | `goodsReceipt.js` · `receivingReport.js` · `ttb.js` |
| `VoucherManagement.jsx` | `paymentVoucher.js` · `receiptVoucher.js` |
| `AccountingReports.jsx` | `incomeStatement.js` · `balanceSheet.js` · `cashFlow.js` · `generalLedger.js` |
| `WarehouseManagement.jsx` | `stockCard.js` · `stockPosition.js` · [data/warehouseStock.js](../../data/warehouseStock.js) |
| `ChartOfAccounts.jsx` | `chartOfAccounts.js` |
| `MasterItemPage.jsx` / `MasterCustomer` / `MasterSupplier` | `masterItem.js` · `masterCustomer.js` · `masterSupplier.js` |
| `JewelryProduction.jsx` | `productionBatch.js` · `bomManagement.js` · `masterKaratUI.js` |
| `BuyingScrapMelting.jsx` | `goldDustRecovery.js` · `labTest.js` · `masterRefiningRules.js` |

Modul-modul ini menulis ke `Storage.KEYS` yang berbeda dari kunci `pttan_*` yang dipakai halaman React. Menyambungkan keduanya berarti memilih satu kunci sebagai kebenaran — keputusan yang perlu dikonfirmasi ke user, bukan diputuskan diam-diam.

---

## Cara menghidupkan modul dorman

1. Baca modulnya. Cari nama global yang dipasangnya (`window.X = …`) dan API publiknya.
2. Tambahkan `import '../modules/namaModul.js';` di [src/main.jsx](../../src/main.jsx), setelah `data/storage.js`.
3. Bungkus API-nya di [src/services/storageService.js](../../src/services/storageService.js) dengan guard `typeof window !== 'undefined' && window.X`.
4. Halaman memanggil service, bukan `window.X`.
5. Jalankan `npm run test:unit` — banyak modul ini sudah punya test yang akan menangkap regresi.

Modul legacy sering merender HTML-nya sendiri ke DOM (`innerHTML`, `document.getElementById`). Bagian itu **tidak boleh** dipakai di React — ambil logika perhitungan dan penyimpanannya saja.

---

## Aturan

- Jangan menyunting modul dorman kecuali diminta. Mengubahnya memecahkan `tests/unit` tanpa memperbaiki apa pun yang hidup.
- Jangan menghapusnya tanpa persetujuan user. Sebagian besar berisi aturan bisnis refinery yang tidak terdokumentasi di tempat lain.
- Jangan menyalin polanya ke `src/`. Gaya React di repo ini berbeda — lihat [PAGES.md](./PAGES.md).
- Bila menemukan logika yang jelas dibutuhkan (mis. penomoran berurutan di `purchaseOrder.js:130-170`), pakai ulang dari sana daripada menulis versi kedua.

---

← [Blueprint INDEX](./INDEX.md)
