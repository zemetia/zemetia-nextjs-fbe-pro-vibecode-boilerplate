-- Pembelian lokal dapat dua sumbu baru dan satu lapis baru.
--
-- 1. `SCRAP` berhenti jadi rail tersendiri. Scrap adalah perhiasan tua/rusak yang
--    dibeli untuk dilebur — bentuk barangnya sama persis dengan perhiasan (berat
--    kotor + kadar, harga per gram murni), jadi nilai enum tersendiri hanya
--    menduakan satu hal yang sama. Barisnya jadi LOCAL + goodsType JEWELRY.
-- 2. `goodsType` (BULLION/JEWELRY) dan `paymentType` (PO/DP) jadi sumbu di atas
--    rail lokal, sejajar dengan `SalesOrder.goodsType` di sisi penjualan.
-- 3. `purityPercent` jadi wajib supaya berat murni punya satu rumus tanpa cabang:
--    `berat × kadar / 100`.
-- 4. Penerimaan barang (`gold_purchase_deliveries`) jadi lapis realisasi di atas
--    lapis komitmen — berat per batang dan sertifikatnya hidup di sana.

-- CreateEnum
CREATE TYPE "GoldPurchaseGoodsType" AS ENUM ('BULLION', 'JEWELRY');
CREATE TYPE "GoldPurchasePaymentType" AS ENUM ('PO', 'DP');
CREATE TYPE "GoldPurchaseDeliveryStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- AlterTable — sumbu baru
ALTER TABLE "gold_purchases"
  ADD COLUMN "goodsType" "GoldPurchaseGoodsType" NOT NULL DEFAULT 'BULLION',
  ADD COLUMN "paymentType" "GoldPurchasePaymentType" NOT NULL DEFAULT 'PO';

UPDATE "gold_purchases" SET "goodsType" = 'JEWELRY' WHERE "type" = 'SCRAP';

-- Kadar jadi wajib. Baris lama diberi kadar yang **cocok dengan berat murni yang
-- sudah tersimpan** (100), bukan 99,99 — memberi kadar baru pada dokumen lama
-- akan mengubah nilai dokumen yang sudah dikonfirmasi tanpa ada yang memutuskan
-- begitu. Dokumen batangan lokal yang baru mengisi 99,99 dari form.
UPDATE "gold_purchases" SET "purityPercent" = 100 WHERE "purityPercent" IS NULL;

ALTER TABLE "gold_purchases" ALTER COLUMN "purityPercent" SET NOT NULL;

-- Postgres tidak bisa mengurangi nilai enum, jadi polanya bikin tipe baru →
-- ALTER … USING CASE → DROP TYPE → rename (pola yang sama dengan partner_origin).
CREATE TYPE "GoldPurchaseType_new" AS ENUM ('IMPORT', 'LOCAL');

ALTER TABLE "gold_purchases"
  ALTER COLUMN "type" TYPE "GoldPurchaseType_new"
  USING (CASE WHEN "type" = 'IMPORT' THEN 'IMPORT' ELSE 'LOCAL' END)::text::"GoldPurchaseType_new";

DROP TYPE "GoldPurchaseType";

ALTER TYPE "GoldPurchaseType_new" RENAME TO "GoldPurchaseType";

-- CreateIndex
CREATE INDEX "gold_purchases_goodsType_idx" ON "gold_purchases"("goodsType");
CREATE INDEX "gold_purchases_paymentType_idx" ON "gold_purchases"("paymentType");

-- CreateTable — penerimaan barang
CREATE TABLE "gold_purchase_deliveries" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "GoldPurchaseDeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    "weightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,

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

    CONSTRAINT "gold_purchase_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gold_purchase_delivery_items" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "certificateNumber" TEXT,
    "refinerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_purchase_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_purchase_deliveries_number_key" ON "gold_purchase_deliveries"("number");
CREATE INDEX "gold_purchase_deliveries_purchaseId_idx" ON "gold_purchase_deliveries"("purchaseId");
CREATE INDEX "gold_purchase_deliveries_status_idx" ON "gold_purchase_deliveries"("status");
CREATE INDEX "gold_purchase_deliveries_date_idx" ON "gold_purchase_deliveries"("date");
CREATE INDEX "gold_purchase_delivery_items_deliveryId_idx" ON "gold_purchase_delivery_items"("deliveryId");

-- AddForeignKey
ALTER TABLE "gold_purchase_deliveries" ADD CONSTRAINT "gold_purchase_deliveries_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "gold_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gold_purchase_deliveries" ADD CONSTRAINT "gold_purchase_deliveries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gold_purchase_deliveries" ADD CONSTRAINT "gold_purchase_deliveries_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gold_purchase_deliveries" ADD CONSTRAINT "gold_purchase_deliveries_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gold_purchase_delivery_items" ADD CONSTRAINT "gold_purchase_delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "gold_purchase_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dokumen yang sudah dikonfirmasi emasnya memang sudah masuk gudang, jadi tiap
-- satunya diberi satu penerimaan penuh yang menunjuk mutasi RECEIPT-nya. Tanpa
-- ini progres pengiriman dokumen lama akan terbaca 0% padahal barangnya sudah di
-- brankas. Barisnya tidak diberi rincian per keping: seri batangan lama hidup di
-- lot-nya, dan mengarang berat per keping di sini justru mengulangi pembagian
-- rata yang tabel ini dibuat untuk menggantikan.
INSERT INTO "gold_purchase_deliveries" (
    "id", "number", "status", "purchaseId", "date",
    "weightGram", "purityPercent", "fineWeightGram",
    "notes", "movementId",
    "createdById", "confirmedById", "confirmedAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'TT-' || to_char(p."date", 'YYYYMM') || '-' ||
      lpad(row_number() OVER (PARTITION BY to_char(p."date", 'YYYYMM') ORDER BY p."number")::text, 4, '0'),
    'CONFIRMED',
    p."id",
    p."date",
    p."weightGram",
    p."purityPercent",
    p."fineWeightGram",
    'Dibuat otomatis saat penerimaan dipisah dari dokumen pembelian.',
    (
      SELECT m."id" FROM "gold_movements" m
      WHERE m."referenceType" = 'GOLD_PURCHASE' AND m."referenceId" = p."id"
      ORDER BY m."createdAt" ASC
      LIMIT 1
    ),
    p."createdById",
    COALESCE(p."confirmedById", p."createdById"),
    COALESCE(p."confirmedAt", p."createdAt"),
    CURRENT_TIMESTAMP
FROM "gold_purchases" p
WHERE p."status" = 'CONFIRMED';

-- AlterTable — voucher menunjuk dokumen yang dibayarnya, supaya progres
-- pembayaran bisa dihitung dari kas dan bukan dari kolom kedua yang harus dijaga.
ALTER TABLE "cash_vouchers"
  ADD COLUMN "referenceType" TEXT,
  ADD COLUMN "referenceId" TEXT;

CREATE INDEX "cash_vouchers_referenceType_referenceId_idx" ON "cash_vouchers"("referenceType", "referenceId");
