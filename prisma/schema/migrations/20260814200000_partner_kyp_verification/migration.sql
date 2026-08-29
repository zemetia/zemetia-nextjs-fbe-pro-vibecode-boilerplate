-- Mitra usaha: verifikasi KYP, identitas kontak person, dan pembenahan blok legal.
--
-- Tiga perubahan yang berdiri sendiri tapi mendarat bersama karena semuanya
-- menyentuh satu tabel:
--
-- 1. **Verifikasi (KYP).** Centang "Terverifikasi" berlaku dua tahun dan lahir
--    dari pengajuan yang disetujui orang lain — jadi yang disimpan bukan satu
--    boolean melainkan siapa mengajukan, siapa memutuskan, kapan, dan sampai
--    kapan. `EXPIRED` tidak jadi nilai enum: ia diturunkan dari `verifiedUntil`
--    saat dibaca, supaya tidak ada cron yang kalau gagal semalam membuat layar
--    memasang centang untuk data yang sudah wajib diperbarui.
--
-- 2. **Identitas kontak person.** Kewarganegaraan kontak adalah kolom sendiri,
--    bukan turunan `countryId` mitra: perusahaan luar negeri sering menaruh PIC
--    orang Indonesia, dan hanya orangnya yang menentukan NIK atau paspor.
--
-- 3. **`registrationNumber` dipecah.** Satu kolom itu dulu menampung dua hal yang
--    formatnya tak sebanding — NIB (13 digit, terbit dari OSS) dan nomor
--    registrasi asing (beda bentuk di tiap yurisdiksi) — sehingga tidak ada
--    aturan apa pun yang bisa ditegakkan atas isinya. Backfill di bawah
--    memisahkannya berdasarkan negara mitra, lalu kolom lamanya dibuang.

-- CreateEnum
CREATE TYPE "PartnerContactIdType" AS ENUM ('NIK', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable: identitas kontak person
ALTER TABLE "partners" ADD COLUMN "contactCountryId" TEXT;
ALTER TABLE "partners" ADD COLUMN "contactIdType" "PartnerContactIdType";
ALTER TABLE "partners" ADD COLUMN "contactIdNumber" TEXT;

-- AlterTable: pajak & legal
ALTER TABLE "partners" ADD COLUMN "nib" TEXT;
ALTER TABLE "partners" ADD COLUMN "foreignRegistrationNumber" TEXT;
ALTER TABLE "partners" ADD COLUMN "isPkp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "partners" ADD COLUMN "sppkpNumber" TEXT;
ALTER TABLE "partners" ADD COLUMN "deedNumber" TEXT;
ALTER TABLE "partners" ADD COLUMN "deedDate" DATE;
ALTER TABLE "partners" ADD COLUMN "ministryDecreeNumber" TEXT;

-- AlterTable: verifikasi KYP
ALTER TABLE "partners" ADD COLUMN "verificationStatus" "PartnerVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "partners" ADD COLUMN "verificationRequestedAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "verificationRequestedById" TEXT;
ALTER TABLE "partners" ADD COLUMN "verificationReviewedAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "verificationReviewedById" TEXT;
ALTER TABLE "partners" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "verifiedUntil" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "verificationNote" TEXT;

-- Backfill: nomor registrasi lama dipisah menurut negara mitranya. Mitra
-- Indonesia menyimpannya sebagai NIB, sisanya sebagai nomor registrasi asing.
-- Tidak ada baris yang boleh kehilangan isinya — itu satu-satunya angka yang
-- pernah dicatat orang untuk kolom ini.
UPDATE "partners" p
SET "nib" = p."registrationNumber"
FROM "countries" c
WHERE c."id" = p."countryId"
  AND c."iso2" = 'ID'
  AND p."registrationNumber" IS NOT NULL;

UPDATE "partners" p
SET "foreignRegistrationNumber" = p."registrationNumber"
FROM "countries" c
WHERE c."id" = p."countryId"
  AND c."iso2" <> 'ID'
  AND p."registrationNumber" IS NOT NULL;

-- DropColumn
ALTER TABLE "partners" DROP COLUMN "registrationNumber";

-- CreateIndex
CREATE INDEX "partners_verificationStatus_idx" ON "partners"("verificationStatus");
CREATE INDEX "partners_verifiedUntil_idx" ON "partners"("verifiedUntil");
CREATE INDEX "partners_contactCountryId_idx" ON "partners"("contactCountryId");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_contactCountryId_fkey" FOREIGN KEY ("contactCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "partners" ADD CONSTRAINT "partners_verificationRequestedById_fkey" FOREIGN KEY ("verificationRequestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "partners" ADD CONSTRAINT "partners_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
