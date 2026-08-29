-- Order penjualan (PO customer) — lapis komitmen di depan penjualan.
--
-- Dokumen ini menyimpan apa yang *dipesan*; apa yang benar-benar dikirim akan
-- hidup di dokumen pengiriman yang menunjuk baris ini. Ekspor/lokal sengaja
-- tidak dikolomkan (dijawab negara mitra), dan kurs juga tidak (order adalah
-- komitmen — nilai rupiahnya baru ada saat barang dikirim dan saat uang
-- diterima).

CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');
CREATE TYPE "SalesGoodsType" AS ENUM ('JEWELRY', 'BULLION');
CREATE TYPE "WeightUnit" AS ENUM ('GRAM', 'TROY_OUNCE');

CREATE TABLE "sales_orders" (
  "id"     TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',

  -- Milik customer, bukan milik kita: bebas bentuk dan sengaja tanpa unique.
  "customerPoNumber" TEXT,

  "partnerId" TEXT NOT NULL,
  "date"      DATE NOT NULL,

  "goodsType"     "SalesGoodsType" NOT NULL DEFAULT 'JEWELRY',
  "purityPercent" DECIMAL(7,4) NOT NULL,

  "currencyCode" TEXT NOT NULL,

  "weightUnit"     "WeightUnit" NOT NULL DEFAULT 'GRAM',
  "weightGram"     DECIMAL(14,4) NOT NULL,
  "fineWeightGram" DECIMAL(14,4) NOT NULL,

  "pricePerUnit" DECIMAL(18,4) NOT NULL,
  "totalAmount"  DECIMAL(18,2) NOT NULL,

  "notes" TEXT,

  "createdById"   TEXT NOT NULL,
  "confirmedById" TEXT,
  "confirmedAt"   TIMESTAMP(3),
  "voidedById"    TEXT,
  "voidedAt"      TIMESTAMP(3),
  "voidReason"    TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_orders_number_key" ON "sales_orders"("number");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");
CREATE INDEX "sales_orders_date_idx" ON "sales_orders"("date");
CREATE INDEX "sales_orders_partnerId_idx" ON "sales_orders"("partnerId");
CREATE INDEX "sales_orders_goodsType_idx" ON "sales_orders"("goodsType");

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_currencyCode_fkey"
  FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
