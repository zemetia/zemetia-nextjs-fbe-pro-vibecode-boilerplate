-- Kurir yang dikuasakan atas sebuah pembelian impor, berikut nomor surat
-- kuasanya (`SK-KURIR-2026-0801`).
--
-- Kolom di dokumen, bukan di penerimaan — dan itu tidak bertabrakan dengan
-- `metal_purchase_deliveries.courierPartnerId`: yang di penerimaan menjawab
-- "siapa yang mengantar kiriman ini" (tiga kiriman, tiga jawaban), yang di sini
-- menjawab "siapa yang kita kuasakan atas dokumen ini". Surat kuasanya terbit
-- sekali atas dokumennya sendiri, sederajat dengan PIB/SPPB/MAWB.
--
-- Nama kurirnya teks bebas, bukan FK ke mitra: yang dicetak di surat kuasa
-- adalah nama yang disebut di lapangan ("Brinks"), dan belum ada aturan apa pun
-- yang bergantung pada mitra mana ia.
--
-- Keduanya nullable dan tetap nullable — kurirnya ditunjuk setelah barangnya
-- dipesan, dan surat kuasanya terbit setelah kurirnya ditunjuk. Tanpa unique:
-- nomornya memang milik kita, tapi ia tidak pernah dibaca generator mana pun.

-- AlterTable
ALTER TABLE "metal_purchases"
  ADD COLUMN "courierName" TEXT,
  ADD COLUMN "courierMandateNumber" TEXT;
