# Analisis: Prisma Database vs Legacy — Project migration-pfelix

> Dibuat: 2026-09-01 · Status: analisis, belum ada perubahan schema
> Tujuan: memetakan kesenjangan antara database Prisma (baru) dan model data aplikasi legacy (Vite + localStorage/Firestore), untuk migrasi yang **tidak mengubah alur bisnis maupun alur program**.

---

## 1. Verdict (ringkasan eksekutif)

**Schema Prisma saat ini BUKAN turunan dari aplikasi legacy proyek ini.** Ia diimpor utuh sebagai satu commit baseline (`f53bb52`, "initial Next.js 16 + TypeScript + Prisma migration baseline") dari branch `main` repo *tan-erp* — aplikasi Next.js yang berbeda dengan model data berbeda — lalu dimodifikasi bertahap. Akibatnya:

1. **Seluruh domain penjualan (lokal & ekspor) tidak punya model Prisma sama sekali** — SO, Invoice, DO lokal & ekspor hanya hidup di localStorage lewat view legacy yang di-embed.
2. **Hampir separuh domain pembelian/gudang/produksi/kasir juga belum punya model**: scrap purchase, settlement produksi, transfer vault, transaksi perak/alloy, buku cek/giro, company profile, master finished goods, kartu stok.
3. **Di domain yang sudah punya model (PO, TTB, voucher, jurnal), vocabulary-nya berbeda** — status, format nomor dokumen, cara melacak pembayaran, dan konsep (PO/DP split, IN_TRANSIT) — sehingga memindahkan data legacy apa adanya akan mengubah arti dokumen.
4. **Semua migration SQL dihapus** (`git status` menunjukkan 30+ file `D`), database dibuat dengan `prisma db push` ("No migration found ... Database schema is up to date!"). Tidak ada riwayat schema yang bisa direproduksi.
5. **Dua COA hidup berdampingan** (259 kode di legacy `storage.js` vs 264 akun di seed Prisma). Kode penting (2110/2111/1135/11903/1121-1) sudah sepakat, tapi keduanya adalah daftar terpisah yang dirawat sendiri-sendiri.

Inilah kenapa setiap permintaan "sesuaikan Prisma dengan legacy" gagal: **schema-nya menjawab pertanyaan desain yang berbeda dari yang ditanyakan legacy**, dan tidak pernah ada peta field legacy→Prisma yang menunjukkan bahwa sebagian besar entitas tidak punya tujuan.

---

## 2. Yang diperiksa (bukti)

| Sumber | Isi |
|---|---|
| `CLAUDE.md`, `docs/knowledge/THIS.md`, `docs/knowledge/LEARN.md` | Aturan proyek, riwayat keputusan, koreksi lampau |
| `legacy/src/services/storageService.js` (2.990 baris) | Bentuk dokumen asli: default objects + fungsi simpan tiap entitas |
| `legacy/data/storage.js` (5.778 baris) | Storage engine, KEYS, COA, sequencer |
| `prisma/schema/*.prisma` (17 file) | 35 model + enum lengkap |
| `prisma/seeders/data/accounts.ts` | 264 akun COA Prisma |
| `src/services/*.service.ts`, `src/lib/*.ts` | Lapisan service/domain Prisma |
| `src/app/admin/**` (73 halaman) | Peta halaman: Prisma-native vs view legacy di-embed |
| `src/dto/*.js` | DTO client (bentuk legacy modern) |
| `git log`, `git status`, `npx prisma migrate status` | Riwayat schema, file migration terhapus, status DB |
| `.env` | `DATABASE_URL=postgresql://postgres:***@localhost:5432/erp_tan_felix` |

`prisma migrate status` (read-only) → `No migration found in prisma/migrations` + `Database schema is up to date!` → workflow `db push`, tanpa riwayat.

---

## 3. Arsitektur sekarang: dua dunia dalam satu aplikasi

Project ini adalah hibrida. Halaman admin di `src/app/admin/` terbagi dua:

**Dunia A — Prisma/Postgres (halaman baru):**
PO Emas Lokal (`/admin/purchases/local`), TTB (`/admin/purchases/goods-receipt`), Jurnal Umum (`/admin/accounting/journals`), Approval, Roles, Users, Units, Inventory Lots, sebagian PR & Partners & Vouchers & Production.

**Dunia B — view legacy di-embed (localStorage/Firestore), 22 halaman:**

| Halaman | View legacy | Data |
|---|---|---|
| `/admin/purchases/import` | `LmImportTrading` | `erp_purchase_orders` |
| `/admin/purchases/scrap` | `BuyingScrapMelting` | `pttan_scrap_purchases` |
| `/admin/purchases/requests` | `PurchaseRequestPage` | `pttan_purchase_requests` |
| `/admin/inventory` | `WarehouseManagement` | agregasi + `pttan_vault_transfers`, `stock_cards` |
| `/admin/inventory/models` | `MasterFinishedGoods` | `pttan_master_finished_goods` |
| `/admin/inventory/silver-alloy` | `SilverAlloyPage` | `pttan_silver_transactions` |
| `/admin/production` | `JewelryProduction` | `pttan_production_spk`, `pttan_production_settlements` |
| `/admin/finance/cheques` | `MasterChequePage` | `pttan_cheque_books` |
| `/admin/finance/vouchers` | `VoucherManagement` | `payment_vouchers`, `receipt_vouchers`, `erp_vouchers` |
| `/admin/sales/local` | `LocalSalesTrading` | `pttan_local_sales` |
| `/admin/sales/orders` | `ExportSalesOrderPage` | `pttan_export_sales_orders` |
| `/admin/sales/invoicing` | `LocalInvoicing` | `pttan_local_invoices` |
| `/admin/sales/export` | `ExportInvoicing` | `pttan_export_invoices` |
| `/admin/sales/delivery-order` | `LocalDeliveryOrderPage` | `pttan_local_delivery_orders` |
| `/admin/sales/export-delivery-order` | `ExportDeliveryOrderPage` | `pttan_export_delivery_orders` |
| `/admin/accounts` | `ChartOfAccounts` | `erp_chart_of_accounts` |
| `/admin/partners`, `/admin/partners/customers` | `MasterSupplier`, `MasterCustomer` | `erp_suppliers`, `erp_customers` |
| `/admin/supplies` | `MasterItemPage` | `erp_items` |
| `/admin/system/settings` | `SystemSettingsPage` | `pttan_company_profile`, backup JSON |
| `/admin` | `Dashboard` | agregasi seluruh storage |
| `/admin/reports/accounting` | `AccountingReports` | jurnal legacy |

**Konsekuensi nyata:** PO Emas Impor dan PO Emas Lokal hidup di database yang berbeda (`/purchases/import` = localStorage, `/purchases/local` = Postgres). Satu menu, dua gudang data. Laporan keuangan Prisma (jurnal baru) dan laporan legacy (AccountingReports) tidak akan pernah cocok selama dua sumber jurnal ini hidup.

---

## 4. Model data legacy (sumber kebenaran bisnis)

`legacy/src/services/storageService.js` `KEYS` — 28 entitas yang benar-benar dipakai halaman React:

| # | Kunci | Entitas | Bentuk inti (field) |
|---|---|---|---|
| 1 | `erp_journal_entries` | Jurnal | `id, entryNumber, date, description, lines[{accountCode, accountName, debit, credit, description}], createdAt` |
| 2 | `erp_chart_of_accounts` | COA | `code, name, type(header/detail), category, balance` |
| 3 | `erp_purchase_orders` | PO Impor & Standar | `poNumber, supplier, supplierCode, category(GOLD_IMPORT), type, isImport, currency, exchangeRate, pricePerOzUSD, goldWeightGram, goldWeightOz, totalUSD, total, totalAmountIDR, totalLandedCostIDR, pph22AmountIDR, customsPaidAmountIDR, paidAmountIDR, remainingBalanceIDR, paymentStatus(UNPAID/PARTIALLY_PAID/PAID), status(teks bebas), supplierInvoiceNo, targetVault, pibNo, items[], paymentHistory[]` |
| 4 | `pttan_local_purchases` | PO Emas Lokal | `receiptNo, poNumber, orderDate, supplierName, itemName, quantityGrams, pricePerGramIDR, totalAmount, paidAmountIDR, remainingBalanceIDR, paymentStatus, barSerialNumbers, status(teks), isVaultReceived, courierName, verifiedSignatures[]` |
| 5 | `pttan_scrap_purchases` | Pembelian Scrap | `receiptNo, spkMeltingNo, date, supplierName, itemDescription, grossWeight, xrfPurity, estimatedFineGold, pricePerFineGram, totalAmount, paymentMethod, creditAccount, targetVault(1152), status` |
| 6 | `pttan_goods_receipts` | TTB | `grnNumber, poNumber, supplierDoNumber, pibNo, date, supplierName, targetVault, safeBoxSlot, securitySealNo, itemDescription, barSerialNumbers, assayCertificateNo, documentWeightGram, receivedWeightGram, weightDiscrepancyGram, unitPriceIDRPerGram, totalValueIDR, status` |
| 7 | `pttan_purchase_requests` | PR | `prNumber, date, requestedBy, department, category(GOLD_IMPORT/GOLD_LOCAL/CHEMICALS_REFINERY/...), recommendedSupplier, estimatedWeightGram, estimatedAmountIDR, justification, status(PENDING_APPROVAL/APPROVED/CONVERTED TO PO), convertedPoNumber, convertedPoType, convertedAt` |
| 8 | `pttan_local_sales` | Penjualan Lokal | `invoiceNo, soNumber, doNumber, customerPONumber, date, customerId/Name/Phone/Address, paymentMode(cash/credit/dp), paymentTerms, paymentSourceAccount, itemCode/Name, sourceVault, quantityGrams, unitPriceIDR, totalAmountIDR, barSerialNumbers, deliveryMethod, courierName, recipientName, paymentStatus, deliveryStatus, cogsAmountIDR, grossProfitIDR, ownerApprovedBy, ownerApproved, notes` |
| 9 | `pttan_local_sales_orders` | SO Lokal | `soNumber, customerPONumber, date, customer*, item*, sourceVault, quantityGrams, unitPriceIDR, totalAmountIDR, status(CONFIRMED), paymentTerms, notes` |
| 10 | `pttan_local_delivery_orders` | SJ Lokal | `doNumber, invoiceNo, soNumber, customerPONumber, date, customer*, item*, sourceVault, netWeightGram, grossWeightGram, barSerialNumbers, securitySealNo, boxCount, deliveryMethod, courierName, recipientName, status(DELIVERED), cogsAmountIDR, notes` |
| 11 | `pttan_local_invoices` | Faktur Lokal | `invoiceNo, soNumber, doNumber, customerPONumber, date, dueDate, customer*, item*, quantityGrams, unitPriceIDR, subtotalIDR, downPaymentIDR, taxFacility(BEBAS PPN PMK 48/2023), taxAmountIDR, totalAmountIDR, paymentMode, paymentSourceAccount, paymentStatus, barSerialNumbers, ownerApproved, notes` |
| 12 | `pttan_export_sales_orders` | SO Ekspor | `soNumber, customerPONumber, date, customerId, buyerName, country, currency(USD), exchangeRate, itemDescription, karat, netWeightGram, grossWeightGram, unitPriceUSDPerGram, totalUSD, totalIDR, paymentTerms, taxFacility(PPN 0% PASAL 4B), status` |
| 13 | `pttan_export_invoices` | Invoice Ekspor | `invoiceNo, invoiceDate, date, dueDate, soNumber, doNumber, customerPONumber, buyerName/Address, country, currency, exchangeRate, pebNumber, awbNumber, taxFacility, itemDescription, netWeightGram, grossWeightGram, unitPriceUSD, totalUSD, totalIDR, paidAmountUSD/IDR, remainingBalanceUSD, paymentStatus, status, dheBcaAccount(1111-USD)` |
| 14 | `pttan_export_delivery_orders` | DO Ekspor | `doNumber, customerPONumber, invoiceNo, soNumber, goldCertificateNo, purityCertificateNo, date, buyerName, country, courierName(Brinks), awbNumber, pebNumber, securitySealNo, boxCount, itemDescription, netWeightGram, grossWeightGram, status(SHIPPED / IN TRANSIT)` |
| 15 | `pttan_production_spk` | SPK Produksi | `spkNo, date, buyerName, jewelryType, targetKarat, grossWeight, fineGoldNeeded, masterAlloyNeeded, status(IN_WIP/COMPLETED), notes` |
| 16 | `pttan_production_settlements` | Settlement (JO) | `joNumber, spkNo, date, jewelryOutputWeight, scrapReturnWeight, goldLossWeight, laborFeeIDR, karat, status` |
| 17 | `pttan_vault_transfers` | Transfer Vault | `date, fromVaultId/Name, fromAccount, toVaultId/Name, toAccount, itemCode/Name, quantityGrams, estimatedValueIDR, transferNotes` + auto-jurnal |
| 18 | `pttan_silver_transactions` | Perak/Alloy | RECEIPT: `supplierName, docNo, itemName, purity, weightGrams, pricePerGram, totalValueIDR, sourceAccount, targetVaultAccount(1153)`; ALLOY_ADDITION: `targetVault, goldBarRef, goldInitialWeightGram, goldPurityInitial, silverWeightGram, silverPurity, silverPricePerGram, totalSilverValueIDR, totalFinalWeightGram, finalEstimatedPurity` |
| 19 | `pttan_cheque_books` | Buku Cek/BG | `bookNumber, bankCode, bankName, accountNumber, currency, seriesPrefix, startNumber, endNumber, totalLeaves, maxLimitPerCheque, totalBookLimit, issuedDate, leaves[{checkNumber, status(USED/AVAILABLE/VOID), voucherNo, payee, amount, dueDate, isCleared, notes}]` |
| 20 | `payment_vouchers` + `receipt_vouchers` + `erp_vouchers` | BBK/BKK/BBM/BKM | `voucherNumber, voucherType(BBK/BKK/BBM/BKM), date, selectedPONumber, paymentCategory(PO_PRINCIPAL/CUSTOMS_DUTY_PPH22/LOGISTICS_HANDLING/OTHER_EXPENSE), categoryLabel, payee, payer, bankAccountCode, bankAccountName, bankReferenceNo, accountCode, accountName, debitAccountCode, debitAccountName, amount, description, status(APPROVED & PAID/RECEIVED & CLEARED), isCleared, journalLines` |
| 21 | `erp_customers` / `erp_suppliers` | Master Mitra | Customer: `id, name, code, type(LOCAL_RETAIL_WHOLESALE/LOCAL_CORPORATE/EXPORT_OVERSEAS), country, contactPerson, phone, email, address, taxFacility(NON_BKP_BEBAS_PPN_PMK48_2023/PPN_0_PERSEN_PASAL_4B_UU_PPN), bankAccountUSD, status`; Supplier: `id, name, code, category(LM_LOKAL/LM_LOKAL_SILVER/LM_IMPORT/SCRAP_LEBURAN/CHEMICALS_REFINERY), country, contactPerson, phone, email, address, bankAccount, status` |
| 22 | `erp_items` | Master Barang Emas | master item |
| 23 | `pttan_master_finished_goods` | Master Perhiasan Jadi | `id, sku, name, type, karat, purity, goldColor, stdWeightGram, laborFeeIDRPerGram, hsCode, inventoryAccount(1160)` |
| 24 | `pttan_company_profile` | Profil Perusahaan | `companyName, logoUrl, address, phone, email, npwp, nibPeb, currencyDefault` |
| 25 | `erp_warehouses` / `pttan_warehouses` | Master Vault | `id(WH-VAULT-01..06), name, code, location, manager, status, account(1157/1158/11502/1160/1152/1153), accountName` |
| 26 | `erp_warehouse_stock` / `stock_cards` / `erp_warehouse_stock_movements` | Stok & Kartu Stok | dihitung dinamis `calculateVaultStockPosition()` dari 6 sumber mutasi (TTB, PO Lokal, SPK, Settlement, DO Ekspor, Transfer Vault) + scrap + silver |
| 27 | `erp_transaction_counters` | Counter nomor | `JRN/PUR/SAL/VCH/PRQ/GRN/SPK` → format `KODE-YYYY-NNNN` |
| 28 | `erp_current_session`, `erp_system_settings` | Sesi & setting | role-based access, backup |

Ciri khas legacy: **tanpa schema, tanpa relasi, semua array inline** (`items`, `paymentHistory`, `leaves`, `lines`), status memakai **teks bebas** yang bisa berubah kapan saja, dan nomor dokumen **berbasis tahun** (`PO-IMP-2026-001`).

---

## 5. Model Prisma saat ini (35 model, 17 file)

`User, Account, Session, VerificationToken, Role, Permission, RolePermission, LedgerAccount, JournalEntry, JournalLine, ApprovalRequest, Currency, Country, CashVoucher, CashVoucherFundLine, CashVoucherLine, MetalLot, StorageLocation, MetalMovement, MetalMovementLine, Partner, Product, ProductionOrder, PurchaseOrder, PurchaseOrderCharge, PurchaseOrderItem, PurchaseOrderItemCertificate, GoodsReceipt, GoodsReceiptCharge, GoodsReceiptLine, PurchaseRequest, PurchaseRequestItem, Supply, UnitCategory, Unit`

Domain yang terlayani: auth/RBAC, COA + jurnal, approval, kas/bank (voucher), persediaan logam (lot + mutasi), mitra, produk, produksi, pembelian (PO + TTB), PR, supply, unit.

---

## 6. Kesenjangan utama: entitas legacy tanpa padanan Prisma

| Entitas legacy | Padanan di Prisma | Status |
|---|---|---|
| SO Ekspor (`pttan_export_sales_orders`) | **tidak ada** | ❌ belum ada model |
| Invoice Ekspor (`pttan_export_invoices`) | **tidak ada** | ❌ belum ada model |
| DO Ekspor (`pttan_export_delivery_orders`) | **tidak ada** | ❌ belum ada model |
| Penjualan Lokal (`pttan_local_sales`) | **tidak ada** (tidak ada `sales.prisma`) | ❌ belum ada model |
| SO Lokal (`pttan_local_sales_orders`) | **tidak ada** | ❌ belum ada model |
| SJ Lokal (`pttan_local_delivery_orders`) | **tidak ada** | ❌ belum ada model |
| Faktur Lokal (`pttan_local_invoices`) | **tidak ada** | ❌ belum ada model |
| Pembelian Scrap (`pttan_scrap_purchases`) | `PurchaseOrderType.SCRAP_LOCAL` ada, tapi semantik scrap (XRF purity, `estimatedFineGold`, `pricePerFineGram`, `spkMeltingNo`, vault 1152) tidak punya kolom | ⚠️ sebagian |
| Settlement Produksi (`pttan_production_settlements`) | `ProductionOrder` ada tapi tanpa `jewelryOutputWeight/scrapReturnWeight/goldLossWeight/laborFeeIDR` | ⚠️ sebagian |
| Transfer Vault (`pttan_vault_transfers`) | `MetalMovementType.TRANSFER` ada tapi alur legacy (pilih vault asal→tujuan + akun COA otomatis + auto-jurnal) tidak punya representasi | ⚠️ sebagian |
| Transaksi Perak/Alloy (`pttan_silver_transactions`) | `Metal=SILVER` + `MetalLotForm` ada, tapi `ALLOY_ADDITION` (campur perak ke emas, hitung kadar akhir) tidak punya tipe mutasi | ⚠️ sebagian |
| Buku Cek/BG (`pttan_cheque_books`) | `CashVoucher.paymentMethod=CHEQUE/GIRO` ada, tapi siklus buku/lembar (USED/AVAILABLE/VOID, isCleared, limit) tidak ada | ⚠️ sebagian |
| Profil Perusahaan (`pttan_company_profile`) | **tidak ada** | ❌ belum ada model |
| Master Perhiasan Jadi (`pttan_master_finished_goods`) | `Product` ada tapi tanpa `karat/goldColor/stdWeightGram/laborFeeIDRPerGram/hsCode/inventoryAccount` | ⚠️ sebagian |
| Master Vault (`erp_warehouses`, akun 1157/1158/11502/1160/1152/1153) | `StorageLocation` ada tapi **sengaja TIDAK menyimpan kode akun** — komentar schema: "Tidak menyimpan kode akun ... diturunkan dari kombinasi" | ⚠️ beda alur |
| Kartu Stok / posisi vault | `MetalMovement` + `metal-stock.ts` ada, tapi sumber mutasi legacy (6 dokumen) belum semua punya model | ⚠️ sebagian |
| Pelacakan pembayaran PO (`paidAmountIDR/remainingBalanceIDR/paymentStatus/paymentHistory` di dokumen) | Prisma menghitung dari Σ voucher POSTED (`referenceType/referenceId`) — **tidak ada kolom di PurchaseOrder** | ⚠️ beda alur |

**Rangkuman: 8 entitas tanpa model sama sekali (seluruh domain penjualan + company profile), 9 entitas hanya separuh.** Dari 28 entitas legacy, yang punya padanan relatif utuh hanya: jurnal, COA, PO (impor/lokal, sebagian), TTB (sebagian), PR (sebagian), voucher kas (sebagian), mitra (sebagian), item/produk (sebagian), SPK (sebagian).

---

## 7. Perbedaan kosakata yang MENGUBAH alur (bukan sekadar struktur)

Ini bagian yang paling sering dilewatkan AI sebelumnya. "Struktur lebih bagus" boleh; **arti dokumen dan urutan kejadian tidak boleh berubah.**

### 7.1 Status dokumen
- Legacy PO lokal: `ORDER_PLACED_UNPAID` → `PAID_IN_TRANSIT_COURIER` → `RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)` (teks bebas, alur 2 tahap 1159→1157).
- Prisma: `PurchaseOrderStatus DRAFT/CONFIRMED/VOID` + `GoodsReceiptStatus IN_TRANSIT/CONFIRMED` + `PurchaseOrderPaymentType PO/DP`.
- **Konsep `paymentType PO/DP` (Direct Payment) TIDAK ADA di legacy.** Legacy selalu PO + voucher pembayaran terpisah. Menambah DP mengubah cara dokumen lahir.
- Status voucher: legacy `APPROVED & PAID` / `RECEIVED & CLEARED` vs Prisma `DRAFT/PENDING_APPROVAL/APPROVED/POSTED/VOID` — alur persetujuan baru yang tidak ada di legacy.

### 7.2 Format nomor dokumen
- Legacy: `JRN-2026-0001`, `PO-IMP-2026-001`, `PO-LOK-2026-001`, `GRN-2026-001`, `SPK-PROD-2026-001`, `BBK-2026-001`, `PR-2026-001`, `INV-LOKAL-2026-001`, `INV-EXP-2026-001`, `SO-EXP-2026-001`, `DO-EXP-2026-001`, `SJ-LOKAL-2026-001`, `NOTA-*` — **berbasis tahun, counter global** (`KODE-YYYY-NNNN`).
- Prisma: `PO-LM-202608-0001`, `TT-202608-0001`, `BKK-202608-0042`, `PR-202608-0001`, `SPK-202608-0001` — **direset tiap bulan, prefiks beda**.
- Nomor dokumen dicetak di PDF dan dirujuk antar dokumen. Mengubah format = dokumen lama tidak bisa dirujuk balik tanpa peta konversi.

### 7.3 Pelacakan pembayaran
- Legacy: kolom `paidAmountIDR`, `remainingBalanceIDR`, `paymentStatus`, `paymentHistory[]` **di dalam dokumen PO** — modal "Riwayat Cicilan", KPI, dan guard-rail kasir membaca ini.
- Prisma: `PurchaseOrder` **tidak punya kolom pembayaran**; progres = Σ voucher POSTED yang menunjuk dokumen (`referenceType`/`referenceId` + FK `purchaseId`).
- Keduanya sah secara desain, tapi **alur programnya berbeda**: komponen yang membaca `remainingBalanceIDR` langsung tidak akan menemukan datanya.

### 7.4 Kategori pembayaran
- Legacy: `PO_PRINCIPAL` / `CUSTOMS_DUTY_PPH22` / `LOGISTICS_HANDLING` / `OTHER_EXPENSE` (4 kategori, punya label & akun default sendiri, termasuk PPh 22 → `1135`/`11903`).
- Prisma: `VoucherCategory GENERAL_EXPENSE/EMPLOYEE/SUPPLIER` + `VoucherPaymentStage PRE_RECEIPT/POST_RECEIPT/OTHER`.
- Kosakata berbeda; **PPh 22 sebagai kategori pembayaran yang memengaruhi sisa hutang komersial tidak punya padanan langsung.**

### 7.5 Vault & kode akun
- Legacy: master vault (`erp_warehouses`) membawa kode akun (`1157/1158/11502/1160/1152/1153`); TTB & transfer memilih vault → akun ikut serta; `calculateVaultStockPosition` memetakan vault→akun.
- Prisma: `StorageLocation` **sengaja tidak menyimpan akun**; akun diturunkan dari `(PurchaseOrder.type, Product.form)` via `resolveReceiptAccount()`. Lokasi dan akun buku besar dipisah.
- **Ini perubahan alur**: di legacy, pilihan lokasi menentukan akun; di Prisma, akun ditentukan tipe dokumen. Hasil jurnal bisa sama untuk kasus normal, tapi aturan mainnya berbeda (dan `WH-VAULT-06` perak `1153` vs `StorageLocationType` yang tidak punya mapping akun).

### 7.6 COA
- Legacy `legacy/data/storage.js`: 259 kode unik, struktur `code/name/type/category/balance`.
- Prisma `prisma/seeders/data/accounts.ts`: 264 akun, struktur tree (`level`, `parentId`, `type` enum 6 kelas).
- Kode penting sudah sepakat (`2110` Hutang Usaha, `2111` Uang Titipan, `1135`, `11903`, `1121-1`, `2150`), **tapi daftarnya dirawat terpisah** — halaman legacy membaca localStorage, halaman Prisma membaca Postgres. LEARN 2026-09-01 sudah mencatat bahaya ini.

### 7.7 Berat & satuan
- Legacy: berat selalu gram di seluruh dokumen (`quantityGrams`, `grossWeight`, `netWeightGram`); troy ounce hanya muncul sebagai tampilan konversi di PO impor (`goldWeightOz` dihitung dari gram).
- Prisma: `WeightUnit GRAM/TROY_OUNCE` + mesin konversi multi-anchor (`unit.prisma`, 23 satuan, 4 kategori).
- Struktur ini kompatibel (gram tetap satuan simpan), asalkan tampilan lama dipertahankan. Aman.

### 7.8 Jurnal
- Legacy: `lines[{accountCode, accountName, debit, credit}]` — nama akun ikut tersimpan.
- Prisma: `JournalLine.accountId` FK + `memo`; nama akun diambil dari COA.
- Ini **perbaikan yang justru benar** (sesuai koreksi LEARN 2026-08-28: nama akun harus dari COA, bukan disalin ke baris jurnal). Kompatibel untuk migrasi: `accountCode` legacy → `accountId` Prisma lewat lookup COA.

---

## 8. Akar masalah: kenapa usaha AI sebelumnya selalu gagal

1. **Baseline diimpor dari proyek lain.** Commit `f53bb52` membawa schema yang dirancang untuk aplikasi *tan-erp main branch* — perusahaan yang sama, tapi aplikasi dan model data yang berbeda. Tidak pernah ada langkah "ekstrak model data legacy → rancang schema" di proyek ini.
2. **AI memperbaiki desain, bukan menyamakan.** Komentar di schema Prisma penuh keputusan desain yang bagus secara absolut — "header tidak punya kolom berat", "kurs milik pembayaran bukan dokumen", "biaya selalu baris", "lokasi tidak menyimpan akun", "paymentType PO/DP" — tapi **setiap keputusan itu menjauhkan schema dari legacy**. Yang user minta adalah cermin relasional dari legacy, bukan redesain.
3. **Tidak ada peta field legacy→Prisma.** Tanpa tabel pemetaan, tidak terlihat bahwa 8 entitas (seluruh penjualan) tidak punya tujuan sama sekali. AI mengerjakan yang terlihat (PO, TTB, jurnal) dan mengabaikan yang tidak terlihat.
4. **Dua sumber kebenaran dibiarkan hidup.** Halaman legacy di-embed dan halaman Prisma berjalan bersamaan; setiap perbaikan di satu sisi menambah selisih dengan sisi lain.
5. **Riwayat schema dibuang.** Semua migration dihapus dan DB di-push langsung — tidak ada baseline yang bisa dipulihkan, tidak ada jejak keputusan.

---

## 9. Invarian yang HARUS dijaga (alur bisnis & alur program legacy)

Berdasarkan `docs/flow/*.md`, `THIS.md`, dan bentuk dokumen legacy — ini yang tidak boleh berubah saat schema diselaraskan:

1. **Alur pembelian lokal 2 tahap**: bayar → Debet `1159` (transit kurir) → fisik tiba → Debet `1157` Kredit `1159`. Status `PAID_IN_TRANSIT_COURIER` → `RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)`.
2. **Alur impor**: uang muka `1135` + PPh 22 0,25% (`1135`/`11903`) sebelum fisik; TTB tiba → vault `1158`, eliminasi `1135`, sisa ke `2110`/hutang.
3. **4 kolom TTD** pada dokumen serah terima (kurir, penyerah, penerima vault, pemilik/direktur).
4. **Otorisasi Direktur** memblokir submit transaksi tunai (checkbox).
5. **Kategori pembayaran 4 nilai** `PO_PRINCIPAL/CUSTOMS_DUTY_PPH22/LOGISTICS_HANDLING/OTHER_EXPENSE` dengan pengaruhnya ke sisa hutang.
6. **Pelacakan pembayaran per dokumen**: `paidAmountIDR`, `remainingBalanceIDR`, `paymentStatus`, `paymentHistory` — dibaca modal Riwayat Cicilan, KPI, dan guard-rail kasir.
7. **Rantai dokumen penjualan lokal**: SO → SJ (DO) → Invoice, dengan `customerPONumber` mengalir dan DP `2150`.
8. **Rantai dokumen ekspor**: SO (price fixing USD) → Invoice (PPN 0%, PEB/AWB, piutang `1132`) → DO (HPP `5115` vs `1160`), DHE ke `1111-USD`.
9. **Konservasi massa settlement produksi**: output + retur scrap + susut = bahan awal; jurnal `11502` → `1160` + `1152` + `5141` + ongkos.
10. **Penomoran dokumen** `KODE-YYYY-NNNN` berbasis tahun (atau peta konversi eksplisit + nomor lama dipertahankan).
11. **COA tunggal** — satu daftar akun yang dipakai SEMUA modul (legacy view maupun Prisma page), `type: detail` untuk jurnal.
12. **Jurnal wajib di transaksi DB yang sama**, debit = kredit, nama akun dari COA.
13. **Berat dalam gram**; uang numerik mentah; tanggal `YYYY-MM-DD`.
14. **Vault legacy 6 brankas** (1157/1158/11502/1160/1152/1153) dengan pemetaan akun yang tetap bisa dipilih operator.

---

## 10. Keputusan yang harus diambil user

| # | Keputusan | Opsi | Konsekuensi |
|---|---|---|---|
| A | **COA mana sumber kebenaran?** | (1) pakai seed Prisma 264 akun, legacy view ikut membacanya; (2) pakai COA legacy 259, seed Prisma diganti; (3) rekonsiliasi manual jadi satu daftar final | Menentukan semua jurnal & laporan. Harus diputuskan SEBELUM schema diselaraskan |
| B | **Nomor dokumen** | (1) pertahankan format `KODE-YYYY-NNNN` (counter global tahunan) di Prisma; (2) pakai format bulanan baru + kolom `legacyNumber` untuk rujukan lama | Dokumen lama (PDF, referensi silang) tetap bisa dirujuk |
| C | **Pelacakan pembayaran** | (1) tambahkan kolom `paidAmountIDR/remainingBalanceIDR/paymentStatus` + tabel `PurchaseOrderPaymentHistory` di Prisma (cermin legacy); (2) pertahankan hitung-dari-voucher dan tulis ulang semua UI | (1) = alur program legacy utuh; (2) = alur program baru |
| D | **Status dokumen** | (1) pertahankan status legacy (teks/state machine lama) sebagai enum; (2) pakai status Prisma + peta konversi | Menentukan perilaku tombol, filter, badge |
| E | **Konsep PO/DP** | (1) buang `paymentType` (semua = PO, pembayaran via voucher); (2) pertahankan | (1) = persis legacy |
| F | **Vault & akun** | (1) tambahkan `accountId` (atau `accountCode`) ke `StorageLocation` seperti legacy; (2) pertahankan turunan dari tipe | (1) = operator pilih vault → akun ikut, persis legacy |

Rekomendasi saya: **A1, B1, C1, D1, E1, F1** — semuanya ke arah "cermin relasional legacy", konsisten dengan permintaan user.

---

## 11. Rencana perbaikan yang saya usulkan (setelah keputusan user)

**Fase 0 — Baselines (1 sesi):**
1. Buat migration baseline baru (`prisma migrate dev --name baseline_legacy_alignment` atau `migrate reset` + baseline) — kembalikan riwayat migration yang sudah dihapus.
2. Bekukan COA (keputusan A) → satu seed, satu sumber.

**Fase 1 — Schema alignment (inti):**
3. Buat tabel pemetaan lengkap 28 entitas legacy → model Prisma (field per field), sebagai dokumen `docs/migration/LEGACY_TO_PRISMA_MAP.md`.
4. Sesuaikan model yang ada ke semantik legacy: status enum legacy, kolom pembayaran PO, kategori pembayaran 4 nilai, format nomor `KODE-YYYY-NNNN` (atau kolom nomor legacy), akun vault.
5. Tambah model baru yang belum ada: `ExportSalesOrder`, `ExportInvoice`, `ExportDeliveryOrder`, `LocalSalesOrder`, `LocalSale`, `LocalDeliveryOrder`, `LocalInvoice`, `ScrapPurchase`, `ProductionSettlement`, `VaultTransfer`, `SilverTransaction`/`AlloyAddition`, `ChequeBook`+`ChequeLeaf`, `CompanyProfile`, `FinishedGood`, `Warehouse` (dengan `accountCode`).
6. Hapus/arsipkan konsep yang tidak ada di legacy (`paymentType` bila keputusan E1; sesuaikan `StorageLocation` bila F1).

**Fase 2 — ETL data:**
7. Script migrasi: baca JSON localStorage/Firestore (format backup `SystemSettingsPage`) → tulis ke Prisma dengan pemetaan field + konversi nomor/status/akun + lookup COA. Verifikasi: jumlah record, saldo COA, debit=credit, posisi vault per akun cocok dengan `calculateVaultStockPosition` legacy.

**Fase 3 — Konsolidasi halaman:**
8. Pindahkan view legacy satu per satu ke Prisma (mulai dari yang tidak punya model sama sekali: penjualan lokal & ekspor), dengan verifikasi `lint`/`type-check`/`build`/`test` hijau tiap langkah.
9. Hapus fallback storageService per modul yang sudah pindah; `legacy/` tetap read-only.

---

## 12. Status implementasi penyelarasan (2026-09-01)

Setelah analisis di atas, penyelarasan schema Prisma → legacy sudah diimplementasikan
dan diverifikasi. Ringkasannya:

### Model baru (17) — cermin relasional dokumen legacy

| File baru | Model | Legacy key |
|---|---|---|
| `sales.prisma` | `LocalSalesOrder` | `pttan_local_sales_orders` |
| `sales.prisma` | `LocalDeliveryOrder` | `pttan_local_delivery_orders` |
| `sales.prisma` | `LocalInvoice` | `pttan_local_invoices` |
| `sales.prisma` | `LocalSale` + `LocalSalePayment` | `pttan_local_sales` (+ `paymentHistory[]`) |
| `sales.prisma` | `ExportSalesOrder` | `pttan_export_sales_orders` |
| `sales.prisma` | `ExportInvoice` | `pttan_export_invoices` |
| `sales.prisma` | `ExportDeliveryOrder` | `pttan_export_delivery_orders` |
| `scrap.prisma` | `ScrapPurchase` | `pttan_scrap_purchases` |
| `cheque.prisma` | `ChequeBook` + `ChequeLeaf` | `pttan_cheque_books` (+ `leaves[]`) |
| `company.prisma` | `CompanyProfile` | `pttan_company_profile` |
| `finished-good.prisma` | `FinishedGood` | `pttan_master_finished_goods` |
| `inventory.prisma` | `VaultTransfer` | `pttan_vault_transfers` |
| `inventory.prisma` | `SilverTransaction` | `pttan_silver_transactions` |
| `production.prisma` | `ProductionSettlement` | `pttan_production_settlements` |
| `purchase.prisma` | `PurchaseOrderPayment` | `paymentHistory[]` di PO |

### Model existing yang diselaraskan

- **`PurchaseOrder`** — ditambah pelacakan pembayaran legacy: `paymentStatus`
  (UNPAID/PARTIALLY_PAID/PAID), `paidAmountIdr`, `remainingBalanceIdr`,
  `customsPaidAmountIdr`, `logisticsPaidAmountIdr`, `otherExpensesPaidAmountIdr`,
  `lastPaymentVoucher`, `lastPaymentDate`, relasi `payments`.
- **`GoodsReceipt`** — ditambah field legacy TTB: `supplierDoNumber`, `pibNo`,
  `sppbNo`, `mawbNo`, `safeBoxSlot`, `securitySealNo`, `barSerialNumbers`,
  `assayCertificateNo`, `documentWeightGram`, `receivedWeightGram`,
  `weightDiscrepancyGram`.
- **`StorageLocation`** — ditambah pemetaan akun legacy: `accountCode`,
  `accountName`, `locationName`, `manager` (cermin `erp_warehouses`).
- **`PurchaseRequest`** — ditambah `requesterName`, `recommendedSupplier`,
  `totalEstimatedAmountIdr`, `convertedPoNumber`, `conversionDate`,
  `convertedBy`; enum kategori + `CHEMICALS_REFINERY`, `SAFETY_GA`.
- **`CashVoucher.category`** — enum + `PO_PRINCIPAL`, `CUSTOMS_DUTY_PPH22`,
  `LOGISTICS_HANDLING`, `OTHER_EXPENSE` (kategori pembayaran PO legacy).
- **`PurchaseOrderType`** — `SCRAP_LOCAL` (sudah ada) kini dipetakan ke DTO/VO.

### Prinsip yang dipegang

- **Satu dokumen legacy = satu model.** Tidak ada penggabungan/redesain (mis.
  SO lokal + ekspor tidak digabung), karena alur program legacy memisahkannya.
- **Status legacy teks bebas dipertahankan `String?`** apa adanya (`SHIPPED / IN
  TRANSIT`, `RECEIVED & STORED IN SCRAP VAULT`, dst.) — bukan diubah jadi enum
  karangan. Enum hanya untuk nilai yang memang daftar tetap di legacy.
- **Rantai dokumen disambung lewat NOMOR** (`soNumber`/`doNumber`/
  `invoiceNumber`/`spkNo`), persis legacy — bukan FK baru.
- **Field denormalisasi dipertahankan** (customerName, supplierName, vaultName
  dst.) supaya dokumen tercetak tetap terbaca meski master berubah.

### Perbaikan drift implementasi (type-check 82 error → 0)

- Delegate Prisma `prisma.metalPurchase*` → `prisma.purchaseOrder*` /
  `prisma.goodsReceipt*` (schema model sudah dinamai `PurchaseOrder`/
  `GoodsReceipt` sejak implementasi sebelumnya, tapi lib/API belum diikutkan).
- Katalog permission (`src/lib/permissions.ts`) diperluas ke kosakata legacy:
  `local-purchases`, `import-purchases`, `scrap-purchases`, `goods-receipts`
  (menggantikan `metal-purchases`/`metal-purchase-deliveries`); `approval.ts`
  ikut diselaraskan. Seeder akan otomatis sync key baru & prune key lama saat
  `npm run db:seed`.
- DTO/VO enum diselaraskan (`SCRAP_LOCAL`, kategori voucher & PR baru).
- Test `metal-purchase-journal.test.ts` yang asersinya keliru (jumlah
  debit+credit = 2× sisi) diperbaiki jadi menguji keseimbangan yang benar.

### Verifikasi (2026-09-01)

- `npx prisma format` ✓ · `npx prisma validate` ✓ · `npx prisma generate` ✓
- `npx prisma db push` → "Your database is now in sync" ✓ (workflow db push
  repo ini; migration baseline belum dibuat — lihat catatan teknis)
- `npm run type-check` → 0 error ✓
- `npm run lint` → 0 warnings ✓
- `npm run test:run` → 39/39 files, 323/323 tests ✓
- `npm run build` → sukses (exit 0) ✓
- `npm run db:seed` → "Permissions: 156 in sync · Roles: 10 in sync" ✓

### Halaman yang sudah pindah ke Prisma (2026-09-01, sesi lanjutan)

- **`/admin/purchases/import`** — view legacy `LmImportTrading` (localStorage)
  diganti `ImportPurchasesView` (Prisma): form PO impor (supplier luar negeri,
  kurs USD/SGD, kargo, baris barang) + tabel + konfirmasi/hapus/batal, gaya UI
  identik dengan PO Lokal. API `POST/GET /api/metal-purchases` diperluas
  menerima `pib_number`/`sppb_number`/`mawb_number`/`courier_name`/
  `courier_mandate_number` (field impor di dokumen; form TTB tetap yang
  menampilkan PIB/SPPB/MAWB sesuai THIS.md).
- **`/admin/purchases/requests`** — view legacy `PurchaseRequestPage`
  (localStorage) diganti `PurchaseRequestsView` (Prisma, komponen yang sudah
  ada): KPI + filter + tabel + tombol ke form `/new`. Form `new`/`[id]`/`[id]/edit`
  sudah Prisma sejak sebelumnya.
- Permission katalog sudah di-seed ke DB (156 key), role purchasing/direktur
  mendapat key legacy (`import-purchases:*`, `local-purchases:*`,
  `scrap-purchases:*`, `goods-receipts:*`).

### Yang BELUM dikerjakan (butuh keputusan/sesi berikutnya)

1. **Migration baseline** — ganti `db push` dengan `migrate dev` + baseline
   agar riwayat schema bisa direproduksi.
2. **Seeder untuk model baru** — master data (COA 264 akun sudah ada; tambah
   vault 6 brankas, finished goods, company profile) + `npm run db:seed`.
3. **ETL data legacy → Prisma** — script baca backup JSON (`SystemSettingsPage`)
   → tulis ke model baru sesuai peta field (Fase 2 di bagian 11).
4. **Konsolidasi halaman** — pindahkan view legacy (penjualan, scrap, cek,
   gudang, produksi, kasir) ke service Prisma satu per satu (Fase 3).
5. **Keputusan A–F di bagian 10** yang belum dijawab eksplisit — implementasi
   ini mengikuti rekomendasi (cermin legacy), tapi COA & format nomor tetap
   perlu konfirmasi.

---

## 13. Lampiran: catatan teknis

- `search_files` bermasalah dengan path `D:\` di host ini — analisis ini memakai `grep`/`read_file` via terminal (sesuai pitfall di skill prisma-schema-audit).
- `DATABASE_URL` lokal: `erp_tan_felix` di `localhost:5432`, `schema=public`.
- `prisma migrate status` → "No migration found ... up to date" = workflow `db push`; jangan jalankan `migrate dev` sebelum baseline dibuat ulang.
- LEARN 2026-09-01 mencatat kolom FK (`purchaseId/deliveryId/cashVoucherId`) sempat ditambahkan via DDL manual tanpa migration — bukti tambahan bahwa riwayat schema tidak dikelola.
