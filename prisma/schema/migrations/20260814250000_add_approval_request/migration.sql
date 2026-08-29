-- Lapis persetujuan direktur: satu antrean untuk permintaan konfirmasi dari
-- seluruh modul.
--
-- Tidak ada satu pun kolom yang ditambahkan ke tabel dokumen, dan itu disengaja.
-- Keadaan "menunggu persetujuan" diturunkan dari adanya baris PENDING di sini,
-- bukan disimpan sebagai status keenam di setiap enum dokumen — dua jawaban untuk
-- satu fakta pasti akan berselisih suatu hari, alasan yang sama dengan saldo akun
-- yang diturunkan dari `journal_lines`.

CREATE TYPE "ApprovalKind" AS ENUM (
  'METAL_PURCHASE_CONFIRM',
  'METAL_PURCHASE_DELIVERY_CONFIRM',
  'CASH_VOUCHER_APPROVE',
  'PRODUCTION_ORDER_RELEASE'
);

CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "approval_requests" (
  "id"            TEXT NOT NULL,
  "number"        TEXT NOT NULL,
  "kind"          "ApprovalKind" NOT NULL,
  "status"        "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  -- Sengaja tanpa FK: satu kolom menunjuk empat model, dan jejak persetujuan
  -- tidak boleh bisa ditarik ikut terhapus oleh dokumennya. Pola yang sama
  -- dengan `referenceId` di `journal_entries` dan `metal_movements`.
  "subjectId"     TEXT NOT NULL,
  -- Kunci keunikan parsial: 'PENDING' selama terbuka, NULL sesudah diputuskan.
  -- Postgres tidak pernah menganggap dua NULL bertabrakan, jadi unique index di
  -- bawah berarti "maksimal satu permintaan terbuka per dokumen per jenis"
  -- sementara riwayat keputusan lamanya boleh sebanyak apa pun.
  "pendingKey"    TEXT,
  "requestNote"   TEXT,
  "requestedById" TEXT NOT NULL,
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById"   TEXT,
  "decidedAt"     TIMESTAMP(3),
  "decisionNote"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_requests_number_key" ON "approval_requests"("number");

CREATE UNIQUE INDEX "approval_requests_kind_subjectId_pendingKey_key"
  ON "approval_requests"("kind", "subjectId", "pendingKey");

CREATE INDEX "approval_requests_status_requestedAt_idx"
  ON "approval_requests"("status", "requestedAt");
CREATE INDEX "approval_requests_kind_status_idx" ON "approval_requests"("kind", "status");
CREATE INDEX "approval_requests_subjectId_idx" ON "approval_requests"("subjectId");
CREATE INDEX "approval_requests_requestedById_idx" ON "approval_requests"("requestedById");

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
