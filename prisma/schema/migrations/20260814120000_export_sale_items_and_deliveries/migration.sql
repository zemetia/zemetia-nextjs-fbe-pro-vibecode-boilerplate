-- Penjualan ekspor menyusul bentuk pembelian: header + baris + lapis kiriman.
--
-- `export_sales` adalah dokumen terakhir yang masih memampatkan satu dokumen jadi
-- satu barang — bentuk yang sudah ditinggalkan pembelian di
-- `20260813180000_metal_products_and_purchase_items`. Empat perubahan, dan
-- semuanya cerminan sisi pembelian yang dibaca dari arah sebaliknya:
--
--   1. baris barang (`export_sale_items`) — satu invoice boleh memuat dua model
--      perhiasan dengan kadar berbeda
--   2. lapis kiriman (`export_sale_deliveries` + baris + lot) — satu dokumen bisa
--      berangkat bertahap, dan lot yang keluar **ditunjuk**, tidak diketik
--   3. biaya per kiriman (`export_sale_delivery_charges`) — freight dan asuransi
--      baru punya angka saat barangnya berangkat
--   4. kurs keluar dari dokumen — invoice adalah komitmen; rupiah baru punya arti
--      saat uangnya masuk, dan kursnya milik voucher penerimaan
--
-- Dokumen lama dipindahkan, bukan ditinggalkan. Dua hal yang perlu diketahui
-- pembacanya:
--
--   * Dokumen lama **tidak pernah mencatat kadar**, jadi barisnya dibawa sebagai
--     berat kotor berkadar 100% dengan dasar harga GROSS. Nilainya karena itu
--     persis sama dengan sebelumnya (`pricePerGram × weightGram = goodsAmount`);
--     berat murninya sengaja sama dengan berat kotor karena berat kotor itulah
--     satu-satunya angka yang pernah tercatat — menebak kadarnya akan
--     mengubah arti dokumen yang sudah dikonfirmasi.
--   * PEB dan AWB pindah ke kiriman, sedangkan dokumen lama tidak punya kiriman
--     (modul lama memang tidak pernah menyentuh stok). Nomornya karena itu
--     dititipkan ke `notes` alih-alih dihapus: nomor Bea Cukai yang hilang tidak
--     bisa dicari lagi di mana pun.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Baris barang
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "export_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
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

    CONSTRAINT "export_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_sale_items_saleId_lineNo_key" ON "export_sale_items"("saleId", "lineNo");
CREATE INDEX "export_sale_items_saleId_idx" ON "export_sale_items"("saleId");
CREATE INDEX "export_sale_items_productId_idx" ON "export_sale_items"("productId");

ALTER TABLE "export_sale_items" ADD CONSTRAINT "export_sale_items_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "export_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_sale_items" ADD CONSTRAINT "export_sale_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tiap dokumen lama jadi satu baris perhiasan. Lihat catatan kadar di atas.
INSERT INTO "export_sale_items" (
    "id", "saleId", "lineNo", "productId",
    "weightGram", "purityPercent", "fineWeightGram",
    "priceBasis", "pricePerGram", "amount", "updatedAt"
)
SELECT
    'esi_' || s."id",
    s."id",
    1,
    'prd_gold_jewelry',
    s."weightGram",
    100,
    s."weightGram",
    'GROSS',
    s."pricePerGram",
    s."goodsAmount",
    CURRENT_TIMESTAMP
FROM "export_sales" s;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Header: nomor PO buyer masuk, kolom barang & kurs keluar
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "export_sales" ADD COLUMN "buyerPoNumber" TEXT;

-- Nomor pabean dititipkan ke catatan sebelum kolomnya hilang.
UPDATE "export_sales"
SET "notes" = TRIM(BOTH E' \n' FROM
      COALESCE("notes" || E'\n', '')
      || 'Dokumen lama — '
      || COALESCE('PEB ' || "pebNumber", 'tanpa PEB')
      || COALESCE(' · AWB ' || "awbNumber", '')
    )
WHERE "pebNumber" IS NOT NULL OR "awbNumber" IS NOT NULL;

ALTER TABLE "export_sales"
  DROP COLUMN "pebNumber",
  DROP COLUMN "awbNumber",
  DROP COLUMN "exchangeRate",
  DROP COLUMN "weightGram",
  DROP COLUMN "pricePerGram",
  DROP COLUMN "goodsAmountIdr";

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lapis kiriman
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "ExportSaleDeliveryStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

CREATE TABLE "export_sale_deliveries" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ExportSaleDeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "saleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "courierPartnerId" TEXT,
    "pebNumber" TEXT,
    "awbNumber" TEXT,
    "shippedByName" TEXT,
    "notes" TEXT,
    "movementId" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_sale_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_sale_deliveries_number_key" ON "export_sale_deliveries"("number");
CREATE INDEX "export_sale_deliveries_saleId_idx" ON "export_sale_deliveries"("saleId");
CREATE INDEX "export_sale_deliveries_status_idx" ON "export_sale_deliveries"("status");
CREATE INDEX "export_sale_deliveries_date_idx" ON "export_sale_deliveries"("date");
CREATE INDEX "export_sale_deliveries_courierPartnerId_idx" ON "export_sale_deliveries"("courierPartnerId");

ALTER TABLE "export_sale_deliveries" ADD CONSTRAINT "export_sale_deliveries_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "export_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_sale_deliveries" ADD CONSTRAINT "export_sale_deliveries_courierPartnerId_fkey"
  FOREIGN KEY ("courierPartnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sale_deliveries" ADD CONSTRAINT "export_sale_deliveries_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sale_deliveries" ADD CONSTRAINT "export_sale_deliveries_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sale_deliveries" ADD CONSTRAINT "export_sale_deliveries_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "export_sale_delivery_lines" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_sale_delivery_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_sale_delivery_lines_deliveryId_saleItemId_key"
  ON "export_sale_delivery_lines"("deliveryId", "saleItemId");
CREATE INDEX "export_sale_delivery_lines_deliveryId_idx" ON "export_sale_delivery_lines"("deliveryId");
CREATE INDEX "export_sale_delivery_lines_saleItemId_idx" ON "export_sale_delivery_lines"("saleItemId");

ALTER TABLE "export_sale_delivery_lines" ADD CONSTRAINT "export_sale_delivery_lines_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "export_sale_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_sale_delivery_lines" ADD CONSTRAINT "export_sale_delivery_lines_saleItemId_fkey"
  FOREIGN KEY ("saleItemId") REFERENCES "export_sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "export_sale_delivery_lots" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "grossWeightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_sale_delivery_lots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_sale_delivery_lots_lineId_idx" ON "export_sale_delivery_lots"("lineId");
CREATE INDEX "export_sale_delivery_lots_lotId_idx" ON "export_sale_delivery_lots"("lotId");
CREATE INDEX "export_sale_delivery_lots_locationId_idx" ON "export_sale_delivery_lots"("locationId");

ALTER TABLE "export_sale_delivery_lots" ADD CONSTRAINT "export_sale_delivery_lots_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "export_sale_delivery_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_sale_delivery_lots" ADD CONSTRAINT "export_sale_delivery_lots_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "metal_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sale_delivery_lots" ADD CONSTRAINT "export_sale_delivery_lots_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "export_sale_delivery_charges" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amountIdr" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_sale_delivery_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_sale_delivery_charges_deliveryId_lineNo_key"
  ON "export_sale_delivery_charges"("deliveryId", "lineNo");
CREATE INDEX "export_sale_delivery_charges_deliveryId_idx" ON "export_sale_delivery_charges"("deliveryId");

ALTER TABLE "export_sale_delivery_charges" ADD CONSTRAINT "export_sale_delivery_charges_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "export_sale_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
