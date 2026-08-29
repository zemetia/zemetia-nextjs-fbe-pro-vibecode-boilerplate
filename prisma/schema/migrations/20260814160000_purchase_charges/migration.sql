-- Biaya yang menempel pada **dokumen pembelian**, bukan pada satu kiriman.
--
-- Kembaran `metal_purchase_delivery_charges`, dan pembagiannya satu pertanyaan:
-- biaya ini muncul lagi kalau barangnya dikirim dua kali? Kalau ya (ongkos
-- kurir, freight kiriman itu) tempatnya penerimaan; kalau tidak — biaya yang
-- lahir dari kesepakatannya sendiri dan tidak bisa dibagi ke kiriman mana pun —
-- tempatnya di sini, di dokumennya.
--
-- Tetap **baris, bukan kolom**: yang berbeda antar biaya cuma namanya dan
-- angkanya. Tabel baru tanpa backfill — tidak ada kolom lama yang jadi asalnya;
-- yang dulu ada di dokumen sudah pindah ke penerimaan lewat
-- `20260814100000_delivery_charges`, dan memindahkannya balik berarti menaruh
-- angka yang tidak pernah dicatat siapa pun.

-- CreateTable
CREATE TABLE "metal_purchase_charges" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,

    "name" TEXT NOT NULL,
    "amountIdr" DECIMAL(18,2) NOT NULL,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metal_purchase_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metal_purchase_charges_purchaseId_lineNo_key"
  ON "metal_purchase_charges"("purchaseId", "lineNo");

CREATE INDEX "metal_purchase_charges_purchaseId_idx"
  ON "metal_purchase_charges"("purchaseId");

-- AddForeignKey
ALTER TABLE "metal_purchase_charges"
  ADD CONSTRAINT "metal_purchase_charges_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "metal_purchases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
