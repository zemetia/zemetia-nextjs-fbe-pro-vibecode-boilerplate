-- Biaya pembelian berhenti jadi kolom dan jadi baris di penerimaan.
--
-- Tiga kolom tetap (`importDutyIdr`, `freightInsuranceIdr` di dokumen dan
-- `courierCostIdr` di penerimaan) hanya benar selama daftarnya tidak pernah
-- bertambah; biaya berikutnya — handling, sewa brankas, jasa uji kadar — berarti
-- satu migrasi dan satu field form lagi. Yang berbeda antar biaya cuma namanya
-- dan angkanya, jadi keduanya data.
--
-- Tempatnya **penerimaan, bukan dokumen**: bea masuk baru punya angka saat
-- barangnya masuk pabean, dan satu PO yang dikirim tiga kali membayar ongkosnya
-- tiga kali — meneruskan alasan yang sama yang menaruh kurir di penerimaan.
--
-- Nilai lama dipindahkan, tidak dibuang: ongkos kurir jadi baris di
-- penerimaannya sendiri, sedangkan bea masuk & freight dokumen menempel ke
-- penerimaan **paling awal** milik dokumen itu (satu-satunya penerimaan yang
-- pasti ada saat biayanya dicatat). Dokumen yang belum punya penerimaan sama
-- sekali tidak punya baris tujuan — angkanya memang belum bisa dipertanggungkan
-- ke kiriman mana pun, dan dokumen seperti itu masih draft.

-- CreateTable
CREATE TABLE "metal_purchase_delivery_charges" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,

    "name" TEXT NOT NULL,
    "amountIdr" DECIMAL(18,2) NOT NULL,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metal_purchase_delivery_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metal_purchase_delivery_charges_deliveryId_lineNo_key"
  ON "metal_purchase_delivery_charges"("deliveryId", "lineNo");

CREATE INDEX "metal_purchase_delivery_charges_deliveryId_idx"
  ON "metal_purchase_delivery_charges"("deliveryId");

-- AddForeignKey
ALTER TABLE "metal_purchase_delivery_charges"
  ADD CONSTRAINT "metal_purchase_delivery_charges_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "metal_purchase_deliveries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Pindahkan nilai lama. Urutan barisnya mengikuti urutan biaya di layar (bea
-- masuk → freight → kurir), dan `lineNo` dirapatkan per penerimaan supaya tidak
-- ada lubang yang harus dijelaskan pembacanya.
INSERT INTO "metal_purchase_delivery_charges" ("id", "deliveryId", "lineNo", "name", "amountIdr", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  source."deliveryId",
  ROW_NUMBER() OVER (PARTITION BY source."deliveryId" ORDER BY source."order"),
  source."name",
  source."amountIdr",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  -- Bea masuk & freight dokumen → penerimaan paling awal dokumen itu.
  SELECT first_delivery."id" AS "deliveryId", 1 AS "order", 'Bea masuk' AS "name", p."importDutyIdr" AS "amountIdr"
  FROM "metal_purchases" p
  JOIN LATERAL (
    SELECT d."id"
    FROM "metal_purchase_deliveries" d
    WHERE d."purchaseId" = p."id"
    ORDER BY d."date", d."number"
    LIMIT 1
  ) first_delivery ON TRUE
  WHERE p."importDutyIdr" > 0

  UNION ALL

  SELECT first_delivery."id", 2, 'Freight & asuransi', p."freightInsuranceIdr"
  FROM "metal_purchases" p
  JOIN LATERAL (
    SELECT d."id"
    FROM "metal_purchase_deliveries" d
    WHERE d."purchaseId" = p."id"
    ORDER BY d."date", d."number"
    LIMIT 1
  ) first_delivery ON TRUE
  WHERE p."freightInsuranceIdr" > 0

  UNION ALL

  -- Ongkos kurir sudah duduk di penerimaannya sendiri.
  SELECT d."id", 3, 'Biaya kurir', d."courierCostIdr"
  FROM "metal_purchase_deliveries" d
  WHERE d."courierCostIdr" > 0
) source;

-- DropColumn
ALTER TABLE "metal_purchases"
  DROP COLUMN "importDutyIdr",
  DROP COLUMN "freightInsuranceIdr";

ALTER TABLE "metal_purchase_deliveries"
  DROP COLUMN "courierCostIdr";
