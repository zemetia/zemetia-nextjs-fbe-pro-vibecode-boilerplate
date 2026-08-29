-- Pembelian jadi berbaris, dan stok berhenti mengandaikan emas.
--
-- Empat perubahan besar dalam satu migrasi, karena ketiganya saling mengunci:
--   1. `gold_*` → `metal_*` — perak masuk sebagai bahan baku, jadi nama lama berbohong
--   2. master `products` — jenis barang jadi data, bukan nilai enum
--   3. header pembelian dipecah jadi header + baris (+ sertifikat per keping)
--   4. kurs keluar dari dokumen dan pindah ke voucher pembayaran
--
-- Baris yang sudah ada dipindahkan, bukan ditinggalkan: tiap dokumen lama jadi
-- satu dokumen dengan satu baris, dan kadar/harga/beratnya dibawa apa adanya.
-- Dokumen yang sudah CONFIRMED tidak diubah nilainya oleh migrasi ini.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rename: tabel, enum, dan constraint
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "gold_lots" RENAME TO "metal_lots";
ALTER TABLE "gold_movements" RENAME TO "metal_movements";
ALTER TABLE "gold_movement_lines" RENAME TO "metal_movement_lines";
ALTER TABLE "gold_purchases" RENAME TO "metal_purchases";
ALTER TABLE "gold_purchase_deliveries" RENAME TO "metal_purchase_deliveries";

-- Postgres tidak ikut mengganti nama indeks dan constraint saat tabelnya
-- di-rename, dan Prisma membandingkan **nama**-nya — dibiarkan, setiap
-- `migrate diff` berikutnya akan melaporkan drift atas tabel yang sebenarnya
-- sudah benar. Jadi keduanya di-rename bersamaan, bukan satu per satu.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'gold\_%' LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, replace(r.indexname, 'gold_', 'metal_'));
  END LOOP;
  FOR r IN SELECT conname, conrelid::regclass AS tbl FROM pg_constraint WHERE conname LIKE 'gold\_%' LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname, replace(r.conname, 'gold_', 'metal_'));
  END LOOP;
END $$;

ALTER TYPE "GoldLotForm" RENAME TO "MetalLotForm";
ALTER TYPE "GoldMovementType" RENAME TO "MetalMovementType";
ALTER TYPE "GoldMovementStatus" RENAME TO "MetalMovementStatus";
ALTER TYPE "GoldMovementDirection" RENAME TO "MetalMovementDirection";
ALTER TYPE "GoldPurchaseType" RENAME TO "MetalPurchaseType";
ALTER TYPE "GoldPurchaseStatus" RENAME TO "MetalPurchaseStatus";
ALTER TYPE "GoldPurchasePaymentType" RENAME TO "MetalPurchasePaymentType";
ALTER TYPE "GoldPurchaseDeliveryStatus" RENAME TO "MetalPurchaseDeliveryStatus";

-- Nilai `referenceType` ikut, karena ia dibaca sebagai kunci pencarian dokumen
-- asal. Membiarkannya `GOLD_PURCHASE` berarti satu nama lagi yang harus diingat
-- selamanya hanya karena pernah begitu.
UPDATE "metal_movements" SET "referenceType" = 'METAL_PURCHASE' WHERE "referenceType" = 'GOLD_PURCHASE';
UPDATE "cash_vouchers" SET "referenceType" = 'METAL_PURCHASE' WHERE "referenceType" = 'GOLD_PURCHASE';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Master produk
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "Metal" AS ENUM ('GOLD', 'SILVER');
CREATE TYPE "ProductForm" AS ENUM ('BULLION', 'JEWELRY', 'SCRAP');
CREATE TYPE "PriceBasis" AS ENUM ('GROSS', 'FINE');

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metal" "Metal" NOT NULL,
    "form" "ProductForm" NOT NULL,
    "defaultPurityPercent" DECIMAL(7,4),
    "purityLocked" BOOLEAN NOT NULL DEFAULT false,
    "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
CREATE INDEX "products_metal_idx" ON "products"("metal");
CREATE INDEX "products_form_idx" ON "products"("form");
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- Empat produk dasar. Id-nya ditulis tetap supaya migrasi ini bisa merujuknya
-- tanpa subquery, dan supaya seeder mengenali baris yang sama lewat `code`.
INSERT INTO "products" ("id", "code", "name", "metal", "form", "defaultPurityPercent", "purityLocked", "requiresCertificate", "updatedAt") VALUES
  ('prd_gold_bullion', 'PRD-0001', 'Emas Batangan',  'GOLD',   'BULLION', 99.9900, true,  true,  CURRENT_TIMESTAMP),
  ('prd_silver_bullion', 'PRD-0002', 'Perak Batangan', 'SILVER', 'BULLION', 99.9000, true,  true,  CURRENT_TIMESTAMP),
  ('prd_gold_jewelry', 'PRD-0003', 'Emas Perhiasan', 'GOLD',   'JEWELRY', NULL,      false, false, CURRENT_TIMESTAMP),
  ('prd_gold_scrap', 'PRD-0004', 'Emas Scrap',     'GOLD',   'SCRAP',   NULL,      false, false, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sumbu logam di stok
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "metal_lots" ADD COLUMN "metal" "Metal";
ALTER TABLE "metal_lots" ADD COLUMN "productId" TEXT;

-- Semua lot yang ada lahir sebelum perak dikenal, jadi semuanya emas.
UPDATE "metal_lots" SET "metal" = 'GOLD';
ALTER TABLE "metal_lots" ALTER COLUMN "metal" SET NOT NULL;

UPDATE "metal_lots" SET "productId" = 'prd_gold_bullion' WHERE "form" = 'BAR';
UPDATE "metal_lots" SET "productId" = 'prd_gold_jewelry' WHERE "form" = 'JEWELRY';
UPDATE "metal_lots" SET "productId" = 'prd_gold_scrap'   WHERE "form" = 'SCRAP';
-- BAL sengaja dibiarkan tanpa produk: bal adalah rakitan internal, tidak pernah dibeli.

ALTER TABLE "metal_lots" ADD CONSTRAINT "metal_lots_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "metal_lots_metal_idx" ON "metal_lots"("metal");
CREATE INDEX "metal_lots_productId_idx" ON "metal_lots"("productId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Pembelian: header + baris
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "metal_purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "priceBasis" "PriceBasis" NOT NULL,
    "pricePerGram" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "metal_purchase_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metal_purchase_items_purchaseId_lineNo_key" ON "metal_purchase_items"("purchaseId", "lineNo");
CREATE INDEX "metal_purchase_items_purchaseId_idx" ON "metal_purchase_items"("purchaseId");
CREATE INDEX "metal_purchase_items_productId_idx" ON "metal_purchase_items"("productId");

ALTER TABLE "metal_purchase_items" ADD CONSTRAINT "metal_purchase_items_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "metal_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metal_purchase_items" ADD CONSTRAINT "metal_purchase_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tiap dokumen lama jadi satu baris. Harga dibawa apa adanya beserta dasarnya:
-- dokumen lama menghargai per gram **murni** tanpa kecuali, jadi dasarnya FINE —
-- termasuk untuk batangan. Menuliskannya GROSS akan mengubah nilai dokumen yang
-- sudah dikonfirmasi tanpa ada seorang pun yang memutuskan begitu.
INSERT INTO "metal_purchase_items" (
    "id", "purchaseId", "lineNo", "productId",
    "weightGram", "purityPercent", "fineWeightGram",
    "priceBasis", "pricePerGram", "amount", "updatedAt"
)
SELECT
    'mpi_' || p."id",
    p."id",
    1,
    CASE
      WHEN p."goodsType" = 'JEWELRY' THEN 'prd_gold_jewelry'
      ELSE 'prd_gold_bullion'
    END,
    p."weightGram",
    p."purityPercent",
    p."fineWeightGram",
    'FINE',
    p."pricePerGram",
    p."goodsAmount",
    CURRENT_TIMESTAMP
FROM "metal_purchases" p;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Sertifikat per keping — pindah dari `barSeries` dan dari baris penerimaan
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "metal_purchase_delivery_lines" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metal_purchase_delivery_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metal_purchase_delivery_lines_deliveryId_purchaseItemId_key" ON "metal_purchase_delivery_lines"("deliveryId", "purchaseItemId");
CREATE INDEX "metal_purchase_delivery_lines_deliveryId_idx" ON "metal_purchase_delivery_lines"("deliveryId");
CREATE INDEX "metal_purchase_delivery_lines_purchaseItemId_idx" ON "metal_purchase_delivery_lines"("purchaseItemId");

ALTER TABLE "metal_purchase_delivery_lines" ADD CONSTRAINT "metal_purchase_delivery_lines_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "metal_purchase_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metal_purchase_delivery_lines" ADD CONSTRAINT "metal_purchase_delivery_lines_purchaseItemId_fkey"
  FOREIGN KEY ("purchaseItemId") REFERENCES "metal_purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Setiap penerimaan lama menerima satu-satunya baris dokumennya.
INSERT INTO "metal_purchase_delivery_lines" (
    "id", "deliveryId", "purchaseItemId", "weightGram", "purityPercent", "fineWeightGram"
)
SELECT 'mpdl_' || d."id", d."id", 'mpi_' || d."purchaseId", d."weightGram", d."purityPercent", d."fineWeightGram"
FROM "metal_purchase_deliveries" d;

CREATE TABLE "metal_purchase_item_certificates" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "certificateNumber" TEXT,
    "refinerName" TEXT,
    "deliveryLineId" TEXT,
    "lotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "metal_purchase_item_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metal_purchase_item_certificates_lotId_key" ON "metal_purchase_item_certificates"("lotId");
CREATE UNIQUE INDEX "metal_purchase_item_certificates_itemId_serialNumber_key" ON "metal_purchase_item_certificates"("itemId", "serialNumber");
CREATE INDEX "metal_purchase_item_certificates_itemId_idx" ON "metal_purchase_item_certificates"("itemId");
CREATE INDEX "metal_purchase_item_certificates_deliveryLineId_idx" ON "metal_purchase_item_certificates"("deliveryLineId");

ALTER TABLE "metal_purchase_item_certificates" ADD CONSTRAINT "metal_purchase_item_certificates_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "metal_purchase_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metal_purchase_item_certificates" ADD CONSTRAINT "metal_purchase_item_certificates_deliveryLineId_fkey"
  FOREIGN KEY ("deliveryLineId") REFERENCES "metal_purchase_delivery_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "metal_purchase_item_certificates" ADD CONSTRAINT "metal_purchase_item_certificates_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "metal_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keping yang sudah pernah diterima: baris penerimaan lama sudah menyimpan seri,
-- berat, dan sertifikatnya per keping, jadi ia yang jadi sumber — bukan
-- `barSeries` di header, yang cuma daftar nomor tanpa berat.
INSERT INTO "metal_purchase_item_certificates" (
    "id", "itemId", "serialNumber", "weightGram", "certificateNumber", "refinerName", "deliveryLineId", "lotId", "updatedAt"
)
SELECT
    'mpic_' || i."id",
    'mpi_' || d."purchaseId",
    i."serialNumber",
    i."weightGram",
    i."certificateNumber",
    i."refinerName",
    'mpdl_' || d."id",
    l."id",
    CURRENT_TIMESTAMP
FROM "gold_purchase_delivery_items" i
JOIN "metal_purchase_deliveries" d ON d."id" = i."deliveryId"
LEFT JOIN "metal_lots" l ON l."serialNumber" = i."serialNumber";

-- Seri yang tercatat di header tapi belum pernah datang: dibuat sebagai keping
-- tanpa berat yang diketahui (0) dan tanpa penerimaan. Beratnya memang belum
-- pernah ditimbang, dan menebaknya dengan pembagian rata adalah persis kesalahan
-- yang dibuang saat `planLots()` berhenti membagi rata.
INSERT INTO "metal_purchase_item_certificates" ("id", "itemId", "serialNumber", "weightGram", "updatedAt")
SELECT
    'mpic_hdr_' || p."id" || '_' || s."ord"::text,
    'mpi_' || p."id",
    s."serial",
    0,
    CURRENT_TIMESTAMP
FROM "metal_purchases" p
CROSS JOIN LATERAL unnest(p."barSeries") WITH ORDINALITY AS s("serial", "ord")
WHERE NOT EXISTS (
    SELECT 1 FROM "metal_purchase_item_certificates" c
    WHERE c."itemId" = 'mpi_' || p."id" AND c."serialNumber" = s."serial"
);

DROP TABLE "gold_purchase_delivery_items";

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Header pembelian: kolom baru, kolom lama dibuang
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "metal_purchases" ADD COLUMN "supplierInvoiceNumber" TEXT;

ALTER TABLE "metal_purchases" DROP COLUMN "goodsType";
ALTER TABLE "metal_purchases" DROP COLUMN "exchangeRate";
ALTER TABLE "metal_purchases" DROP COLUMN "pricePerGram";
ALTER TABLE "metal_purchases" DROP COLUMN "weightGram";
ALTER TABLE "metal_purchases" DROP COLUMN "purityPercent";
ALTER TABLE "metal_purchases" DROP COLUMN "fineWeightGram";
ALTER TABLE "metal_purchases" DROP COLUMN "goodsAmountIdr";
ALTER TABLE "metal_purchases" DROP COLUMN "totalIdr";
ALTER TABLE "metal_purchases" DROP COLUMN "barSeries";

DROP INDEX IF EXISTS "metal_purchases_goodsType_idx";
DROP TYPE "GoldPurchaseGoodsType";

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Penerimaan: kurir, dan berat pindah ke barisnya
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "metal_purchase_deliveries" ADD COLUMN "courierPartnerId" TEXT;
ALTER TABLE "metal_purchase_deliveries" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "metal_purchase_deliveries" ADD COLUMN "receivedByName" TEXT;
ALTER TABLE "metal_purchase_deliveries" ADD COLUMN "courierCostIdr" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "metal_purchase_deliveries" DROP COLUMN "weightGram";
ALTER TABLE "metal_purchase_deliveries" DROP COLUMN "purityPercent";
ALTER TABLE "metal_purchase_deliveries" DROP COLUMN "fineWeightGram";

CREATE INDEX "metal_purchase_deliveries_courierPartnerId_idx" ON "metal_purchase_deliveries"("courierPartnerId");

ALTER TABLE "metal_purchase_deliveries" ADD CONSTRAINT "metal_purchase_deliveries_courierPartnerId_fkey"
  FOREIGN KEY ("courierPartnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Peran kurir & kurs di voucher
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "partners" ADD COLUMN "isCourier" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "partners_isCourier_idx" ON "partners"("isCourier");

-- Lantai "minimal satu peran" ikut mengenal peran ketiga. Tanpa ini, jasa
-- ekspedisi yang tidak pernah kita beli maupun jual barangnya tidak punya cara
-- untuk berdiri sebagai baris yang sah.
ALTER TABLE "partners" DROP CONSTRAINT IF EXISTS "partners_role_check";
ALTER TABLE "partners" ADD CONSTRAINT "partners_role_check"
  CHECK ("isSupplier" OR "isCustomer" OR "isCourier");

ALTER TABLE "cash_vouchers" ADD COLUMN "referenceCurrencyCode" TEXT;
ALTER TABLE "cash_vouchers" ADD COLUMN "referenceExchangeRate" DECIMAL(18,6);
