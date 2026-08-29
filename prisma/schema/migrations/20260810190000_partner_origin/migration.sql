-- Dua kategori mitra dilebur jadi satu kolom `origin`.
--
-- Pertanyaannya sama di sisi beli maupun sisi jual — barangnya menyeberang batas
-- negara atau tidak — dan hanya itu yang mengubah dokumen serta angkanya (mata
-- uang asing, kurs, bea masuk, freight, PEB/AWB). Menyimpannya dua kali, sekali
-- per peran, hanya melahirkan dua jawaban untuk satu fakta yang bisa berselisih
-- pada mitra berperan ganda. Peran tetap di `isSupplier`/`isCustomer`.
--
-- Pemetaan baris lama: apa pun yang luar negeri di salah satu peran menjadi
-- OVERSEAS; sisanya LOCAL.

CREATE TYPE "PartnerOrigin" AS ENUM ('OVERSEAS', 'LOCAL');

ALTER TABLE "partners" ADD COLUMN "origin" "PartnerOrigin";

UPDATE "partners"
SET "origin" = CASE
  WHEN "supplierCategory"::text = 'IMPORT' OR "customerCategory"::text = 'EXPORT'
    THEN 'OVERSEAS'::"PartnerOrigin"
  ELSE 'LOCAL'::"PartnerOrigin"
END;

ALTER TABLE "partners" ALTER COLUMN "origin" SET NOT NULL;

DROP INDEX "partners_supplierCategory_idx";
DROP INDEX "partners_customerCategory_idx";

ALTER TABLE "partners"
  DROP COLUMN "supplierCategory",
  DROP COLUMN "customerCategory";

DROP TYPE "SupplierCategory";
DROP TYPE "CustomerCategory";

CREATE INDEX "partners_origin_idx" ON "partners"("origin");
