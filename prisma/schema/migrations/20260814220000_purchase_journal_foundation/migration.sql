-- Fondasi jurnal pembelian: dari mana angkanya, ke akun mana ia mendarat, dan
-- kapan hutangnya lahir.
--
-- Empat perubahan yang saling mengunci:
--   1. `products` menunjuk akun persediaan + akun singgahnya sendiri
--   2. bentuk `GRANULE` — logam murni yang ditakar per gram, bukan per keping
--   3. kurs kembali ke header pembelian, dan satu angka itu berlaku sampai lunas
--   4. `IN_TRANSIT` — barang berangkat, dan di situlah hutang usaha lahir
--
-- Tidak ada baris lama yang nilainya diubah: seluruh kolom baru nullable, dan
-- dokumen yang sudah CONFIRMED tidak disentuh.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nilai enum baru
-- ─────────────────────────────────────────────────────────────────────────────
-- Ditambahkan dengan `AFTER` supaya urutan nilainya sama persis dengan urutan di
-- `schema.prisma` — Prisma membandingkan urutan enum saat `migrate diff`, jadi
-- menambahkannya di ujung akan terus dilaporkan drift walau isinya sudah benar
-- (senada dengan nama constraint yang tertinggal saat rename tabel, LEARN
-- 2026-08-13).

ALTER TYPE "ProductForm" ADD VALUE 'GRANULE' AFTER 'BULLION';
ALTER TYPE "MetalLotForm" ADD VALUE 'GRANULE' AFTER 'BAR';
ALTER TYPE "MetalPurchaseDeliveryStatus" ADD VALUE 'IN_TRANSIT' AFTER 'DRAFT';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Barang menunjuk akunnya sendiri
-- ─────────────────────────────────────────────────────────────────────────────
-- Kolom, bukan peta di kode: bentuk barang berikutnya harus jadi satu baris
-- master, bukan satu cabang `switch` dan satu deploy — alasan yang sama yang
-- membuat jenis barang jadi master alih-alih enum.
--
-- Keduanya nullable dan tetap nullable. Master ini sudah terisi sebelum
-- akuntansinya ada, dan yang menagih kelengkapannya adalah konfirmasi dokumen
-- (dengan pesan yang menyebut barangnya), bukan constraint yang memblokir setiap
-- layar yang menyentuh master.
--
-- `RESTRICT`, bukan `SET NULL`: akun yang sudah jadi tujuan persediaan tidak
-- boleh hilang dari bawah barang yang merujuknya.

ALTER TABLE "products"
  ADD COLUMN "inventoryAccountId" TEXT,
  ADD COLUMN "transitAccountId"   TEXT;

ALTER TABLE "products"
  ADD CONSTRAINT "products_inventoryAccountId_fkey"
    FOREIGN KEY ("inventoryAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "products_transitAccountId_fkey"
    FOREIGN KEY ("transitAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "products_inventoryAccountId_idx" ON "products"("inventoryAccountId");
CREATE INDEX "products_transitAccountId_idx" ON "products"("transitAccountId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Kurs kembali ke dokumen
-- ─────────────────────────────────────────────────────────────────────────────
-- Aturan ini dulu terbalik — kurs dianggap milik tiap voucher, karena diandaikan
-- rupiah yang ditukar bank pada hari transfer. Kenyataannya supplier impor
-- dibayar dari rekening dolar: dolar masuk, dolar keluar, tidak pernah jadi
-- rupiah di tengah jalan. Jadi tidak ada kurs kedua yang bisa berbeda, dan
-- hutang yang berdiri di kurs PO ditutup persis nol oleh cicilan berkurs sama.
--
-- Rupiah per satu satuan `currencyCode`. `NULL` untuk dokumen rupiah — mengisi 1
-- di sana hanya menyediakan angka yang bisa salah tanpa pernah berguna.

ALTER TABLE "metal_purchases"
  ADD COLUMN "exchangeRate" DECIMAL(18,6);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Barang berangkat
-- ─────────────────────────────────────────────────────────────────────────────
-- `shippedAt` berdiri sendiri dan tidak menumpang `date`: `date` adalah tanggal
-- barang **diterima**, dan satu kiriman impor berangkat berminggu-minggu sebelum
-- sampai. Jurnal hutangnya bertanggal yang ini, jurnal persediaannya bertanggal
-- `date` — dua peristiwa, dua tanggal.
--
-- `DATE`, bukan timestamp: keberangkatan adalah hari, dan menyimpannya sebagai
-- instan membuat tanggalnya bergeser sehari di UTC+7.

ALTER TABLE "metal_purchase_deliveries"
  ADD COLUMN "shippedAt"   DATE,
  ADD COLUMN "shippedById" TEXT;

ALTER TABLE "metal_purchase_deliveries"
  ADD CONSTRAINT "metal_purchase_deliveries_shippedById_fkey"
    FOREIGN KEY ("shippedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
