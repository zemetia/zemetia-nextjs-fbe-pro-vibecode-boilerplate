-- Sisi kas/bank sebuah voucher berhenti jadi satu kolom dan menjadi baris.
--
-- `cash_vouchers.contraAccountId` hanya benar selama satu pembayaran berarti satu
-- rekening. Satu tagihan supplier yang ditutup dari dua rekening dalam satu hari
-- terpaksa dipecah jadi dua voucher — dua nomor dokumen untuk satu pembayaran
-- yang disepakati sekali. Yang berbeda antar rekening cuma akunnya dan angkanya,
-- jadi keduanya data.
--
-- Tidak ada baris lama yang berubah artinya: tiap voucher yang ada dipindahkan
-- apa adanya menjadi **satu** baris dana senilai totalnya, jadi jurnal yang sudah
-- diposting tetap menghasilkan angka yang persis sama.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabel barisnya
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "cash_voucher_fund_lines" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "cash_voucher_fund_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_voucher_fund_lines_voucherId_lineNo_key"
    ON "cash_voucher_fund_lines"("voucherId", "lineNo");

CREATE INDEX "cash_voucher_fund_lines_accountId_idx"
    ON "cash_voucher_fund_lines"("accountId");

-- Cascade dari vouchernya (header adalah satu-satunya jalan mencapai baris ini),
-- Restrict ke akunnya — akun yang sudah dipakai tidak boleh hilang dari bawah
-- dokumen yang merujuknya.
ALTER TABLE "cash_voucher_fund_lines"
    ADD CONSTRAINT "cash_voucher_fund_lines_voucherId_fkey"
        FOREIGN KEY ("voucherId") REFERENCES "cash_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "cash_voucher_fund_lines_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Voucher lama dipindahkan
-- ─────────────────────────────────────────────────────────────────────────────
-- Id-nya `gen_random_uuid()` dan bukan cuid: Postgres tidak bisa membuat cuid,
-- dan yang dibutuhkan sebuah id hasil backfill hanyalah unik — baris baru tetap
-- lahir sebagai cuid lewat Prisma.

INSERT INTO "cash_voucher_fund_lines" ("id", "voucherId", "lineNo", "accountId", "amount")
SELECT gen_random_uuid()::text, v."id", 1, v."contraAccountId", v."totalAmount"
FROM "cash_vouchers" v;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Kolom lama dibuang
-- ─────────────────────────────────────────────────────────────────────────────
-- Dibuang, bukan dibiarkan "kalau-kalau": dua tempat untuk satu jawaban adalah
-- cara keduanya berselisih suatu hari tanpa ada yang terlihat salah di layar.

DROP INDEX "cash_vouchers_contraAccountId_idx";

ALTER TABLE "cash_vouchers" DROP CONSTRAINT "cash_vouchers_contraAccountId_fkey";

ALTER TABLE "cash_vouchers" DROP COLUMN "contraAccountId";
