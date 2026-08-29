-- Penjualan dapat sumbu PO/DP dan lapis realisasinya sendiri.
--
-- 1. `paymentType` (PO/DP) di order penjualan — sumbu yang sama dengan
--    `GoldPurchase.paymentType`, dibaca dari arah sebaliknya. Prefiks nomor
--    mengikutinya, jadi kwitansi punya deretnya sendiri.
-- 2. Surat jalan (`sales_deliveries`) jadi lapis realisasi di atas lapis
--    komitmen: apa yang dikirim hidup terpisah dari apa yang dipesan, karena
--    penjualan lokal berjalan bertahap dan "sisa yang belum dikirim" tidak punya
--    tempat hidup kalau keduanya dimampatkan jadi satu baris.
-- 3. Barisnya (`sales_delivery_items`) **menunjuk lot yang ada di stok**, bukan
--    seri yang diketik bebas seperti sisi pembelian. Barang masuk memang belum
--    ada di gudang saat dicatat; barang keluar sudah.
--
-- `export_sales` sengaja **tidak** disentuh: peleburannya dibangun sebagai jalur
-- baru dan modul ekspor yang sekarang tetap jalan apa adanya sampai diputuskan
-- untuk dipensiunkan.

-- CreateEnum
CREATE TYPE "SalesOrderPaymentType" AS ENUM ('PO', 'DP');
CREATE TYPE "SalesDeliveryStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- AlterTable
ALTER TABLE "sales_orders"
  ADD COLUMN "paymentType" "SalesOrderPaymentType" NOT NULL DEFAULT 'PO';

CREATE INDEX "sales_orders_paymentType_idx" ON "sales_orders"("paymentType");

-- CreateTable
CREATE TABLE "sales_deliveries" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "SalesDeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "orderId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    "weightGram" DECIMAL(14,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,

    "pebNumber" TEXT,
    "awbNumber" TEXT,
    "carrierName" TEXT,
    "vehicleNumber" TEXT,
    "recipientName" TEXT,

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

    CONSTRAINT "sales_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_delivery_items" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "grossWeightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,

    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_deliveries_number_key" ON "sales_deliveries"("number");
CREATE INDEX "sales_deliveries_orderId_idx" ON "sales_deliveries"("orderId");
CREATE INDEX "sales_deliveries_status_idx" ON "sales_deliveries"("status");
CREATE INDEX "sales_deliveries_date_idx" ON "sales_deliveries"("date");
CREATE INDEX "sales_delivery_items_deliveryId_idx" ON "sales_delivery_items"("deliveryId");
CREATE INDEX "sales_delivery_items_lotId_idx" ON "sales_delivery_items"("lotId");
CREATE INDEX "sales_delivery_items_locationId_idx" ON "sales_delivery_items"("locationId");

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_delivery_items" ADD CONSTRAINT "sales_delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_delivery_items" ADD CONSTRAINT "sales_delivery_items_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "gold_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_delivery_items" ADD CONSTRAINT "sales_delivery_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
