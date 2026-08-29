-- Satuan berat pada dokumen pembelian, dan harga yang mengikuti satuan itu.
--
-- Invoice refinery impor dikutip per troy ounce; sampai sekarang petugas harus
-- membaginya sendiri dengan 31,1034768 supaya muat di kolom "per gram", dan
-- angka di layar tidak pernah sama dengan angka di invoice.
--
-- Beratnya sendiri tetap gram di semua kolom — yang bertambah cuma cara
-- mengetiknya. Karena itu dokumen yang sudah ada tidak butuh konversi apa pun:
-- `GRAM` adalah default, dan harga per gram lama adalah harga per satuan yang
-- benar untuk dokumen bersatuan gram.

-- Enum `WeightUnit` sudah ada sejak modul order penjualan; di sini ia hanya
-- dipakai ulang. Kolomnya NOT NULL berkat default, jadi tidak ada backfill.
ALTER TABLE "metal_purchases"
  ADD COLUMN "weightUnit" "WeightUnit" NOT NULL DEFAULT 'GRAM';

-- `pricePerGram` → `pricePerUnit`. RENAME (bukan drop + add) supaya harga
-- dokumen lama ikut pindah apa adanya; menghapus lalu menambah kolom akan
-- mengosongkan setiap baris yang sudah tersimpan.
ALTER TABLE "metal_purchase_items"
  RENAME COLUMN "pricePerGram" TO "pricePerUnit";

-- Melebar dari (18,4) ke (18,8), searah dengan `sales_orders.pricePerUnit`:
-- harga ini dihitung balik dari nilai baris yang diketik petugas, dan empat
-- desimal menggeser total yang baru saja diketik (LEARN 2026-08-11). Melebarkan
-- presisi tidak pernah menolak nilai lama.
ALTER TABLE "metal_purchase_items"
  ALTER COLUMN "pricePerUnit" TYPE DECIMAL(18, 8);
