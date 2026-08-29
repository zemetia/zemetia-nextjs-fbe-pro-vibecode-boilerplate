-- Kategori mitra dipangkas jadi satu sumbu: asal barangnya.
--
-- Sisi beli hanya IMPORT / LOCAL dan sisi jual hanya EXPORT / LOCAL, karena
-- itulah satu-satunya perbedaan yang mengubah dokumen dan angkanya (mata uang
-- asing, kurs, bea masuk, freight, PEB). Klasifikasi lama — refinery, pengepul
-- scrap, bahan kimia, grosir, retail — tidak pernah menggerbangi aturan apa pun,
-- jadi menyimpannya sebagai enum hanya memaksa petugas memilih hal yang tidak
-- berkonsekuensi. Bentuk badan usaha tetap hidup di kolom `type`.
--
-- Pemetaannya menjaga baris yang sudah ada: apa pun yang bukan luar negeri
-- menjadi LOCAL.

-- ------------------------------------------------------ SupplierCategory

CREATE TYPE "SupplierCategory_new" AS ENUM ('IMPORT', 'LOCAL');

ALTER TABLE "partners"
  ALTER COLUMN "supplierCategory" TYPE "SupplierCategory_new"
  USING (
    CASE "supplierCategory"::text
      WHEN 'REFINERY_OVERSEAS' THEN 'IMPORT'
      ELSE 'LOCAL'
    END
  )::"SupplierCategory_new";

DROP TYPE "SupplierCategory";
ALTER TYPE "SupplierCategory_new" RENAME TO "SupplierCategory";

-- ------------------------------------------------------ CustomerCategory

CREATE TYPE "CustomerCategory_new" AS ENUM ('EXPORT', 'LOCAL');

ALTER TABLE "partners"
  ALTER COLUMN "customerCategory" TYPE "CustomerCategory_new"
  USING (
    CASE "customerCategory"::text
      WHEN 'EXPORT_BUYER' THEN 'EXPORT'
      ELSE 'LOCAL'
    END
  )::"CustomerCategory_new";

DROP TYPE "CustomerCategory";
ALTER TYPE "CustomerCategory_new" RENAME TO "CustomerCategory";
