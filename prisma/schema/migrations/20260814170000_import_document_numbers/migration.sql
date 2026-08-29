-- Nomor dokumen kepabeanan & pengangkutan kiriman impor.
--
-- Kolom, bukan baris — kebalikan dari biaya, dan alasannya beda: daftar ini
-- tidak bertambah sendiri (PIB, SPPB, MAWB adalah dokumen yang namanya
-- ditetapkan regulasi, bukan kategori yang dikarang per transaksi), tiap nomor
-- punya arti dan pembacanya sendiri, dan nantinya bisa jadi acuan pencarian —
-- yang tidak bisa dilakukan kalau namanya cuma teks bebas di sebuah baris.
--
-- Semuanya nullable dan tetap nullable: nomornya lahir di pihak lain dan datang
-- bertahap (PIB diajukan, SPPB keluar setelah jalurnya ditetapkan, MAWB sudah
-- ada sejak barangnya berangkat). Tanpa unique — nomor ini milik orang lain.
--
-- COR menempel pada **penerimaannya**, bukan pada dokumen: ia lahir dari
-- kedatangannya sendiri, jadi satu PO yang dikirim tiga kali punya tiga COR.

-- AlterTable
ALTER TABLE "metal_purchases"
  ADD COLUMN "pibNumber" TEXT,
  ADD COLUMN "sppbNumber" TEXT,
  ADD COLUMN "mawbNumber" TEXT;

-- AlterTable
ALTER TABLE "metal_purchase_deliveries"
  ADD COLUMN "corNumber" TEXT;
