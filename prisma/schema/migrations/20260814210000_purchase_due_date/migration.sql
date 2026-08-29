-- Tanggal jatuh tempo pembayaran sebuah pembelian.
--
-- Nullable dan tetap nullable: mayoritas pembelian lokal adalah harga
-- kesepakatan yang dibayar di tempat, jadi memaksanya terisi hanya melahirkan
-- tanggal karangan yang kelak dilaporkan sebagai hutang lewat tempo.
--
-- Dibekukan di dokumen, bukan dihitung dari `partners.purchaseTermDays` saat
-- laporan dibaca — termin di master adalah usulan awal, dan menghitung ulang
-- setiap kali laporan dibuka membuat satu koreksi termin diam-diam mengubah umur
-- seluruh hutang lama.
--
-- `@db.Date`, bukan timestamp: jatuh tempo adalah hari, dan menyimpannya sebagai
-- instan membuat tanggalnya bergeser sehari di UTC+7.

-- AlterTable
ALTER TABLE "metal_purchases"
  ADD COLUMN "dueDate" DATE;

-- Umur hutang menyaring dokumen yang jatuh temponya sudah lewat; tanpa indeks,
-- laporan itu memindai seluruh tabel pembelian tiap kali dibuka.
CREATE INDEX "metal_purchases_dueDate_idx" ON "metal_purchases"("dueDate");
