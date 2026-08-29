-- Satuan berat turun dari dokumen ke baris.
--
-- Ia ditaruh di dokumen dengan alasan "satu invoice refinery dikutip dalam satu
-- satuan". Itu benar untuk invoice yang seluruhnya ounce, dan langsung salah
-- begitu satu dokumen memuat batangan yang dikutip per troy ounce bersama scrap
-- yang ditimbang di meja per gram — keadaan yang justru sengaja dimungkinkan
-- sejak `metal_purchase_items` lahir. Pertanyaannya milik barang, bukan milik
-- kesepakatannya.
--
-- Beratnya sendiri tetap gram di setiap kolom (`weightGram`, berat keping,
-- berat penerimaan); yang pindah cuma jawaban atas "angka ini diketik dalam
-- satuan apa".

-- Ditambahkan dengan default supaya kolomnya NOT NULL sejak baris pertama.
ALTER TABLE "metal_purchase_items"
  ADD COLUMN "weightUnit" "WeightUnit" NOT NULL DEFAULT 'GRAM';

-- Backfill **sebelum** kolom lamanya dibuang: setiap baris mewarisi satuan
-- dokumen yang menaunginya, jadi dokumen impor 400 oz yang sudah tersimpan
-- terbaca kembali sebagai 400 oz, bukan 12.441,3907 g. Tanpa langkah ini
-- default `GRAM` akan diam-diam mengubah arti setiap dokumen ounce yang ada.
UPDATE "metal_purchase_items" AS i
SET "weightUnit" = p."weightUnit"
FROM "metal_purchases" AS p
WHERE i."purchaseId" = p."id";

ALTER TABLE "metal_purchases"
  DROP COLUMN "weightUnit";
