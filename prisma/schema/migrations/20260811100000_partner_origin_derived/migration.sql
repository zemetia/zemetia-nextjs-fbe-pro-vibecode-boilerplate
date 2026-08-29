-- Asal mitra (Overseas/Lokal) tidak lagi disimpan: negaranya sudah menjawab
-- pertanyaan yang sama, dan dua kolom untuk satu fakta pasti akan berselisih
-- suatu hari. Sejak sekarang diturunkan lewat `partnerOriginFromCountry()`
-- (Indonesia = LOCAL, selain itu = OVERSEAS), dan filternya menembus relasi
-- negara — karena itu indeks pindah ke `countryId`.

DROP INDEX IF EXISTS "partners_origin_idx";

ALTER TABLE "partners" DROP COLUMN "origin";

DROP TYPE "PartnerOrigin";

CREATE INDEX "partners_countryId_idx" ON "partners"("countryId");
